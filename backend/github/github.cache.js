const fs = require("fs").promises;
const path = require("path");

const CACHE_FILE = path.join(__dirname, "../storage/repos.json");
const COMMITS_DIR = path.join(__dirname, "../storage/commits");

async function ensureCommitsDir() {
  await fs.mkdir(COMMITS_DIR, { recursive: true });
}

function getCommitFileName(owner, repo) {
  return path.join(COMMITS_DIR, `${owner}__${repo}.json`);
}

async function saveCache(data) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveCommits(owner, repo, commits) {
  await ensureCommitsDir();
  const file = getCommitFileName(owner, repo);
  await fs.writeFile(file, JSON.stringify(commits, null, 2), "utf-8");
}

async function loadCommits(owner, repo) {
  try {
    const file = getCommitFileName(owner, repo);
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

module.exports = { saveCache, loadCache, saveCommits, loadCommits };
