# CDRBilling

Monorepo with:
- `frontend` (React + Vite)
- `Backend` (Node.js + Express + Sequelize)

This project is configured to use `pnpm` workspaces.

## Prerequisites

- Node.js 18+
- Corepack enabled

## Setup

```bash
corepack enable
corepack prepare pnpm@10.6.2 --activate
pnpm install
```

Configure backend environment variables before running the server:

```bash
cp Backend/.env.example Backend/.env
```

### File storage configuration (local + production)

Vendor invoice uploads use local disk storage with environment-based paths.
This supports your laptop during local testing and your server disk in production with the same codebase.

Set these variables in Backend/.env:

```bash
LOCAL_STORAGE_ROOT=uploads
VENDOR_INVOICE_UPLOAD_DIR=vendor_invoices
MAX_VENDOR_INVOICE_FILE_MB=25
ACCOUNT_DOCUMENT_UPLOAD_DIR=account_documents
MAX_ACCOUNT_DOCUMENT_FILE_MB=25
```

- In local development: keep LOCAL_STORAGE_ROOT=uploads (stores in Backend/uploads/...)
- In production: set an absolute path, for example LOCAL_STORAGE_ROOT=/var/www/cdrbilling-storage
- Ensure the runtime user has read/write permissions on that directory
- Back up the storage directory regularly (cron + rsync/snapshot)

## Run

Run frontend dev server:

```bash
pnpm dev:frontend
```

Run backend dev server:

```bash
pnpm dev:backend
```

Build frontend:

```bash
pnpm build:frontend
```

Start backend in production mode:

```bash
pnpm start:backend
```

## Workspace commands

Install all dependencies:

```bash
pnpm install
```

Run a command in frontend only:

```bash
pnpm --filter cdrbilling-frontend <command>
```

Run a command in backend only:

```bash
pnpm --filter cdrbilling-backend <command>
```
# PaiInvoice
# CyvoraBillingBackend
