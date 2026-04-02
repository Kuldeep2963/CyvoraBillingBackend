#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const buildDir = path.join(__dirname, "..", "build");

console.log("Starting production setup...");

// Step 1: Check if build folder exists
if (!fs.existsSync(buildDir)) {
  console.log("Build folder not found. Running build...");
  try {
    execSync("node scripts/build-backend.js", { cwd: path.join(__dirname, ".."), stdio: "inherit" });
  } catch (error) {
    console.error("Build failed:", error.message);
    process.exit(1);
  }
}

console.log("Build folder exists at:", buildDir);

// Step 2: Install dependencies in build folder
console.log("Installing dependencies in build folder...");
try {
  execSync("npm install --production", { cwd: buildDir, stdio: "inherit" });
  console.log("Dependencies installed successfully");
} catch (error) {
  console.error("Dependency installation failed:", error.message);
  process.exit(1);
}

// Step 3: Start the server
console.log("Starting backend server from build folder...");
try {
  execSync("node index.js", { cwd: buildDir, stdio: "inherit" });
} catch (error) {
  console.error("Server startup failed:", error.message);
  process.exit(1);
}
