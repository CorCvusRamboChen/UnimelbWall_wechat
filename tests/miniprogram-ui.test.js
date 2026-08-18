const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

test("post card hosts and the feed list keep a stable full width", () => {
  const componentStyles = fs.readFileSync(
    path.join(
      projectRoot,
      "miniprogram",
      "components",
      "post-card",
      "index.wxss"
    ),
    "utf8"
  );
  const feedStyles = fs.readFileSync(
    path.join(projectRoot, "miniprogram", "pages", "feed", "index.wxss"),
    "utf8"
  );
  const feedTemplate = fs.readFileSync(
    path.join(projectRoot, "miniprogram", "pages", "feed", "index.wxml"),
    "utf8"
  );

  assert.match(componentStyles, /:host\s*\{[^}]*display:\s*block;/s);
  assert.match(componentStyles, /:host\s*\{[^}]*width:\s*100%;/s);
  assert.match(componentStyles, /\.post-card\s*\{[^}]*width:\s*100%\s*!important;/s);
  assert.match(componentStyles, /\.post-card\s*\{[^}]*margin:\s*0\s*!important;/s);
  assert.match(feedStyles, /\.post-list\s*\{[^}]*display:\s*flex;/s);
  assert.match(feedStyles, /\.post-list\s*\{[^}]*flex-direction:\s*column;/s);
  assert.match(feedStyles, /\.post-list\s*\{[^}]*width:\s*100%;/s);
  assert.match(feedStyles, /\.post-card-host\s*\{[^}]*display:\s*block;/s);
  assert.match(feedStyles, /\.post-card-host\s*\{[^}]*width:\s*100%;/s);
  assert.match(feedTemplate, /<post-card[\s\S]*?class="post-card-host"/);
});

test("project config does not commit a production mini program AppID", () => {
  const projectConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "project.config.json"), "utf8")
  );

  assert.equal(projectConfig.appid, "touristappid");
  assert.doesNotMatch(projectConfig.appid, /^wx[0-9a-f]{16}$/i);
});

test("mini program copy avoids forum and post terminology", () => {
  const miniprogramRoot = path.join(projectRoot, "miniprogram");
  const textExtensions = new Set([".js", ".json", ".wxml", ".wxss"]);
  const files = [];

  function collectFiles(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        collectFiles(filePath);
      } else if (textExtensions.has(path.extname(entry.name))) {
        files.push(filePath);
      }
    });
  }

  collectFiles(miniprogramRoot);

  files.forEach((filePath) => {
    const copy = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(projectRoot, filePath);
    assert.doesNotMatch(copy, /论坛|帖/, relativePath);
  });
});
