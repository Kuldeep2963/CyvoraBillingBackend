const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const outDir = path.join(backendRoot, "build");

const entriesToCopy = [
  "api",
  "config",
  "controllers",
  "middleware",
  "migrations",
  "models",
  "routes",
  "schedulers",
  "services",
  "templates",
  "utils",
  "index.js",
  "autoSyncDB.js",
  "syncDB.js",
  "seedUser.js",
  "package.json",
  ".env.example",
  "uploads",
  "reports",
  "fetched_cdrs"
];

function cleanOutputDirectory() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
}

function copyEntry(relativePath) {
  const src = path.join(backendRoot, relativePath);
  if (!fs.existsSync(src)) {
    return;
  }

  const dest = path.join(outDir, relativePath);
  fs.cpSync(src, dest, { recursive: true });
}

function writeBuildPackageJson() {
  const sourcePackagePath = path.join(backendRoot, "package.json");
  const sourcePackage = JSON.parse(fs.readFileSync(sourcePackagePath, "utf-8"));

  const buildPackage = {
    name: sourcePackage.name,
    version: sourcePackage.version,
    private: true,
    main: sourcePackage.main || "index.js",
    scripts: {
      start: "node index.js",
      autosync: "node autoSyncDB.js"
    },
    dependencies: sourcePackage.dependencies || {}
  };

  fs.writeFileSync(
    path.join(outDir, "package.json"),
    JSON.stringify(buildPackage, null, 2) + "\n"
  );
}

function run() {
  cleanOutputDirectory();

  for (const entry of entriesToCopy) {
    copyEntry(entry);
  }

  writeBuildPackageJson();

  console.log(`Backend build output generated at: ${outDir}`);
}

run();
