const express = require('express');
const cors = require('cors');
const sequelize = require('./models/db');
require('dotenv').config();

const accountRoutes = require('./routes/accounts');
const cdrRoutes = require('./routes/cdr');
const reportRoutes = require('./routes/reports');
const billingRoutes = require('./routes/billing');
const dashboardRoutes = require('./routes/dashboard');
const uploadCdr = require('./api/upload-cdr');
const CDRAutoFetcher = require('./services/cdr-auto-fetch');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.BASE_API_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/customers', accountRoutes);
app.use('/api/customer', accountRoutes);
app.use('/api/cdr', cdrRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.post('/api/upload-cdr', uploadCdr);

// 404 Handler
app.use((req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// DB + Server
require('./models/Allocation');
sequelize.sync().then(() => {
  console.log('Database synced successfully');

  new CDRAutoFetcher();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('DB connection error:', err);
});
