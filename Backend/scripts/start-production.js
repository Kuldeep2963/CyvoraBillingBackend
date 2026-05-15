#!/usr/bin/env node

/**
 * Production startup script for Backend
 * 1. Builds the backend from source files to /build
 * 2. Installs dependencies in build folder
 * 3. Starts the server from the build folder
 * 
 * Usage: pnpm build:start
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const buildDir = path.join(__dirname, "..", "build");
const backendRoot = path.join(__dirname, "..");

const log = (msg) => console.log(`\n📦 ${msg}`);
const error = (msg) => console.error(`\n❌ ${msg}`);

try {
  log("Step 1/3: Building backend from source...");
  execSync("node scripts/build-backend.js", { cwd: backendRoot, stdio: "inherit" });

  if (!fs.existsSync(buildDir)) {
    error("Build folder was not created");
    process.exit(1);
  }
  log("✓ Build completed successfully");

  log("Step 2/3: Installing production dependencies...");
  execSync("npm install --production", { cwd: buildDir, stdio: "inherit" });
  log("✓ Dependencies installed");

  log("Step 3/3: Starting server from build folder...");
  console.log("");
  execSync("node index.js", { cwd: buildDir, stdio: "inherit" });
} catch (err) {
  error(`Production startup failed: ${err.message}`);
  process.exit(1);
}
