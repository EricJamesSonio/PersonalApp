const fs = require("fs").promises;
const path = require("path");

const COMMANDS_FILE = path.join(__dirname, "commands", "commands.json");

async function ensureCommandsFile() {
  try {
    await fs.access(COMMANDS_FILE);
  } catch {
    await fs.writeFile(COMMANDS_FILE, JSON.stringify({}, null, 2), "utf8");
  }
}

async function readCommandsFile() {
  await ensureCommandsFile();
  const txt = await fs.readFile(COMMANDS_FILE, "utf8");
  return JSON.parse(txt || "{}");
}

async function writeCommandsFile(obj) {
  await fs.writeFile(COMMANDS_FILE, JSON.stringify(obj, null, 2), "utf8");
}

function formatDate(dateStr) {
  return new Date(dateStr).toISOString().split("T")[0];
}

module.exports = {
  readCommandsFile,
  writeCommandsFile,
  formatDate,
};
