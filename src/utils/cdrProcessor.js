// utils/cdrProcessor.js

/**
 * CDR Processor Utility
 * Handles processing, validation, and transformation of CDR data
 */

const CDRProcessor = {
  /**
   * Process raw CDR data from CSV parsing
   * @param {Array} rawCDRs - Raw CDR data from CSV
   * @returns {Object} Processed results with CDRs and errors
   */
  processRawCDRs: (rawCDRs) => {
    const processedCDRs = [];
    const errors = [];
    
    rawCDRs.forEach((record, index) => {
      try {
        const processedCDR = processSingleCDR(record, index + 2); // +2 for header and 1-based index
        
        // Validate required fields
        const validationErrors = validateCDR(processedCDR);
        
        if (validationErrors.length > 0) {
          errors.push({
            row: index + 2,
            errors: validationErrors,
            data: record
          });
        } else {
          processedCDRs.push(processedCDR);
        }
      } catch (error) {
        errors.push({
          row: index + 2,
          errors: [error.message],
          data: record
        });
      }
    });

    return {
      processedCDRs,
      errors,
      totalProcessed: processedCDRs.length,
      totalErrors: errors.length
    };
  },

  /**
   * Process CDR from file content (for auto-fetch)
   * @param {Array} rawData - Raw data from CSV content
   * @returns {Object} Processed results
   */
  processFromFileContent: (rawData) => {
    return CDRProcessor.processRawCDRs(rawData);
  },

  /**
   * Extract unique customers from processed CDRs
   * @param {Array} cdrs - Processed CDR data
   * @returns {Array} Unique customers with their details
   */
  extractCustomers: (cdrs) => {
    const customerMap = new Map();
    
    cdrs.forEach(cdr => {
      if (cdr.customer_id && cdr.customer_id.trim() !== '') {
        const customerId = cdr.customer_id.trim();
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            id: customerId,
            phone_number: cdr.callere164 || '',
            total_calls: 0,
            answered_calls: 0,
            total_duration: 0,
            total_charges: 0,
            total_tax: 0,
            last_call: cdr.starttime || new Date().toISOString(),
            first_seen: cdr.starttime || new Date().toISOString(),
            call_types: new Set()
          });
        }
        
        const customer = customerMap.get(customerId);
        customer.total_calls += 1;
        
        if (cdr.status === 'ANSWERED') {
          customer.answered_calls += 1;
        }
        
        customer.total_duration += cdr.duration || 0;
        customer.total_charges += cdr.fee || 0;
        customer.total_tax += cdr.tax || 0;
        
        if (cdr.call_type) {
          customer.call_types.add(cdr.call_type);
        }
        
        // Update last call timestamp
        if (cdr.starttime) {
          const callTime = new Date(cdr.starttime);
          const lastCallTime = new Date(customer.last_call || 0);
          
          if (callTime > lastCallTime) {
            customer.last_call = cdr.starttime;
          }
          
          // Update first seen if earlier
          const firstSeenTime = new Date(customer.first_seen || Date.now());
          if (callTime < firstSeenTime) {
            customer.first_seen = cdr.starttime;
          }
        }
      }
    });

    // Convert Set to Array for call_types
    return Array.from(customerMap.values()).map(customer => ({
      ...customer,
      call_types: Array.from(customer.call_types),
      answer_rate: customer.total_calls > 0 
        ? ((customer.answered_calls / customer.total_calls) * 100).toFixed(2)
        : 0,
      avg_call_duration: customer.answered_calls > 0
        ? Math.round(customer.total_duration / customer.answered_calls)
        : 0
    }));
  },

  /**
   * Calculate call charges based on call type, duration, and customer
   * @param {Object} cdr - CDR data
   * @param {Object} customer - Customer data (optional)
   * @returns {Object} CDR with calculated fees and tax
   */
  calculateCharges: (cdr, customer = null) => {
    // Clone the CDR to avoid mutation
    const processedCDR = { ...cdr };
    
    // Default rates (customize these based on your business rules)
    const rates = {
      INTERNATIONAL: {
        perMinute: 0.05,
        perSecond: 0.05 / 60,
        setupFee: 0.10,
        taxRate: 0.18 // 18%
      },
      NATIONAL: {
        perMinute: 0.02,
        perSecond: 0.02 / 60,
        setupFee: 0.05,
        taxRate: 0.18
      },
      LOCAL: {
        perMinute: 0.01,
        perSecond: 0.01 / 60,
        setupFee: 0.02,
        taxRate: 0.18
      },
      DEFAULT: {
        perMinute: 0.03,
        perSecond: 0.03 / 60,
        setupFee: 0.05,
        taxRate: 0.18
      }
    };
    
    // Determine call type
    const callType = processedCDR.call_type?.toUpperCase() || 'NATIONAL';
    const rate = rates[callType] || rates.DEFAULT;
    
    // Calculate duration in minutes
    const duration = processedCDR.duration || 0;
    const durationMinutes = duration / 60;
    
    // Calculate base charge
    let baseCharge = 0;
    
    if (duration > 0 && processedCDR.status === 'ANSWERED') {
      // Per-second billing
      baseCharge = duration * rate.perSecond;
      
      // Add setup fee for connected calls
      baseCharge += rate.setupFee;
      
      // Apply customer-specific rates if available
      if (customer && customer.rate_plan) {
        // Apply custom rates based on customer's plan
        baseCharge = applyCustomerRates(baseCharge, customer, duration);
      }
    }
    
    // Calculate tax
    const tax = baseCharge * rate.taxRate;
    
    // Total charge
    const totalCharge = baseCharge + tax;
    
    // Add calculated fields
    processedCDR.base_fee = parseFloat(baseCharge.toFixed(4));
    processedCDR.tax = parseFloat(tax.toFixed(4));
    processedCDR.fee = parseFloat(totalCharge.toFixed(4));
    processedCDR.currency = 'USD';
    processedCDR.billing_status = 'PENDING';
    processedCDR.processed_at = new Date().toISOString();
    
    // Determine if call is billable
    processedCDR.billable = processedCDR.status === 'ANSWERED' && duration > 0;
    
    return processedCDR;
  },

  /**
   * Generate statistics from CDR data
   * @param {Array} cdrs - Processed CDR data
   * @returns {Object} Statistics object
   */
  generateStatistics: (cdrs) => {
    const totalCalls = cdrs.length;
    const answeredCalls = cdrs.filter(c => c.status === 'ANSWERED').length;
    const failedCalls = cdrs.filter(c => c.status === 'FAILED').length;
    const busyCalls = cdrs.filter(c => c.status === 'BUSY').length;
    const noAnswerCalls = cdrs.filter(c => c.status === 'NO_ANSWER').length;
    
    const totalDuration = cdrs.reduce((sum, c) => sum + (c.duration || 0), 0);
    const totalRevenue = cdrs.reduce((sum, c) => sum + (c.fee || 0), 0);
    const totalTax = cdrs.reduce((sum, c) => sum + (c.tax || 0), 0);
    
    const uniqueCustomers = new Set(cdrs.map(c => c.customer_id).filter(id => id)).size;
    const uniqueCallers = new Set(cdrs.map(c => c.callere164).filter(num => num)).size;
    const uniqueCallees = new Set(cdrs.map(c => c.calleee164).filter(num => num)).size;
    
    // Call type distribution
    const callTypes = cdrs.reduce((acc, cdr) => {
      const type = cdr.call_type || 'UNKNOWN';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    // Hourly distribution
    const hourlyDistribution = cdrs.reduce((acc, cdr) => {
      if (cdr.starttime) {
        const hour = new Date(cdr.starttime).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
      }
      return acc;
    }, {});
    
    return {
      summary: {
        totalCalls,
        answeredCalls,
        failedCalls,
        busyCalls,
        noAnswerCalls,
        answerRate: totalCalls > 0 ? (answeredCalls / totalCalls * 100).toFixed(2) : 0,
        avgDuration: answeredCalls > 0 ? Math.round(totalDuration / answeredCalls) : 0,
        totalDuration,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalTax: parseFloat(totalTax.toFixed(2)),
        totalAmount: parseFloat((totalRevenue + totalTax).toFixed(2)),
        uniqueCustomers,
        uniqueCallers,
        uniqueCallees
      },
      distribution: {
        callTypes,
        hourlyDistribution,
        statusDistribution: {
          ANSWERED: answeredCalls,
          FAILED: failedCalls,
          BUSY: busyCalls,
          NO_ANSWER: noAnswerCalls
        }
      },
      timeline: {
        firstCall: cdrs.length > 0 ? 
          new Date(Math.min(...cdrs.map(c => new Date(c.starttime || Date.now())))) : null,
        lastCall: cdrs.length > 0 ? 
          new Date(Math.max(...cdrs.map(c => new Date(c.starttime || Date.now())))) : null
      }
    };
  },

  /**
   * Format CDR for database storage
   * @param {Object} cdr - Processed CDR data
   * @returns {Object} Database-ready CDR object
   */
  formatForDatabase: (cdr) => {
    return {
      flowno: cdr.flowno || generateFlowNo(),
      callere164: cdr.callere164 || '',
      calleee164: cdr.calleee164 || '',
      starttime: cdr.starttime || new Date().toISOString(),
      stoptime: cdr.stoptime || new Date().toISOString(),
      duration: cdr.duration || 0,
      call_type: cdr.call_type || 'NATIONAL',
      status: cdr.status || 'FAILED',
      customer_id: cdr.customer_id || null,
      direction: cdr.direction || 'OUTBOUND',
      hangup_cause: cdr.hangup_cause || 'NORMAL_CLEARING',
      base_fee: cdr.base_fee || 0,
      tax: cdr.tax || 0,
      fee: cdr.fee || 0,
      currency: cdr.currency || 'USD',
      billable: cdr.billable || false,
      billing_status: cdr.billing_status || 'PENDING',
      processed_at: cdr.processed_at || new Date().toISOString(),
      raw_data: cdr.raw_data || null,
      validation_errors: cdr.validation_errors || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  /**
   * Track processed files to avoid duplicates
   */
  processedFiles: {
    add: (filename) => {
      try {
        const files = JSON.parse(localStorage.getItem('processedFiles') || '[]');
        if (!files.includes(filename)) {
          files.push({
            filename,
            timestamp: new Date().toISOString(),
            processedAt: new Date().toISOString()
          });
          // Keep only last 100 files
          localStorage.setItem('processedFiles', JSON.stringify(files.slice(-100)));
        }
      } catch (error) {
        console.error('Error tracking processed file:', error);
      }
    },
    
    has: (filename) => {
      try {
        const files = JSON.parse(localStorage.getItem('processedFiles') || '[]');
        return files.some(file => file.filename === filename);
      } catch (error) {
        console.error('Error checking processed file:', error);
        return false;
      }
    },
    
    clear: () => {
      try {
        localStorage.removeItem('processedFiles');
      } catch (error) {
        console.error('Error clearing processed files:', error);
      }
    },
    
    getAll: () => {
      try {
        return JSON.parse(localStorage.getItem('processedFiles') || '[]');
      } catch (error) {
        console.error('Error getting processed files:', error);
        return [];
      }
    }
  }
};

// Helper functions (not exported)
function processSingleCDR(rawRecord, rowNumber) {
  // Extract and transform fields
  const cdr = {
    // Required fields
    flowno: rawRecord.flow_number || rawRecord.flowno || rawRecord.FlowNo || '',
    callere164: rawRecord.caller || rawRecord.callere164 || rawRecord.source || '',
    calleee164: rawRecord.callee || rawRecord.calleee164 || rawRecord.destination || '',
    
    // Timestamps
    starttime: parseTimestamp(rawRecord.start_time || rawRecord.starttime || rawRecord.StartTime),
    stoptime: parseTimestamp(rawRecord.end_time || rawRecord.stoptime || rawRecord.EndTime),
    
    // Duration
    duration: parseInt(rawRecord.duration || rawRecord.Duration || 0, 10),
    
    // Call metadata
    call_type: determineCallType(
      rawRecord.call_type || rawRecord.type || rawRecord.callType || 'NATIONAL'
    ),
    status: normalizeStatus(rawRecord.status || rawRecord.call_status || 'FAILED'),
    direction: rawRecord.direction || 'OUTBOUND',
    hangup_cause: rawRecord.hangup_cause || rawRecord.disconnect_reason || 'NORMAL_CLEARING',
    
    // Customer identification
    customer_id: extractCustomerId(
      rawRecord.customer_id || rawRecord.customer || rawRecord.account || ''
    ),
    
    // Original data for reference
    raw_data: rawRecord,
    source_row: rowNumber
  };
  
  // Calculate derived fields
  cdr.call_date = cdr.starttime ? cdr.starttime.split('T')[0] : null;
  cdr.call_hour = cdr.starttime ? new Date(cdr.starttime).getHours() : null;
  
  return cdr;
}

function parseTimestamp(timestamp) {
  if (!timestamp) return new Date().toISOString();
  
  try {
    // Try various timestamp formats
    const date = new Date(timestamp);
    
    // If timestamp is a number (Unix timestamp in milliseconds or seconds)
    if (!isNaN(timestamp) && timestamp > 0) {
      const num = parseInt(timestamp, 10);
      if (num < 10000000000) {
        // Probably seconds, convert to milliseconds
        return new Date(num * 1000).toISOString();
      } else {
        // Probably milliseconds
        return new Date(num).toISOString();
      }
    }
    
    // If date is invalid, return current time
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('Error parsing timestamp:', timestamp, error);
    return new Date().toISOString();
  }
}

function determineCallType(rawType) {
  const type = (rawType || '').toString().toUpperCase();
  
  if (type.includes('INTERNATIONAL') || type.includes('INTL')) {
    return 'INTERNATIONAL';
  } else if (type.includes('NATIONAL') || type.includes('NAT')) {
    return 'NATIONAL';
  } else if (type.includes('LOCAL')) {
    return 'LOCAL';
  } else if (type.includes('TOLL')) {
    return 'TOLL_FREE';
  } else if (type.includes('MOBILE')) {
    return 'MOBILE';
  }
  
  // Default based on number pattern
  return 'NATIONAL';
}

function normalizeStatus(status) {
  const normalized = (status || '').toString().toUpperCase();
  
  const statusMap = {
    'ANSWERED': 'ANSWERED',
    'CONNECTED': 'ANSWERED',
    'SUCCESS': 'ANSWERED',
    'FAILED': 'FAILED',
    'FAILURE': 'FAILED',
    'BUSY': 'BUSY',
    'NO_ANSWER': 'NO_ANSWER',
    'NOANSWER': 'NO_ANSWER',
    'CANCEL': 'CANCELLED',
    'CANCELLED': 'CANCELLED',
    'TIMEOUT': 'TIMEOUT',
    'REJECTED': 'REJECTED'
  };
  
  return statusMap[normalized] || 'FAILED';
}

function extractCustomerId(customerField) {
  if (!customerField) return null;
  
  // Try to extract customer ID from various formats
  const str = customerField.toString().trim();
  
  // If it's already a simple ID
  if (str.length <= 50 && /^[a-zA-Z0-9_\-]+$/.test(str)) {
    return str;
  }
  
  // Try to extract from email
  const emailMatch = str.match(/^([^@]+)@/);
  if (emailMatch) {
    return emailMatch[1];
  }
  
  // Try to extract from patterns like "Customer Name (ID: 123)"
  const patternMatch = str.match(/\(ID:\s*([^)]+)\)/);
  if (patternMatch) {
    return patternMatch[1].trim();
  }
  
  // Use a hash as fallback
  return hashString(str).substring(0, 20);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

function validateCDR(cdr) {
  const errors = [];
  
  // Required field validation
  if (!cdr.flowno || cdr.flowno.trim() === '') {
    errors.push('Missing flow number');
  }
  
  if (!cdr.callere164 || cdr.callere164.trim() === '') {
    errors.push('Missing caller number');
  }
  
  if (!cdr.calleee164 || cdr.calleee164.trim() === '') {
    errors.push('Missing callee number');
  }
  
  if (!cdr.starttime) {
    errors.push('Missing start time');
  }
  
  // Data type validation
  if (cdr.duration < 0) {
    errors.push('Invalid duration (negative value)');
  }
  
  if (cdr.duration > 86400) { // More than 24 hours
    errors.push('Duration too long (over 24 hours)');
  }
  
  // Date validation
  if (cdr.starttime && cdr.stoptime) {
    const start = new Date(cdr.starttime);
    const end = new Date(cdr.stoptime);
    
    if (isNaN(start.getTime())) {
      errors.push('Invalid start time format');
    }
    
    if (isNaN(end.getTime())) {
      errors.push('Invalid end time format');
    }
    
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (end < start) {
        errors.push('End time is before start time');
      }
      
      const calculatedDuration = Math.round((end - start) / 1000);
      if (Math.abs(calculatedDuration - cdr.duration) > 10) { // 10 second tolerance
        errors.push('Duration does not match start/end times');
      }
    }
  }
  
  return errors;
}

function applyCustomerRates(baseCharge, customer, duration) {
  // Apply customer-specific rate adjustments
  // You can implement custom logic here based on customer plans
  
  switch (customer.rate_plan) {
    case 'PREMIUM':
      return baseCharge * 0.8; // 20% discount
    case 'ENTERPRISE':
      return baseCharge * 0.7; // 30% discount
    case 'BASIC':
    default:
      return baseCharge;
  }
}

function generateFlowNo() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `FLOW-${timestamp}-${random}`;
}

export default CDRProcessor;