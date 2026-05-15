const express = require('express');
const router = express.Router();
const vendorInvoiceController = require('../controllers/vendorInvoice.controller');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { vendorInvoiceUploadDir, ensureDirSync } = require('../config/storage');

const maxFileSizeMb = Math.max(1, Number(process.env.MAX_VENDOR_INVOICE_FILE_MB) || 25);
const maxFileSize = maxFileSizeMb * 1024 * 1024;
const allowedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xls', '.xlsx']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirSync(vendorInvoiceUploadDir);
    cb(null, vendorInvoiceUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = allowedExtensions.has(ext) ? ext : '';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSize,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const extensionAllowed = allowedExtensions.has(ext);
    const mimeAllowed = allowedMimeTypes.has(mime);

    if (!extensionAllowed || !mimeAllowed) {
      return cb(new Error('Invalid file type. Allowed: PDF, PNG, JPG, CSV, XLS, XLSX'));
    }

    cb(null, true);
  },
});

const handleUpload = (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: `File too large. Max allowed is ${maxFileSizeMb}MB per file.` });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Too many files. Maximum 10 files are allowed.' });
      }
      return res.status(400).json({ message: err.message || 'File upload validation failed.' });
    }

    return res.status(400).json({ message: err.message || 'Invalid upload request.' });
  });
};

router.post('/usage-preview', vendorInvoiceController.previewVendorUsage);
router.post('/', handleUpload, vendorInvoiceController.createVendorInvoice);
router.get('/', vendorInvoiceController.getVendorInvoices);
router.get('/:id/files', vendorInvoiceController.getVendorInvoiceFiles);
router.get('/:id/files/:fileIndex/download', vendorInvoiceController.downloadVendorInvoiceFile);
router.post('/:id/files', handleUpload, vendorInvoiceController.addVendorInvoiceFiles);
router.delete('/:id/files/:fileIndex', vendorInvoiceController.deleteVendorInvoiceFile);
router.put('/:id', vendorInvoiceController.updateVendorInvoice);
router.put('/:id/status', vendorInvoiceController.updateVendorInvoiceStatus);

// allow removal of a vendor invoice (refunds account and deletes files)
router.delete('/:id', vendorInvoiceController.deleteVendorInvoice);

module.exports = router;
