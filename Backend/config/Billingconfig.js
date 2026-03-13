/**
 * Billing System Configuration
 * 
 * Centralized configuration for billing and invoicing
 */

module.exports = {
  // Tax Settings
  tax: {
    defaultRate: 18, // Default tax rate percentage
    enabled: true
  },

  // Payment Terms
  payment: {
    defaultDueInDays: 30,
    gracePeriodDays: 5, // Days after due date before marking overdue
    lateFeePercentage: 2, // Late fee if implemented
    earlyPaymentDiscountPercentage: 2 // Early payment discount if implemented
  },

  // Currency
  currency: {
    default: 'USD',
    symbol: '$',
    decimalPlaces: 2
  },

  // Invoice Numbering
  invoiceNumbering: {
    prefix: 'INV',
    format: 'INV-YYYY-MM-NNNN', // Year-Month-Sequential
    resetMonthly: true // Reset sequence each month
  },

  // Payment Numbering
  paymentNumbering: {
    prefix: 'PAY',
    format: 'PAY-YYYY-MM-NNNN'
  },

  // Receipt Numbering
  receiptNumbering: {
    prefix: 'RCP',
    format: 'RCP-YYYY-MM-NNNN'
  },

  // Payment Methods
  paymentMethods: [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'ustd', label: 'USTD' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'stripe', label: 'Stripe' },
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Other' }
  ],

  // Invoice Status
  invoiceStatus: [
    { value: 'draft', label: 'Draft', color: 'gray' },
    { value: 'pending', label: 'Pending', color: 'yellow' },
    { value: 'sent', label: 'Sent', color: 'blue' },
    { value: 'paid', label: 'Paid', color: 'green' },
    { value: 'partial', label: 'Partial', color: 'orange' },
    { value: 'overdue', label: 'Overdue', color: 'red' },
    { value: 'cancelled', label: 'Cancelled', color: 'gray' },
    { value: 'void', label: 'Void', color: 'gray' }
  ],

  // Email Settings (for future implementation)
  email: {
    fromEmail: 'billing@yourcompany.com',
    fromName: 'Your Company Billing',
    replyTo: 'support@yourcompany.com',
    
    // Email triggers
    sendInvoiceOnGenerate: false, // Automatically send invoice when generated
    sendReceiptOnPayment: true, // Automatically send receipt when payment recorded
    sendReminderBeforeDue: true, // Send reminder before due date
    sendOverdueNotice: true, // Send notice when invoice becomes overdue
    
    // Reminder schedule
    reminderDaysBefore: 3, // Days before due date to send reminder
    overdueReminderDays: [7, 14, 30] // Days after due to send overdue reminders
  },

  // PDF Settings (for future implementation)
  pdf: {
    enabled: true,
    template: 'default', // Template name
    logo: '/assets/logo.png',
    companyInfo: {
      name: 'Pai Telecomm',
      address: '123 Business Street\nCity, State 12345',
      phone: '+1-234-567-8900',
      email: 'billing@paitelecomm.com',
      website: 'www.paitelecomm.com',
      taxId: 'TAX-123456789'
    },
    footer: 'Thank you for your business!',
    termsAndConditions: 'Payment is due within 30 days. Late payments may incur additional charges.'
  },

  // Billing Periods
  billingPeriods: [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ],

  // Aging Report Buckets
  agingBuckets: [
    { label: 'Current', days: 0 },
    { label: '1-30 Days', days: 30 },
    { label: '31-60 Days', days: 60 },
    { label: '61-90 Days', days: 90 },
    { label: '90+ Days', days: 91 }
  ],

  // Scheduler Settings
  scheduler: {
    monthlyBillingEnabled: true,
    monthlyBillingSchedule: '0 2 1 * *', // 1st of month at 2 AM
    
    overdueCheckEnabled: true,
    overdueCheckSchedule: '0 1 * * *', // Daily at 1 AM
    
    paymentRemindersEnabled: true,
    paymentRemindersSchedule: '0 9 * * *', // Daily at 9 AM
    
    agingReportEnabled: true,
    agingReportSchedule: '0 8 * * 1' // Mondays at 8 AM
  },

  // CDR Aggregation Settings
  cdr: {
    groupByDestination: true, // Group calls by destination country
    skipVendorPrefixDigits: 5, // Skip first 5 digits for vendor destinations
    
    // Rounding settings
    roundDuration: 'up', // 'up', 'down', 'nearest'
    roundingIncrement: 6, // Round to nearest 6 seconds
    
    // Minimum call duration for billing (in seconds)
    minimumBillableSeconds: 0
  },

  // Feature Flags
  features: {
    recurringInvoices: false,
    creditNotes: false,
    multiCurrency: false,
    taxExemptions: false,
    paymentPlans: false,
    autoPayment: false
  },

  // Validation Rules
  validation: {
    maxInvoiceAmount: 1000000, // Maximum invoice amount
    maxPaymentAmount: 1000000, // Maximum single payment
    requirePaymentReference: false,
    requireInvoiceNotes: false
  },

  // Reporting
  reporting: {
    defaultPageSize: 50,
    maxPageSize: 500,
    exportFormats: ['pdf', 'excel', 'csv'],
    defaultDateRange: 30 // Days
  }
};