const express = require('express');
const router = express.Router();
const vendorInvoiceController = require('../controllers/vendorInvoice.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/vendor_invoices';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

router.post('/', upload.array('files'), vendorInvoiceController.createVendorInvoice);
router.get('/', vendorInvoiceController.getVendorInvoices);
router.put('/:id/status', vendorInvoiceController.updateVendorInvoiceStatus);

// allow removal of a vendor invoice (refunds account and deletes files)
router.delete('/:id', vendorInvoiceController.deleteVendorInvoice);

module.exports = router;
