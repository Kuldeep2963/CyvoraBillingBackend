import { addDays, startOfMonth, endOfMonth, format } from 'date-fns';

export const calculateCallCharges = (duration, rate, taxRate = 0.18) => {
  const fee = duration * rate;
  const tax = fee * taxRate;
  const total = fee + tax;
  
  return {
    fee: parseFloat(fee.toFixed(4)),
    tax: parseFloat(tax.toFixed(4)),
    total: parseFloat(total.toFixed(4)),
  };
};
// Add this function to src/utils/calculations.js
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

  const successfulCalls = cdrs.filter(c => parseInt(c.feetime) > 0).length;
  const totalDuration = cdrs.reduce((sum, c) => sum + (parseInt(c.feetime) || 0), 0);
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

export const calculateInvoice = (customerCdrs, customer) => {
  const rate = customer?.rate || 0.01;
  const taxRate = customer?.taxRate || 0.18;
  
  const callSummary = customerCdrs.reduce((summary, cdr) => {
    const charges = calculateCallCharges(parseInt(cdr.feetime), rate, taxRate);
    
    return {
      totalCalls: summary.totalCalls + 1,
      totalDuration: summary.totalDuration + parseInt(cdr.feetime),
      totalFee: summary.totalFee + charges.fee,
      totalTax: summary.totalTax + charges.tax,
      totalAmount: summary.totalAmount + charges.total,
      answeredCalls: summary.answeredCalls + (parseInt(cdr.feetime) > 0 ? 1 : 0),
    };
  }, {
    totalCalls: 0,
    totalDuration: 0,
    totalFee: 0,
    totalTax: 0,
    totalAmount: 0,
    answeredCalls: 0,
  });

  return {
    customerId: customer?.id,
    customerName: customer?.name,
    periodStart: startOfMonth(new Date()),
    periodEnd: endOfMonth(new Date()),
    invoiceDate: new Date(),
    dueDate: addDays(new Date(), 30),
    ...callSummary,
    rate,
    taxRate,
  };
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);
};

export const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);
  
  return parts.join(' ');
};

export const calculateTax = (amount, taxRate = 0.18) => {
  return parseFloat((amount * taxRate).toFixed(4));
};

export const groupByCustomer = (cdrs) => {
  return cdrs.reduce((groups, cdr) => {
    const customerId = cdr.customeraccount || 'unknown';
    if (!groups[customerId]) {
      groups[customerId] = {
        customerId,
        customerName: cdr.customername || 'Unknown Customer',
        cdrs: [],
        totalCalls: 0,
        totalDuration: 0,
        totalRevenue: 0,
      };
    }
    
    groups[customerId].cdrs.push(cdr);
    groups[customerId].totalCalls++;
    groups[customerId].totalDuration += parseInt(cdr.feetime) || 0;
    groups[customerId].totalRevenue += parseFloat(cdr.fee) || 0;
    
    return groups;
  }, {});
};