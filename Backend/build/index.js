const express = require('express');
const cors = require('cors');
const sequelize = require('./models/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Load all models first to ensure associations are properly set up
require('./models/User');
require('./models/Account');
require('./models/CDR');
require('./models/Invoice');
require('./models/InvoiceItem');
require('./models/Payment');
require('./models/PaymentAllocation');
require('./models/Allocation');
require('./models/Dispute');
require('./models/CountryCode');
require('./models/Vendorinvoice');
require('./models/SystemSetting');
require('./models/Notification');

const accountRoutes = require('./routes/accounts');
const cdrRoutes = require('./routes/cdr');
const reportRoutes = require('./routes/reports');
const billingRoutes = require('./routes/billing');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const vendorInvoiceRoutes = require('./routes/vendorInvoices');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const authMiddleware = require('./middleware/auth');
const uploadCdr = require('./api/upload-cdr');
const CDRAutoFetcher = require('./services/cdr-auto-fetch');
const BillingScheduler = require('./schedulers/BillingScheduler');
const CDRRetentionService = require('./services/cdr-retention-service');
const NotificationRetentionService = require('./services/notification-retention-service');
const runMigrations = require('./utils/runMigrations');
const { vendorInvoiceUploadDir, accountDocumentUploadDir, ensureDirSync } = require('./config/storage');

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors({
  origin: process.env.BASE_API_URL,
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

// Ensure upload directories are available before handling requests.
ensureDirSync(vendorInvoiceUploadDir);
ensureDirSync(accountDocumentUploadDir);

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
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.post('/api/upload-cdr', authMiddleware, uploadCdr);

// 404 Handler
app.use((req, res) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// Start server and sync database
runMigrations().then(() => {
  return sequelize.sync();
}).then(() => {

  new CDRAutoFetcher();
  new BillingScheduler();
  new CDRRetentionService().start();
  new NotificationRetentionService().start();

  app.listen(PORT, () => {
  });
}).catch(err => {
  console.error('DB connection error:', err);
});
