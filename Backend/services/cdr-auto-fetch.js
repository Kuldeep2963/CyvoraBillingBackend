// backend/services/cdr-auto-fetch.js
require('dotenv').config();
const cron = require('node-cron');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const CDR = require('../models/CDR');
const ProcessedFile = require('../models/ProcessedFile');
const sequelize = require('../models/db');
const { Op } = require('sequelize');

const CDR_COLUMNS = [
  'callere164', 'calleraccesse164', 'calleee164', 'calleeaccesse164',
  'callerip', 'callercodec', 'callergatewayid', 'callerproductid',
  'callertogatewaye164', 'callertype', 'calleeip', 'calleecodec',
  'calleegatewayid', 'calleeproductid', 'calleetogatewaye164',
  'calleetype', 'billingmode', 'calllevel', 'agentfeetime',
  'starttime', 'stoptime', 'callerpdd', 'calleepdd', 'holdtime',
  'callerareacode', 'feetime', 'fee', 'tax', 'suitefee',
  'suitefeetime', 'incomefee', 'incometax', 'customeraccount',
  'customername', 'calleeareacode', 'agentfee', 'agenttax',
  'agentsuitefee', 'agentsuitefeetime', 'agentaccount', 'agentname',
  'flowno', 'softswitchname', 'softswitchcallid', 'callercallid',
  'calleroriginalcallid', 'rtpforward', 'enddirection', 'endreason',
  'billingtype', 'cdrlevel', 'agentcdr_id'
];

const execPromise = util.promisify(exec);

class CDRAutoFetcher {
  constructor(config) {
    this.config = {
      serverIP: process.env.SERVER_IP || '159.69.73.61',
      serverPath: process.env.SERVER_PATH || '/var/www/tmp/vos_files/6/',
      username: process.env.SSH_USERNAME || 'root',
      sshPort: parseInt(process.env.SSH_PORT) || 22,
      sshKeyPath: process.env.SSH_KEY_PATH || '',
      filePattern: process.env.FILE_PATTERN || 'cdr_*.csv',
      fetchInterval: process.env.FETCH_INTERVAL || '*/15 * * * *',
      localPath: process.env.LOCAL_PATH || './CDRs',
      maxRetries: 3,
      ...config
    };

    this.isRunning = false;
    this.processedFiles = new Set();
    
    // Initialize
    this.init().catch(error => {
      console.error('Failed to initialize CDR Auto-Fetcher:', error.message);
    });
  }

  async init() {
    try {
      console.log('Initializing CDR Auto-Fetcher...');
      
      // Test database connection
      await sequelize.authenticate();
      console.log('✅ Database connection established');

      // Create local directory for downloaded files
      const absoluteLocalPath = path.resolve(this.config.localPath);
      if (!fs.existsSync(absoluteLocalPath)) {
        fs.mkdirSync(absoluteLocalPath, { recursive: true });
        console.log(`Created local directory: ${absoluteLocalPath}`);
      }

      // Load processed files from database
      await this.loadProcessedFiles();
      
      // Start the scheduler
      this.startScheduler();
      
      console.log('✅ CDR Auto-Fetcher initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize CDR Auto-Fetcher:', error.message);
      throw error;
    }
  }

  async loadProcessedFiles() {
    try {
      const files = await ProcessedFile.findAll({
        where: { status: 'PROCESSED' },
        attributes: ['filename']
      });
      
      files.forEach(f => {
        this.processedFiles.add(f.filename);
      });
      
      console.log(`✅ Loaded ${this.processedFiles.size} processed files from database`);
    } catch (error) {
      console.error('❌ Error loading processed files:', error.message);
    }
  }

  startScheduler() {
    console.log(`⏰ Starting CDR auto-fetch scheduler (interval: ${this.config.fetchInterval})`);
    
    try {
      cron.schedule(this.config.fetchInterval, async () => {
        console.log('🔄 Scheduled job triggered');
        await this.fetchAndProcessCDRs();
      });

      console.log('✅ Scheduler started successfully');
      
      // Also run immediately on startup
      setTimeout(() => {
        console.log('🚀 Running initial fetch...');
        this.fetchAndProcessCDRs();
      }, 5000);
    } catch (error) {
      console.error('❌ Failed to start scheduler:', error.message);
      throw error;
    }
  }

  buildSSHCommand(remoteCommand) {
    let sshBase;
    if (this.config.sshKeyPath && fs.existsSync(this.config.sshKeyPath)) {
      sshBase = `ssh -i "${this.config.sshKeyPath}" -p ${this.config.sshPort} -o BatchMode=yes -o StrictHostKeyChecking=no`;
    } else {
      sshBase = `ssh -p ${this.config.sshPort} -o BatchMode=yes -o StrictHostKeyChecking=no`;
    }
    
    return `${sshBase} ${this.config.username}@${this.config.serverIP} "${remoteCommand}"`;
  }

  buildSCPCommand(remoteFile, localFile) {
    let scpBase;
    if (this.config.sshKeyPath && fs.existsSync(this.config.sshKeyPath)) {
      scpBase = `scp -i "${this.config.sshKeyPath}" -P ${this.config.sshPort} -o BatchMode=yes -o StrictHostKeyChecking=no`;
    } else {
      scpBase = `scp -P ${this.config.sshPort} -o BatchMode=yes -o StrictHostKeyChecking=no`;
    }
    
    return `${scpBase} ${this.config.username}@${this.config.serverIP}:"${remoteFile}" "${localFile}"`;
  }

  async fetchAndProcessCDRs() {
    if (this.isRunning) {
      console.log('⏳ Previous fetch still running. Skipping.');
      return;
    }

    this.isRunning = true;
    let fetchedCount = 0;
    let processedCount = 0;

    try {
      console.log('📥 Starting CDR auto-fetch process...');

      // 1. List files created in last 15 minutes
      const files = await this.listRecentFiles();
      
      if (files.length === 0) {
        console.log('📭 No new files found.');
        return;
      }

      console.log(`📁 Found ${files.length} new file(s)`);

      // 2. Process each file
      for (const remoteFile of files) {
        try {
          const filename = path.basename(remoteFile);
          const localFile = path.resolve(this.config.localPath, filename);
          
          // Skip already processed files
          if (this.processedFiles.has(filename)) {
            console.log(`⏭️ Skipping already processed file: ${filename}`);
            continue;
          }

          // Record processing start
          await this.recordFileProcessingStart(filename);

          // Download file using SCP
          const downloaded = await this.downloadFile(remoteFile, localFile);
          
          if (!downloaded) {
            await this.recordFileProcessingComplete(filename, 'FAILED', 0, 'Failed to download file');
            console.log(`❌ Failed to download ${filename}`);
            continue;
          }

          fetchedCount++;

          // Parse and process CDRs
          const processed = await this.processFile(filename, localFile);
          
          if (processed.success) {
            // Save to database
            await this.saveToDatabase(processed.cdrs);
            processedCount += processed.cdrs.length;
            
            // Mark as processed
            this.processedFiles.add(filename);
            await this.recordFileProcessingComplete(filename, 'PROCESSED', processed.cdrs.length);
            
            console.log(`✅ Processed ${filename}: ${processed.cdrs.length} CDRs`);
            
            // Files are now kept in the local directory for verification as requested
          } else {
            await this.recordFileProcessingComplete(filename, 'FAILED', 0, processed.error);
            console.log(`❌ Failed to process ${filename}: ${processed.error}`);
          }

        } catch (fileError) {
          console.error(`❌ Error processing file ${remoteFile}:`, fileError.message);
          await this.recordFileProcessingComplete(path.basename(remoteFile), 'ERROR', 0, fileError.message);
        }

        // Small delay between files
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`🎉 Auto-fetch completed: ${fetchedCount} files fetched, ${processedCount} CDRs processed`);

    } catch (error) {
      console.error('💥 Fatal error in auto-fetch process:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  async listRecentFiles() {
    try {
      // Find files modified in the last 15 minutes
      const listCommand = this.buildSSHCommand(
        `find ${this.config.serverPath} -name '${this.config.filePattern}' -type f -mmin -16 2>/dev/null`
      );

      console.log('🔍 Listing files on remote server...');
      const { stdout } = await execPromise(listCommand, { timeout: 30000 });
      
      const files = stdout
        .trim()
        .split('\n')
        .filter(file => file.length > 0 && path.extname(file) === '.csv');
      
      return files;
    } catch (error) {
      console.error('❌ Error listing files:', error.message);
      return [];
    }
  }

  async downloadFile(remoteFile, localFile) {
    try {
      const scpCommand = this.buildSCPCommand(remoteFile, localFile);
      console.log(`📥 Downloading: ${path.basename(remoteFile)}`);
      await execPromise(scpCommand, { timeout: 60000 });
      return fs.existsSync(localFile);
    } catch (error) {
      console.error(`❌ Error downloading file ${remoteFile}:`, error.message);
      return false;
    }
  }

  async processFile(filename, localFilePath) {
    try {
      const content = fs.readFileSync(localFilePath, 'utf8');
      const parsed = Papa.parse(content, {
        header: false,
        skipEmptyLines: true,
        transform: (value) => value.trim()
      });

      if (parsed.errors.length > 0) {
        console.warn(`CSV parsing warnings for ${filename}:`, parsed.errors);
      }

      const cdrs = parsed.data.map((row, index) => {
        const cdr = {};
        CDR_COLUMNS.forEach((col, i) => {
          cdr[col] = row[i];
        });
        return {
          ...cdr,
          id: `cdr_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
          source_file: filename
        };
      }).filter(cdr => cdr.callere164 && cdr.starttime);

      return { success: true, cdrs };
    } catch (error) {
      return { success: false, error: error.message, cdrs: [] };
    }
  }

  async saveToDatabase(cdrs) {
    if (cdrs.length === 0) return;
    
    // Bulk create with chunks to avoid large query issues
    const chunkSize = 100;
    for (let i = 0; i < cdrs.length; i += chunkSize) {
      const chunk = cdrs.slice(i, i + chunkSize);
      await CDR.bulkCreate(chunk, { ignoreDuplicates: true });
    }
    
    console.log(`💾 Saved ${cdrs.length} CDRs to database`);
  }

  async recordFileProcessingStart(filename) {
    try {
      await ProcessedFile.upsert({
        filename,
        status: 'PROCESSING',
        started_at: new Date()
      });
    } catch (error) {
      console.error('❌ Error recording file processing start:', error.message);
    }
  }

  async recordFileProcessingComplete(filename, status, recordsProcessed = 0, error = null) {
    try {
      await ProcessedFile.update({
        status,
        completed_at: new Date(),
        records_processed: recordsProcessed,
        error_message: error
      }, {
        where: { filename }
      });
    } catch (error) {
      console.error('❌ Error recording file processing complete:', error.message);
    }
  }
}

module.exports = CDRAutoFetcher;
