const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reports.controller');

// Hourly report
router.post('/hourly-report', reportController.hourlyReport);

// Margin report
router.post('/margin-report', reportController.marginReport);

// Customer traffic report
router.post('/customer-traffic', reportController.customerTrafficReport);

// Negative margin report
router.post('/negative-margin-report', reportController.negativeMarginReport);

// Debug mapping endpoint
// router.post('/debug-mapping', reportController.debugMapping);

// Get accounts for report filters
router.get('/accounts', reportController.getReportAccounts);

// Export report
router.post('/export-report', reportController.exportReport);

module.exports = router;