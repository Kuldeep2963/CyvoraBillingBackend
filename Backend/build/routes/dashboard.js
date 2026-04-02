const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

router.get('/stats', dashboardController.getDashboardStats);
router.get('/top-destinations', dashboardController.getTopDestinations);

module.exports = router;
