const fs = require("fs").promises;
const path = require("path");
const express = require("express");
const fetch = require("node-fetch");
const { formatDate } = require("../utils");

const router = express.Router();

const CACHE_FILE = path.join(__dirname, "../storage/repos.json");
const GITHUB_API = "https://api.github.com";
const USER = process.env.GITHUB_USER;
const TOKEN = process.env.GITHUB_TOKEN;
const ORG_OWNER = "college-of-mary-immaculate";

if (!USER || !TOKEN) console.error("❌ Missing GITHUB_USER or GITHUB_TOKEN in .env file!");
else console.log("✅ GitHub env loaded:", USER);

// --- Helpers to read/write cache ---
async function saveCache(data) {
  try { await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8"); }
  catch (err) { console.error("❌ Error saving cache:", err); }
}

async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(data);
  } catch { return null; }
}

// --- GitHub fetch with token ---
async function githubFetch(url) {
  const res = await fetch(url, { headers: { Authorization: `token ${TOKEN}` } });
  const data = await res.json();
  if (!res.ok) console.log("❌ GitHub API error:", data);
  return { ok: res.ok, data };
}

// --- Fetch repos from GitHub ---
let cachedRepos = null;
async function getCombinedRepos() {
  if (cachedRepos) return cachedRepos;

  const { ok: userOk, data: userRepos } = await githubFetch(
    `${GITHUB_API}/user/repos?per_page=100&affiliation=owner,collaborator`
  );
  const { ok: orgOk, data: orgRepos } = await githubFetch(
    `${GITHUB_API}/orgs/${ORG_OWNER}/repos?per_page=100&type=all`
  );

  const combined = [...(userOk ? userRepos : []), ...(orgOk ? orgRepos : [])];
  const uniqueMap = new Map();
  combined.forEach(r => { if (r.full_name && !uniqueMap.has(r.full_name)) uniqueMap.set(r.full_name, r); });

  cachedRepos = Array.from(uniqueMap.values());
  return cachedRepos;
}

// --- Enrich repos with contributors + streaks ---
async function enrichRepos(repos) {
  return await Promise.all(
    repos.map(async repo => {
      // Fetch contributors
      const { ok, data } = await githubFetch(`${GITHUB_API}/repos/${repo.owner.login}/${repo.name}/contributors`);
      if (!ok) return null;

      const contributors = Array.isArray(data)
        ? data.map(c => ({ login: c.login, contributions: c.contributions }))
        : [];

      // Fetch commits to calculate streak
      const { ok: commitsOk, data: commitsData } = await githubFetch(
        `${GITHUB_API}/repos/${repo.owner.login}/${repo.name}/commits?per_page=100`
      );
      let streak = null;
      if (commitsOk && Array.isArray(commitsData)) {
        const commitDates = commitsData.map(c => formatDate(c.commit.author.date));
        const uniqueDates = [...new Set(commitDates)].sort().reverse();
        let currentStreak = 0, longestStreak = 0, prevDate = null;
        uniqueDates.forEach(d => {
          if (!prevDate) { currentStreak = 1; longestStreak = 1; }
          else {
            const diff = (new Date(prevDate) - new Date(d)) / (1000*60*60*24);
            if (diff === 1) { currentStreak++; longestStreak = Math.max(longestStreak, currentStreak); }
            else currentStreak = 1;
          }
          prevDate = d;
        });
        streak = { currentStreak, longestStreak, totalCommits: commitDates.length, daysActive: uniqueDates.length };
      }

      return {
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        fork: repo.fork,
        size: repo.size,
        created_at: repo.created_at,
        updated_at: repo.pushed_at,
        contributors,
        streak,
      };
    })
  ).then(arr => arr.filter(r => r));
}


// --- GET /repos (use cache if exists) ---
router.get("/repos", async (req, res) => {
  try {
    const cached = await loadCache();
    if (cached) return res.json(cached);

    const allRepos = await getCombinedRepos();
    const nonEmpty = allRepos.filter(r => r.size > 0 && r.name && r.owner?.login);
    const enriched = await enrichRepos(nonEmpty);
    await saveCache(enriched);
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GET /repos/refresh (force fetch & update cache) ---
router.get("/repos/refresh", async (req, res) => {
  try {
    cachedRepos = null;
    const allRepos = await getCombinedRepos();
    const nonEmpty = allRepos.filter(r => r.size > 0 && r.name && r.owner?.login);
    const enriched = await enrichRepos(nonEmpty);
    await saveCache(enriched);
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GET /streak/:repo (cache commits per repo) ---
const commitCache = {}; // in-memory per repo

router.get("/streak/:repo", async (req, res) => {
  try {
    const { repo } = req.params;

    // check commit cache first
    if (commitCache[repo]) return res.json(commitCache[repo]);

    const allRepos = await getCombinedRepos();
    const match = allRepos.find(r => r.name === repo);
    if (!match) return res.status(404).json({ error: "Repo not found" });

    const owner = match.owner.login;
    const { ok, data: commits } = await githubFetch(`${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=100`);
    if (!ok || !Array.isArray(commits)) return res.status(500).json({ error: "Unable to fetch commits" });

    const commitDates = commits.map(c => formatDate(c.commit.author.date));
    const uniqueDates = [...new Set(commitDates)].sort().reverse();

    let currentStreak = 0, longestStreak = 0, prevDate = null;
    uniqueDates.forEach(d => {
      if (!prevDate) { currentStreak = 1; longestStreak = 1; }
      else {
        const diff = (new Date(prevDate) - new Date(d)) / (1000 * 60 * 60 * 24);
        if (diff === 1) { currentStreak++; longestStreak = Math.max(longestStreak, currentStreak); }
        else currentStreak = 1;
      }
      prevDate = d;
    });

    const streakData = {
      owner,
      repo,
      currentStreak,
      longestStreak,
      totalCommits: commitDates.length,
      daysActive: uniqueDates.length
    };

    commitCache[repo] = streakData; // cache in memory
    res.json(streakData);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GET /commits/:repo (cache per repo) ---
const fullCommitCache = {}; // in-memory cache

router.get("/commits/:repo", async (req, res) => {
  try {
    const { repo } = req.params;
    if (fullCommitCache[repo]) return res.json(fullCommitCache[repo]);

    const allRepos = await getCombinedRepos();
    const match = allRepos.find(r => r.name === repo);
    if (!match) return res.status(404).json({ error: "Repo not found" });

    const owner = match.owner.login;
    let commits = [], page = 1, perPage = 100;

    while (true) {
      const { ok, data } = await githubFetch(`${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`);
      if (!ok || !Array.isArray(data) || data.length === 0) break;
      commits = commits.concat(data);
      if (data.length < perPage) break;
      page++;
    }

    const simplified = commits.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url
    }));

    fullCommitCache[repo] = simplified; // cache in memory
    res.json(simplified);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
