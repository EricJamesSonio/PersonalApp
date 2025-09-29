const fetch = require("node-fetch");
const GITHUB_API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) console.error("❌ Missing GITHUB_TOKEN in .env file!");

async function githubFetch(endpoint) {
  const url = endpoint.startsWith("http") ? endpoint : `${GITHUB_API}${endpoint}`;
  const res = await fetch(url, { headers: { Authorization: `token ${TOKEN}` } });
  const data = await res.json();
  if (!res.ok) console.error("❌ GitHub API error:", data);
  return { ok: res.ok, data };
}

module.exports = { githubFetch, GITHUB_API };
