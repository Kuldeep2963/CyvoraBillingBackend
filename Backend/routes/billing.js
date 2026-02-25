const express = require('express');
const router = express.Router();
const billingController = require('../controllers/Billingcontroller');

// Middleware for authentication (add your auth middleware)
// const { authenticate } = require('../middleware/auth');
// router.use(authenticate);

/* ===================== INVOICE ROUTES ===================== */

// Generate invoice from CDR data
router.post('/invoices/generate', billingController.generateInvoice);

// Get lite invoices (minimal fields, no items)
router.get('/invoices/lite', billingController.getLiteInvoices);

// Get all invoices (with filters)
router.get('/invoices', billingController.getAllInvoices);

// Get single invoice
router.get('/invoices/:id', billingController.getInvoiceById);

// Download invoice PDF
router.get('/invoices/:id/download', billingController.downloadInvoice);

// Get invoice items
router.get('/invoices/:id/items', billingController.getInvoiceItems);

// Update invoice
router.put('/invoices/:id', billingController.updateInvoice);

// Delete invoice
router.delete('/invoices/:id', billingController.deleteInvoice);

/* ===================== PAYMENT ROUTES ===================== */

// Record payment
router.post('/payments', billingController.recordPayment);

// Get all payments
router.get('/payments', billingController.getAllPayments);

/* ===================== CUSTOMER OUTSTANDING ROUTES ===================== */

// Get customer outstanding balance
router.get('/customers/:customerId/outstanding', billingController.getCustomerOutstanding);

/* ===================== REPORTS ROUTES ===================== */

// Get aging report
router.get('/reports/aging', billingController.getAgingReport);

// Get vendor usage for periods
router.post('/vendor-usage', billingController.getVendorUsage);

module.exports = router;