import Papa from 'papaparse';

export const parseCDRFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error('CSV parsing errors: ' + results.errors.map(e => e.message).join(', ')));
          return;
        }
        
        const validatedCDRs = validateCDRs(results.data);
        resolve(validatedCDRs);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

// Helper function to safely parse dates
const parseDateSafely = (dateString) => {
  if (!dateString || dateString.toString().trim() === '') return new Date();
  
  // Try parsing as Date object
  let date = new Date(dateString);
  
  // If invalid, try common telecom date formats
  if (isNaN(date.getTime())) {
    // Try parsing as timestamp (seconds or milliseconds)
    const timestamp = parseFloat(dateString);
    if (!isNaN(timestamp)) {
      // Check if it's seconds (typical Unix timestamp) or milliseconds
      date = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
    } else {
      // Try parsing common telecom string formats
      const dateStr = dateString.toString().trim();
      
      // Format: "2024-01-15 10:30:00" or "2024-01-15T10:30:00"
      const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
      if (isoMatch) {
        const [_, year, month, day, hour, minute, second] = isoMatch;
        date = new Date(year, month - 1, day, hour, minute, second);
      } else {
        // Format: "01/15/2024 10:30:00"
        const usMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})[T\s](\d{2}):(\d{2}):(\d{2})/);
        if (usMatch) {
          const [_, month, day, year, hour, minute, second] = usMatch;
          date = new Date(year, month - 1, day, hour, minute, second);
        }
      }
    }
  }
  
  // If still invalid, return current date
  return isNaN(date.getTime()) ? new Date() : date;
};

export const validateCDRs = (cdrs) => {
  return cdrs.map((cdr, index) => {
    const errors = [];
    
    // Extract essential fields from your CDR format
    const callerNumber = cdr.callere164 || '';
    const calleeNumber = cdr.calleee164 || '';
    const startTimeStr = cdr.starttime || cdr.recordstarttime || '';
    const stopTimeStr = cdr.stoptime || '';
    const duration = cdr.duration || calculateDuration(startTimeStr, stopTimeStr);
    const callStatus = determineCallStatus(cdr.endreason || cdr.status || '');
    const feeAmount = parseFloat(cdr.fee || cdr.incomefee || 0);
    const taxAmount = parseFloat(cdr.tax || cdr.incometax || 0);
    const customerId = cdr.customeraccount || cdr.customeraccount || '';
    const customerName = cdr.customername || cdr.customername || '';
    const callDirection = determineCallDirection(cdr.calleroriginalinfo || cdr.enddirection || '');
    
    // Check essential fields
    if (!callerNumber || callerNumber.trim() === '') {
      errors.push('Missing caller number (callere164)');
    }
    
    if (!calleeNumber || calleeNumber.trim() === '') {
      errors.push('Missing callee number (calleee164)');
    }
    
    if (!startTimeStr || startTimeStr.trim() === '') {
      errors.push('Missing start time');
    }
    
    // Validate dates
    let startTime, stopTime;
    try {
      startTime = parseDateSafely(startTimeStr);
      if (isNaN(startTime.getTime())) {
        errors.push('Invalid start time format');
      }
      
      if (stopTimeStr && stopTimeStr.trim() !== '') {
        stopTime = parseDateSafely(stopTimeStr);
        if (isNaN(stopTime.getTime())) {
          errors.push('Invalid stop time format');
        }
      }
    } catch (error) {
      errors.push('Error parsing date/time');
      startTime = new Date();
    }
    
    // Calculate duration if not provided
    let callDuration = parseInt(duration);
    if (isNaN(callDuration) || callDuration < 0) {
      if (startTime && stopTime && !isNaN(startTime.getTime()) && !isNaN(stopTime.getTime())) {
        callDuration = Math.floor((stopTime - startTime) / 1000);
      } else {
        callDuration = 0;
      }
      
      if (callDuration < 0) {
        errors.push('Invalid call duration (negative value)');
        callDuration = 0;
      }
    }
    
    // Validate phone numbers (lenient check)
    const phoneRegex = /^\+?[\d\s\-\(\)\.]+$/;
    if (callerNumber && !phoneRegex.test(callerNumber.replace(/\s/g, ''))) {
      errors.push('Invalid caller number format');
    }
    if (calleeNumber && !phoneRegex.test(calleeNumber.replace(/\s/g, ''))) {
      errors.push('Invalid callee number format');
    }
    
    // Generate unique ID
    const id = cdr.id || `cdr_${Date.now()}_${index}`;
    
    // Safe date conversion
    let isoStartTime;
    try {
      isoStartTime = startTime.toISOString();
    } catch (error) {
      isoStartTime = new Date().toISOString();
      errors.push('Start time conversion error');
    }
    
    // Calculate charges if not provided
    let rate = parseFloat(cdr.rate || 0.01);
    let fee = feeAmount;
    let tax = taxAmount;
    let total = fee + tax;
    
    // If fee is 0 but we have duration, calculate it
    if (fee === 0 && callDuration > 0) {
      fee = callDuration * rate;
      tax = fee * 0.18; // Default tax rate
      total = fee + tax;
    }
    
    // Map your CDR fields to our standardized format
    return {
      // Original fields
      ...cdr,
      
      // Standardized fields for our system
      id,
      callere164: callerNumber,
      calleee164: calleeNumber,
      starttime: isoStartTime,
      duration: callDuration,
      status: callStatus,
      call_type: determineCallType(cdr.callertype || cdr.calleetype || 'VOICE'),
      call_direction: callDirection,
      customer_id: customerId,
      customer_name: customerName,
      rate: rate,
      fee: parseFloat(fee.toFixed(4)),
      tax: parseFloat(tax.toFixed(4)),
      total: parseFloat(total.toFixed(4)),
      
      // Additional useful fields from your CDR
      stoptime: stopTime ? stopTime.toISOString() : '',
      callerip: cdr.callerip || '',
      calleeip: cdr.calleeip || '',
      endreason: cdr.endreason || '',
      flowid: cdr.flowno || cdr.flownofirst || '',
      softswitch_id: cdr.softswitchname || '',
      call_id: cdr.softswitchcallid || cdr.callercallid || '',
      
      // Validation results
      errors: errors.length > 0 ? errors : null,
    };
  });
};

// Helper function to calculate duration from start and stop times
const calculateDuration = (startStr, stopStr) => {
  try {
    const start = parseDateSafely(startStr);
    const stop = parseDateSafely(stopStr);
    
    if (isNaN(start.getTime()) || isNaN(stop.getTime())) {
      return 0;
    }
    
    const durationMs = stop - start;
    return durationMs > 0 ? Math.floor(durationMs / 1000) : 0;
  } catch (error) {
    return 0;
  }
};

// Helper function to determine call status from endreason
const determineCallStatus = (endreason) => {
  if (!endreason) return 'UNKNOWN';
  
  const reason = endreason.toString().toUpperCase();
  
  if (reason.includes('ANSWER') || reason.includes('SUCCESS') || reason.includes('NORMAL')) {
    return 'ANSWERED';
  }
  
  if (reason.includes('NO_ANSWER') || reason.includes('NOANSWER') || reason.includes('NO ANSWER')) {
    return 'NO_ANSWER';
  }
  
  if (reason.includes('BUSY')) {
    return 'BUSY';
  }
  
  if (reason.includes('FAIL') || reason.includes('ERROR') || reason.includes('REJECT')) {
    return 'FAILED';
  }
  
  if (reason.includes('CANCEL')) {
    return 'CANCELLED';
  }
  
  return 'UNKNOWN';
};

// Helper function to determine call direction
const determineCallDirection = (directionInfo) => {
  if (!directionInfo) return 'OUTBOUND';
  
  const info = directionInfo.toString().toUpperCase();
  
  if (info.includes('IN') || info.includes('RECEIVE') || info.includes('TERMINAT')) {
    return 'INBOUND';
  }
  
  if (info.includes('OUT') || info.includes('ORIGINAT') || info.includes('DIAL')) {
    return 'OUTBOUND';
  }
  
  return 'OUTBOUND';
};

// Helper function to determine call type
const determineCallType = (callType) => {
  if (!callType) return 'VOICE';
  
  const type = callType.toString().toUpperCase();
  
  if (type.includes('VOICE') || type.includes('CALL')) {
    return 'VOICE';
  }
  
  if (type.includes('SMS') || type.includes('TEXT') || type.includes('MESSAGE')) {
    return 'SMS';
  }
  
  if (type.includes('DATA') || type.includes('MMS') || type.includes('VIDEO')) {
    return 'DATA';
  }
  
  return 'VOICE';
};

export const calculateCDRCharges = (cdr, ratePlan) => {
  const duration = parseInt(cdr.duration) || 0;
  const rate = ratePlan?.rate || cdr.rate || 0.01;
  const taxRate = ratePlan?.taxRate || 0.18;
  
  const fee = duration * rate;
  const tax = fee * taxRate;
  const total = fee + tax;

  return {
    ...cdr,
    rate,
    fee: parseFloat(fee.toFixed(4)),
    tax: parseFloat(tax.toFixed(4)),
    total: parseFloat(total.toFixed(4)),
  };
};

export const getCDRSummary = (cdrs) => {
  if (!cdrs || cdrs.length === 0) {
    return {
      totalCalls: 0,
      totalDuration: 0,
      totalRevenue: 0,
      totalTax: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
    };
  }

  const successfulCalls = cdrs.filter(c => c.status === 'ANSWERED').length;
  const totalDuration = cdrs.reduce((sum, c) => sum + (parseInt(c.duration) || 0), 0);
  const totalRevenue = cdrs.reduce((sum, c) => sum + (parseFloat(c.fee) || 0), 0);
  const totalTax = cdrs.reduce((sum, c) => sum + (parseFloat(c.tax) || 0), 0);

  return {
    totalCalls: cdrs.length,
    totalDuration,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalTax: parseFloat(totalTax.toFixed(2)),
    successfulCalls,
    failedCalls: cdrs.length - successfulCalls,
    successRate: ((successfulCalls / cdrs.length) * 100).toFixed(1),
    averageDuration: Math.floor(totalDuration / cdrs.length),
    averageRevenue: parseFloat((totalRevenue / cdrs.length).toFixed(4)),
  };
};

// New function to get CDR field mapping for your format
export const getCDRFieldMapping = () => {
  return {
    // Essential fields
    id: 'id',
    callere164: 'callere164',
    calleee164: 'calleee164',
    starttime: 'starttime',
    duration: 'duration',
    status: 'endreason',
    
    // Billing fields
    fee: 'fee',
    tax: 'tax',
    incomefee: 'incomefee',
    incometax: 'incometax',
    
    // Customer fields
    customer_id: 'customeraccount',
    customer_name: 'customername',
    
    // Technical fields
    callerip: 'callerip',
    calleeip: 'calleeip',
    softswitch_id: 'softswitchname',
    call_id: 'softswitchcallid',
    flowid: 'flowno',
    
    // Additional useful fields
    stoptime: 'stoptime',
    callertype: 'callertype',
    calleetype: 'calleetype',
    enddirection: 'enddirection',
    endreason: 'endreason',
    billingtype: 'billingtype',
  };
};