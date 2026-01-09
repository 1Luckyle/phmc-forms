const fs = require("fs");
const path = require("path");

const buildDir = path.join(process.cwd(), "build");
if (!fs.existsSync(buildDir)) {
  console.error("build/ introuvable. Lance d'abord le build.");
  process.exit(1);
}

fs.writeFileSync(
  path.join(buildDir, "deploy.txt"),
  `Deployed at: ${new Date().toISOString()}\n`
);
