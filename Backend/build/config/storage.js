const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const storageRoot = path.resolve(backendRoot, process.env.LOCAL_STORAGE_ROOT || 'uploads');
const vendorInvoiceDirName = process.env.VENDOR_INVOICE_UPLOAD_DIR || 'vendor_invoices';
const vendorInvoiceUploadDir = path.resolve(storageRoot, vendorInvoiceDirName);
const accountDocumentDirName = process.env.ACCOUNT_DOCUMENT_UPLOAD_DIR || 'account_documents';
const accountDocumentUploadDir = path.resolve(storageRoot, accountDocumentDirName);

const ensureDirSync = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const isPathInsideRoot = (absolutePath) => {
  const relative = path.relative(storageRoot, absolutePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const normalizeStoredPath = (inputPath) => {
  if (!inputPath || typeof inputPath !== 'string') return null;
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(storageRoot, inputPath);

  if (!isPathInsideRoot(resolved)) {
    return null;
  }
  return resolved;
};

const toStoredRelativePath = (absolutePath) => {
  const resolved = path.resolve(absolutePath);
  if (!isPathInsideRoot(resolved)) {
    return null;
  }
  return path.relative(storageRoot, resolved).split(path.sep).join('/');
};

module.exports = {
  storageRoot,
  vendorInvoiceUploadDir,
  accountDocumentUploadDir,
  ensureDirSync,
  normalizeStoredPath,
  toStoredRelativePath,
};