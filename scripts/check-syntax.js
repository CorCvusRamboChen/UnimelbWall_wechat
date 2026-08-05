const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const excludedDirectories = new Set([".git", "node_modules", "coverage"]);
const javascriptFiles = [];
const jsonFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      continue;
    }

    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(filePath);
    } else if (entry.name.endsWith(".js")) {
      javascriptFiles.push(filePath);
    } else if (entry.name.endsWith(".json")) {
      jsonFiles.push(filePath);
    }
  }
}

walk(root);

for (const filePath of javascriptFiles) {
  execFileSync(process.execPath, ["--check", filePath], { stdio: "inherit" });
}

for (const filePath of jsonFiles) {
  JSON.parse(fs.readFileSync(filePath, "utf8"));
}

console.log(`Checked ${javascriptFiles.length} JavaScript files and ${jsonFiles.length} JSON files.`);
