// backend/api/upload-cdr.js
const multer = require('multer');
const Papa = require('papaparse');
const CDR = require('../models/CDR');

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

module.exports = async (req, res) => {
  // Handle file upload
  upload.single('cdrFile')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    try {
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      
      console.log(`Processing manual upload: ${fileName}`);

      // Parse CSV
      const parsed = await parseCSV(fileBuffer.toString());
      
      // Process CDRs
      const processedCDRs = processCDRs(parsed.data, fileName);
      
      // Save to database
      const savedCount = await saveToDatabase(processedCDRs);
      
      res.json({
        success: true,
        message: 'CDRs uploaded successfully',
        stats: {
          fileName,
          totalRecords: parsed.data.length,
          processedRecords: processedCDRs.length,
          savedRecords: savedCount,
          errors: parsed.data.length - processedCDRs.length
        },
        errors: parsed.errors
      });

    } catch (error) {
      console.error('Error processing CDR upload:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};

function parseCSV(content) {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const dataToProcess = results.data;
        // Check if first row is header
        const hasHeader = dataToProcess.length > 0 && 
                         (dataToProcess[0][0] === 'callere164' || dataToProcess[0][0] === 'caller_e164');
        
        const rows = hasHeader ? dataToProcess.slice(1) : dataToProcess;
        const mappedData = rows.map(row => mapCSVRowToObject(row));
        resolve({ ...results, data: mappedData });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

function mapCSVRowToObject(row) {
  return {
    callere164: row[0] || '',
    calleraccesse164: row[1] || '',
    calleee164: row[2] || '',
    calleeaccesse164: row[3] || '',
    callerip: row[4] || '',
    callercodec: row[5] || '',
    callergatewayid: row[6] || '',
    callerproductid: row[7] || '',
    callertogatewaye164: row[8] || '',
    callertype: row[9] || '',
    calleeip: row[10] || '',
    calleecodec: row[11] || '',
    calleegatewayid: row[12] || '',
    calleeproductid: row[13] || '',
    calleetogatewaye164: row[14] || '',
    calleetype: row[15] || '',
    billingmode: row[16] || '',
    calllevel: row[17] || '',
    agentfeetime: row[18] || '',
    starttime: row[19] || '',
    stoptime: row[20] || '',
    callerpdd: row[21] || '',
    calleepdd: row[22] || '',
    holdtime: row[23] || '',
    callerareacode: row[24] || '',
    feetime: row[25] || '',
    fee: row[26] || '',
    tax: row[27] || '',
    suitefee: row[28] || '',
    suitefeetime: row[29] || '',
    incomefee: row[30] || '',
    incometax: row[31] || '',
    customeraccount: row[32] || '',
    customername: row[33] || '',
    calleeareacode: row[34] || '',
    agentfee: row[35] || '',
    agenttax: row[36] || '',
    agentsuitefee: row[37] || '',
    agentsuitefeetime: row[38] || '',
    agentaccount: row[39] || '',
    agentname: row[40] || '',
    flowno: row[41] || '',
    softswitchname: row[42] || '',
    softswitchcallid: row[43] || '',
    callercallid: row[44] || '',
    calleroriginalcallid: row[45] || '',
    rtpforward: row[46] || '',
    enddirection: row[47] || '',
    endreason: row[48] || '',
    billingtype: row[49] || '',
    cdrlevel: row[50] || '',
    agentcdr_id: row[51] || ''
  };
}

function processCDRs(rawData, sourceFile) {
  const processed = [];
  const now = new Date();
  
  rawData.forEach((record, index) => {
    try {
      const cdr = transformCDR(record, index);
      cdr.createdAt = now;
      cdr.updatedAt = now;
      
      if (validateCDR(cdr)) {
        processed.push(cdr);
      }
    } catch (error) {
      console.error(`Error processing record ${index}:`, error);
    }
  });
  
  return processed;
}

function transformCDR(rawRecord, index) {
  return {
    ...rawRecord
  };
}

function convertToEpoch(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
  } catch (e) {
    return null;
  }
}

function convertEpochToDate(epoch) {
  if (!epoch) return null;
  try {
    const timestamp = parseInt(epoch);
    const date = timestamp > 10000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
    return date;
  } catch (e) {
    return null;
  }
}

function validateCDR(cdr) {
  // Basic validation to ensure essential fields are present
  return (
    cdr.callere164 &&
    cdr.calleee164 &&
    cdr.starttime
  );
}

function determineCallType(rawType) {
  const type = (rawType || '').toUpperCase();
  if (type.includes('INTERNATIONAL')) return 'INTERNATIONAL';
  if (type.includes('NATIONAL')) return 'NATIONAL';
  if (type.includes('LOCAL')) return 'LOCAL';
  return 'NATIONAL';
}

async function saveToDatabase(cdrs) {
  if (cdrs.length === 0) return 0;
  
  try {
    const result = await CDR.bulkCreate(cdrs, {
      validate: true,
      ignoreDuplicates: true
    });
    return result.length;
  } catch (error) {
    console.error('Error saving CDRs to database:', error);
    throw error;
  }
}