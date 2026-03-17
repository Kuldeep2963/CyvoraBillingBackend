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
      serverIP: process.env.SERVER_IP,
      serverPath: process.env.SERVER_PATH,
      username: process.env.SSH_USERNAME,
      sshPort: parseInt(process.env.SSH_PORT),
      sshKeyPath: process.env.SSH_KEY_PATH,
      filePattern:  'cdr_*.csv',
      fetchInterval: '*/15 * * * *',
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
      
      // Test database connection
      await sequelize.authenticate();

      // Load processed files from database
      await this.loadProcessedFiles();
      
      // Start the scheduler
      this.startScheduler();
      
    } catch (error) {
      console.error('!!!! Failed to initialize CDR Auto-Fetcher:', error.message);
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
      
    } catch (error) {
      console.error('!!!! Error loading processed files:', error.message);
    }
  }

  startScheduler() {
    
    try {
      cron.schedule(this.config.fetchInterval, async () => {
        await this.fetchAndProcessCDRs();
      });

      
      // Also run immediately on startup
      setTimeout(() => {
        this.fetchAndProcessCDRs();
      }, 5000);
    } catch (error) {
      console.error(' Failed to start scheduler:', error.message);
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

  async fetchAndProcessCDRs() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    let fetchedCount = 0;
    let processedCount = 0;

    try {

      // 1. List files created in last 15 minutes
      const files = await this.listRecentFiles();
      
      if (files.length === 0) {
        return;
      }


      // 2. Process each file
      for (const remoteFile of files) {
        try {
          const filename = path.basename(remoteFile);
          
          // Skip already processed files
          if (this.processedFiles.has(filename)) {
            continue;
          }

          // Record processing start
          await this.recordFileProcessingStart(filename);

          // Parse and process CDRs
          const csvContent = await this.fetchRemoteFileContent(remoteFile);
          fetchedCount++;
          const processed = await this.processFile(filename, csvContent);
          
          if (processed.success) {
            // Save to database
            await this.saveToDatabase(processed.cdrs);
            processedCount += processed.cdrs.length;
            
            // Mark as processed
            this.processedFiles.add(filename);
            await this.recordFileProcessingComplete(filename, 'PROCESSED', processed.cdrs.length);
            
          } else {
            await this.recordFileProcessingComplete(filename, 'FAILED', 0, processed.error);
          }

        } catch (fileError) {
          console.error(` !!!!! Error processing file ${remoteFile}:`, fileError.message);
          await this.recordFileProcessingComplete(path.basename(remoteFile), 'ERROR', 0, fileError.message);
        }

        // Small delay between files
        await new Promise(resolve => setTimeout(resolve, 500));
      }


    } catch (error) {
      console.error(' Fatal error in auto-fetch process:', error.message);
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

      const { stdout } = await execPromise(listCommand, { timeout: 30000 });
      
      const files = stdout
        .trim()
        .split('\n')
        .filter(file => file.length > 0 && path.extname(file) === '.csv');
      
      return files;
    } catch (error) {
      console.error(' Error listing files:', error.message);
      return [];
    }
  }

  async fetchRemoteFileContent(remoteFile) {
    try {
      const safeRemoteFile = remoteFile.replace(/'/g, `'\\''`);
      const readCommand = this.buildSSHCommand(`cat '${safeRemoteFile}'`);
      const { stdout } = await execPromise(readCommand, { timeout: 60000, maxBuffer: 25 * 1024 * 1024 });
      return stdout;
    } catch (error) {
      throw new Error(`Failed to read remote file ${remoteFile}: ${error.message}`);
    }
  }

  async processFile(filename, csvContent) {
    try {
      const parsed = Papa.parse(csvContent, {
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
    
  }

  async recordFileProcessingStart(filename) {
    try {
      await ProcessedFile.upsert({
        filename,
        status: 'PROCESSING',
        started_at: new Date()
      });
    } catch (error) {
      console.error(' Error recording file processing start:', error.message);
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
      console.error(' Error recording file processing complete:', error.message);
    }
  }
}

module.exports = CDRAutoFetcher;
