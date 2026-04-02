const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reports.controller');

// Hourly report
router.post('/hourly-report', reportController.hourlyReport);

// Margin report
router.post('/margin-report', reportController.marginReport);

// Customer-to-vendor traffic report (existing behaviour)
router.post('/customer-traffic', reportController.customerTrafficReport);

// Customer-only traffic (aggregate by customer and origin country)
router.post('/customer-only-traffic', reportController.customerOnlyTrafficReport);

// Vendor-only traffic (aggregate by vendor and destination country)
router.post('/vendor-traffic', reportController.vendorTrafficReport);

// Negative margin report
router.post('/negative-margin-report', reportController.negativeMarginReport);

// Get accounts for report filters
router.get('/accounts', reportController.getReportAccounts);

// Account exposure summary from CDRs (non-invoice based)
router.post('/account-exposure', reportController.getAccountExposure);

// Export report
router.post('/export-report', reportController.exportReport);

// Export SOA
router.post('/export-soa', reportController.exportSOA);

// Send SOA Email
router.post('/send-soa-email', reportController.sendSOAEmail);

module.exports = router;