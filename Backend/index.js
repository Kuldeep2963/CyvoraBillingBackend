const express = require('express');
const cors = require('cors');
const sequelize = require('./models/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const accountRoutes = require('./routes/accounts');
const cdrRoutes = require('./routes/cdr');
const reportRoutes = require('./routes/reports');
const billingRoutes = require('./routes/billing');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const vendorInvoiceRoutes = require('./routes/vendorInvoices');
const authMiddleware = require('./middleware/auth');
const uploadCdr = require('./api/upload-cdr');
const CDRAutoFetcher = require('./services/cdr-auto-fetch');
const BillingScheduler = require('./schedulers/BillingScheduler');

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

// Public Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);

// Protected Routes
app.use('/api/accounts', authMiddleware, accountRoutes);
app.use('/api/customers', authMiddleware, accountRoutes);
app.use('/api/customer', authMiddleware, accountRoutes);
app.use('/api/cdr', authMiddleware, cdrRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/billing', authMiddleware, billingRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/vendor-invoices', authMiddleware, vendorInvoiceRoutes);
app.post('/api/upload-cdr', authMiddleware, uploadCdr);

// 404 Handler
app.use((req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// DB + Server
require('./models/Allocation');
require('./models/Dispute');
sequelize.sync().then(() => {
  console.log('Database synced successfully');

  new CDRAutoFetcher();
  new BillingScheduler();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('DB connection error:', err);
});
