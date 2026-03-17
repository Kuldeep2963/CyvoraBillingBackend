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
