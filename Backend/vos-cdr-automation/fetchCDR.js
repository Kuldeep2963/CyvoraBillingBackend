const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration - UPDATE THESE VALUES
const config = {
    serverIP: '159.69.73.61',      // Replace with your server IP
    serverPath: '/var/www/tmp/vos_files/6/',   // Replace with your path (e.g., /var/lib/opensips/cdr)
    localPath: './CDRs',    // Local folder to save files
    username: 'root',                // SSH username
    sshPort: 22,                     // SSH port (default: 22)
    filePattern: 'cdr_*.csv',        // Pattern to match files
    checkInterval: '*/15 * * * *'     // Every 15 minute (cron: * * * * *)
};

let isRunning = false;

function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

function sanitizeCommand(input) {
    return input.replace(/[;&|`$]/g, '');
}

async function fetchCSVFiles() {
    if (isRunning) {
        log('Previous fetch still running. Skipping.');
        return;
    }

    isRunning = true;
    
    try {
        log('Starting CSV fetch process...');
        
        // Ensure local directory exists
        if (!fs.existsSync(config.localPath)) {
            fs.mkdirSync(config.localPath, { recursive: true });
            log(`Created local directory: ${config.localPath}`);
        }

        // 1. List files on server
        log(`Checking server for files matching: ${config.filePattern}`);
        
        const listCommand = sanitizeCommand(
            `ssh -p ${config.sshPort} ${config.username}@${config.serverIP} "find ${config.serverPath} -name '${config.filePattern}' -type f -mmin -2 2>/dev/null"`
        );
        
        const { stdout: filesList, stderr: listError } = await execPromise(listCommand);
        
        if (listError && !listError.includes('WARNING:')) {
            log(`Error listing files: ${listError}`);
            return;
        }
        
        const files = filesList.trim().split('\n').filter(f => f.length > 0);
        
        if (files.length === 0) {
            log('No new CSV files found on server.');
            return;
        }
        
        log(`Found ${files.length} CSV file(s) on server.`);

        // 2. Download each file
        let downloadedCount = 0;
        
        for (const remoteFile of files) {
            if (!remoteFile) continue;
            
            const filename = path.basename(remoteFile);
            const localFile = path.join(config.localPath, filename);
            
            // Skip if file already exists locally
            if (fs.existsSync(localFile)) {
                log(`File already exists locally: ${filename}`);
                continue;
            }
            
            try {
                log(`Downloading: ${filename}`);
                
                const scpCommand = sanitizeCommand(
                    `scp -P ${config.sshPort} ${config.username}@${config.serverIP}:"${remoteFile}" "${localFile}"`
                );
                
                const { stderr: scpError } = await execPromise(scpCommand);
                
                if (scpError) {
                    if (scpError.includes('WARNING:')) {
                        // SSH warnings are usually OK
                    } else {
                        log(`Error downloading ${filename}: ${scpError}`);
                        continue;
                    }
                }
                
                // Verify file was downloaded
                if (fs.existsSync(localFile)) {
                    const stats = fs.statSync(localFile);
                    downloadedCount++;
                    log(`✓ Downloaded ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
                } else {
                    log(`✗ Download failed for ${filename}`);
                }
                
            } catch (fileError) {
                log(`Error processing ${filename}: ${fileError.message}`);
            }
            
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (downloadedCount > 0) {
            log(`Successfully downloaded ${downloadedCount} file(s)`);
            
            // Optional: List downloaded files
            const localFiles = fs.readdirSync(config.localPath)
                .filter(f => f.endsWith('.csv'))
                .sort();
            
            log(`Total files in local directory: ${localFiles.length}`);
            
            // Optional: Archive old files (older than 7 days)
            archiveOldFiles();
            
        } else {
            log('No new files downloaded.');
        }
        
    } catch (error) {
        log(`Fatal error in fetch process: ${error.message}`);
        console.error(error.stack);
    } finally {
        isRunning = false;
    }
}

// Optional: Archive files older than 7 days
function archiveOldFiles() {
    const archiveDir = path.join(config.localPath, 'archive');
    const daysToKeep = 7;
    
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }
    
    try {
        const files = fs.readdirSync(config.localPath)
            .filter(f => f.endsWith('.csv'))
            .map(f => ({
                name: f,
                path: path.join(config.localPath, f),
                time: fs.statSync(path.join(config.localPath, f)).mtime.getTime()
            }));
        
        const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        
        files.forEach(file => {
            if (file.time < cutoff) {
                const archivePath = path.join(archiveDir, file.name);
                fs.renameSync(file.path, archivePath);
                log(`Archived old file: ${file.name}`);
            }
        });
    } catch (archiveError) {
        log(`Error during archiving: ${archiveError.message}`);
    }
}

// Initialize
log('CSV Fetcher Service Initializing...');
log(`Server: ${config.serverIP}:${config.sshPort}`);
log(`Remote Path: ${config.serverPath}`);
log(`Local Path: ${config.localPath}`);
log(`File Pattern: ${config.filePattern}`);
log('');

// Validate configuration - commented out as these are the correct values
// if (config.serverIP === '159.69.73.61' || config.serverPath === '/var/www/tmp/vos_files/6/' || config.localPath === './CDRs') {
//     log('❌ ERROR: Please update the configuration with your server details!');
//     log('Edit the config object at the top of this script.');
//     process.exit(1);
// }

// Schedule the task
log(`Scheduled to run every minute...`);
const cronJob = cron.schedule(config.checkInterval, () => {
    log('--- Scheduled run started ---');
    fetchCSVFiles();
});

// Run immediately on startup
fetchCSVFiles();

// Graceful shutdown
process.on('SIGINT', () => {
    log('Received SIGINT. Shutting down gracefully...');
    cronJob.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('Received SIGTERM. Shutting down gracefully...');
    cronJob.stop();
    process.exit(0);
});

// Optional: Monitor directory for changes
if (process.env.DEBUG === 'true') {
    log('Debug mode enabled - watching for file changes...');
    fs.watch(config.localPath, (eventType, filename) => {
        if (filename && filename.endsWith('.csv')) {
            log(`File ${eventType}: ${filename}`);
        }
    });
}