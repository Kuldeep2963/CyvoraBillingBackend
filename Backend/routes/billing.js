const express = require('express');
const router = express.Router();
const billingController = require('../controllers/BillingController');

// Middleware for authentication (add your auth middleware)
// const { authenticate } = require('../middleware/auth');
// router.use(authenticate);

/* ===================== INVOICE ROUTES ===================== */

// Generate invoice from CDR data
router.post('/invoices/generate', billingController.generateInvoice);

// Get all invoices (with filters)
router.get('/invoices', billingController.getAllInvoices);

// Get single invoice
router.get('/invoices/:id', billingController.getInvoiceById);

// Update invoice
router.put('/invoices/:id', billingController.updateInvoice);

// Delete invoice
router.delete('/invoices/:id', billingController.deleteInvoice);

/* ===================== PAYMENT ROUTES ===================== */

// Record payment
router.post('/payments', billingController.recordPayment);

/* ===================== CUSTOMER OUTSTANDING ROUTES ===================== */

// Get customer outstanding balance
router.get('/customers/:customerId/outstanding', billingController.getCustomerOutstanding);

/* ===================== REPORTS ROUTES ===================== */

// Get aging report
router.get('/reports/aging', billingController.getAgingReport);

module.exports = router;