# Development & Production Setup Guide

This document describes the development and production workflows for the CDR Billing System.

## 📋 Quick Reference

### Development Mode (Source Code)
Run both frontend and backend from source code with hot-reload:

```bash
# Terminal 1: Frontend (from frontend folder)
cd frontend
pnpm dev        # Runs on http://localhost:3000

# Terminal 2: Backend (from Backend folder)
cd Backend
pnpm dev        # Runs on http://localhost:5000
```

### Production Mode (Built from Source)
Build and run from optimized/transpiled output:

```bash
# Terminal 1: Frontend (from frontend folder)
cd frontend
pnpm build:start   # Builds to dist/, then previews on http://localhost:4173

# Terminal 2: Backend (from Backend folder)
cd Backend
pnpm build:start   # Builds to build/, installs prod deps, then runs
```

---

## 🛠️ Development Workflow

### Frontend Development

**Start Frontend Dev Server:**
```bash
cd frontend
pnpm dev
```

**Features:**
- ✅ Hot Module Replacement (HMR) - Changes reflect instantly
- ✅ Proxy to backend API (`http://localhost:3000/api` → `http://localhost:5000/api`)
- ✅ Development build with full source maps
- ✅ Runs on port `3000`

**Available Commands:**
```bash
pnpm dev          # Start dev server with hot-reload
pnpm build        # Build for production (creates dist/ folder)
pnpm preview      # Preview production build locally (without rebuild)
pnpm build:start  # Build + preview (full production test cycle)
pnpm lint         # Run ESLint
```

### Backend Development

**Start Backend Dev Server:**
```bash
cd Backend
pnpm dev
```

**Features:**
- ✅ Nodemon watches for file changes and auto-restarts
- ✅ Runs from source code directly (`index.js`)
- ✅ Runs on port `5000`
- ✅ Hot-reload on every file change

**Available Commands:**
```bash
pnpm dev          # Start with nodemon (auto-restart on file change)
pnpm start        # Run once from source (no auto-restart)
pnpm build        # Build backend (copies to build/ with transpilation)
pnpm build:start  # Build + run from build folder (production mode)
pnpm seed         # Seed database with initial data
pnpm autosync     # Run auto-sync for CDR data
```

---

## 🚀 Production Workflow

### Frontend Production

**Build and Preview:**
```bash
cd frontend
pnpm build:start
```

**What happens:**
1. ✅ Runs `vite build` - Creates optimized bundle in `dist/` folder
2. ✅ Runs `vite preview` - Serves the built bundle locally
3. ✅ Accessible at `http://localhost:4173` (default Vite preview port)

**Manual Build Only:**
```bash
cd frontend
pnpm build        # Creates dist/ folder with optimized build
```

**Then manually preview (if needed):**
```bash
cd frontend
pnpm preview      # Serves from existing dist/ folder
```

### Backend Production

**Build and Start:**
```bash
cd Backend
pnpm build:start
```

**What happens:**
1. ✅ Runs `build-backend.js` - Copies and transpiles to `build/` folder
2. ✅ Installs production dependencies in `build/` folder
3. ✅ Starts server from `build/index.js`
4. ✅ Runs on port `5000`

**Manual Build Only:**
```bash
cd Backend
pnpm build        # Creates build/ folder with transpiled code
```

**Then manually start (if needed):**
```bash
cd Backend
pnpm start        # Runs build/index.js
```

---

## 📁 Folder Structure

### Frontend
```
frontend/
├── dist/              # Production build output (created by: pnpm build)
├── src/               # Source code (dev runs from here)
├── package.json       # Scripts: dev, build, build:start, preview, lint
└── vite.config.js     # Vite configuration
```

### Backend
```
Backend/
├── build/             # Production build output (created by: pnpm build)
├── index.js           # Main entry point (dev runs from here)
├── package.json       # Scripts: dev, start, build, build:start
├── scripts/
│   ├── build-backend.js       # Build script (transpilation)
│   └── start-production.js    # Production startup orchestration
└── ... (other source files)
```

---

## 🔄 Typical Development Workflow

### First Time Setup
```bash
# Clone and install
git clone <repo>
cd CDRBilling

# Install workspace dependencies
pnpm install

# Frontend setup
cd frontend
pnpm install

# Backend setup
cd Backend
pnpm install

# Seed database (if needed)
pnpm seed
```

### Daily Development
```bash
# Terminal 1 - Start Frontend Dev Server
cd frontend
pnpm dev

# Terminal 2 - Start Backend Dev Server  
cd Backend
pnpm dev

# Code, make changes, see them reflect instantly in browser
# Ctrl+C to stop when done
```

### Before Deployment
```bash
# Test production build locally

# Terminal 1 - Test frontend production build
cd frontend
pnpm build:start

# Terminal 2 - Test backend production build
cd Backend
pnpm build:start

# Test the application at frontend: http://localhost:4173
# Backend should be running on http://localhost:5000
```

---

## 🔐 Environment Variables

Create `.env` files as needed:

**Backend/.env** (for development)
```
NODE_ENV=development
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url
PORT=5000
# ... other env variables
```

**Backend/.env.production** (for production)
```
NODE_ENV=production
DATABASE_URL=your_production_database_url
REDIS_URL=your_production_redis_url
PORT=5000
# ... other env variables
```

---

## 🚨 Troubleshooting

### Frontend
| Issue | Solution |
|-------|----------|
| Port 3000 already in use | `npx kill-port 3000` or change port in `vite.config.js` |
| API calls failing | Check backend is running on port 5000 |
| Changes not reflecting | Ensure `pnpm dev` is running (hot-reload enabled) |
| Build fails | Clear `dist/` folder and try again: `rm -rf dist && pnpm build` |

### Backend
| Issue | Solution |
|-------|----------|
| Port 5000 already in use | `npx kill-port 5000` or change in environment |
| Database connection error | Check `DATABASE_URL` in `.env` |
| Changes not reflecting | Ensure `pnpm dev` is running (nodemon active) |
| Build fails | Clear `build/` folder and try again: `rm -rf build && pnpm build` |

---

## 📊 Summary Table

| Task | Frontend | Backend |
|------|----------|---------|
| **Development (live reload)** | `pnpm dev` | `pnpm dev` |
| **Production Build** | `pnpm build` | `pnpm build` |
| **Production Start** | `pnpm build:start` | `pnpm build:start` |
| **Run from source** | `pnpm dev` | `pnpm start` |
| **Run from build** | `pnpm preview` | N/A (use build:start) |
| **Port** | 3000 | 5000 |

---

## 💡 Best Practices

1. **Always use separate terminals** for frontend and backend during development
2. **Never commit `/dist` or `/build` folders** - they're auto-generated
3. **Use `pnpm build:start` before deployment** to test production build locally
4. **Keep `.env` files in `.gitignore`** - use `.env.example` for reference
5. **Run `pnpm build` regularly** during development to catch build-time errors early

---

## 📞 Quick Commands Cheatsheet

```bash
# Development
pnpm dev              # Frontend: Start dev server with hot-reload
cd Backend && pnpm dev  # Backend: Start with nodemon

# Production Testing
pnpm build:start      # Build + start production mode locally

# Utilities
pnpm build            # Just build (no start)
pnpm seed             # Backend: Seed database
pnpm autosync         # Backend: Auto-sync CDR data
pnpm lint             # Frontend: Run linter
```

---

Generated: May 7, 2026
