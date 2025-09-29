const fs = require("fs").promises;
const path = require("path");
const express = require("express");
const fetch = require("node-fetch");
const { formatDate } = require("../utils");

const router = express.Router();

const CACHE_FILE = path.join(__dirname, "../storage/repos.json");
const COMMITS_DIR = path.join(__dirname, "../storage/commits");
const GITHUB_API = "https://api.github.com";
const USER = process.env.GITHUB_USER;
const TOKEN = process.env.GITHUB_TOKEN;
const ORG_OWNER = "college-of-mary-immaculate";

if (!USER || !TOKEN) console.error("❌ Missing GITHUB_USER or GITHUB_TOKEN in .env file!");
else console.log("✅ GitHub env loaded:", USER);

// --- Helpers ---
async function ensureCommitsDir() {
  try { await fs.mkdir(COMMITS_DIR, { recursive: true }); } catch {}
}

function getCommitFileName(owner, repo) {
  return path.join(COMMITS_DIR, `${owner}__${repo}.json`);
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

async function githubFetch(url) {
  const res = await fetch(url, { headers: { Authorization: `token ${TOKEN}` } });
  const data = await res.json();
  if (!res.ok) console.log("❌ GitHub API error:", data);
  return { ok: res.ok, data };
}

// --- Fetch repos ---
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
  combined.forEach(r => {
    if (r.full_name && !uniqueMap.has(r.full_name)) uniqueMap.set(r.full_name, r);
  });

  cachedRepos = Array.from(uniqueMap.values());
  return cachedRepos;
}

// --- Fetch commits helper ---
async function fetchCommits(owner, repo) {
  let commits = [];
  let page = 1, perPage = 100;

  while (true) {
    const { ok, data } = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`
    );
    if (!ok || !Array.isArray(data) || data.length === 0) break;
    commits = commits.concat(data);
    if (data.length < perPage) break;
    page++;
  }

  return commits.map(c => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author.name,
    date: c.commit.author.date,
    url: c.html_url
  }));
}

// --- Calculate streak ---
async function calculateStreak(repoFullName) {
  const [owner, repo] = repoFullName.split("/");
  await ensureCommitsDir();

  let commits = await loadCommits(owner, repo);
  if (!commits || commits.length === 0) {
    commits = await fetchCommits(owner, repo);
    await saveCommits(owner, repo, commits);
  }

  const commitDates = commits.map(c => formatDate(c.date));
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

  return { 
    repo: repoFullName,
    currentStreak,
    longestStreak,
    totalCommits: commitDates.length,
    daysActive: uniqueDates.length 
  };
}

// --- Enrich repos ---
async function enrichRepos(repos) {
  return await Promise.all(
    repos.map(async repo => {
      const { ok, data } = await githubFetch(
        `${GITHUB_API}/repos/${repo.owner.login}/${repo.name}/contributors`
      );
      const contributors = (ok && Array.isArray(data)) 
        ? data.map(c => ({ login: c.login, contributions: c.contributions }))
        : [];

      const streak = await calculateStreak(repo.full_name);

      return {
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        fork: repo.fork,
        size: repo.size,
        created_at: repo.created_at,
        updated_at: repo.pushed_at,
        owner: repo.owner,
        contributors,
        streak,
        isOwner: repo.owner.login.toLowerCase() === USER.toLowerCase(),
        isContributor: contributors.some(c => c.login.toLowerCase() === USER.toLowerCase())
      };
    })
  ).then(arr => arr.filter(r => r));
}

// --- Routes ---

router.get("/profile", async (req, res) => {
  try {
    const repos = (await loadCache()) || [];
    // use cached repos directly
    const enriched = Array.isArray(repos) ? repos : [];

    let totalCommits = 0;
    let allDates = [];

    for (const r of enriched) {
      if (!r?.full_name || !r.streak) continue;
      totalCommits += r.streak.totalCommits || 0;

      const [owner, repo] = r.full_name.split("/");
      if (!owner || !repo) continue;

      const commits = (await loadCommits(owner, repo)) || [];
      allDates.push(...commits.map(c => formatDate(c.date)).filter(Boolean));
    }

    const dailyCounts = allDates.reduce((acc, d) => {
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    const heatmap = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

    res.json({
      username: USER || "unknown",
      avatar_url: USER
        ? `https://github.com/${USER}.png`
        : "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
      totalCommits,
      repos: enriched.length,
      heatmap,
    });
  } catch (err) {
    console.error("❌ /profile route error:", err);
    res.status(500).json({ error: err.message });
  }
});


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

router.get("/commits/:repo", async (req, res) => {
  try {
    const repoParam = decodeURIComponent(req.params.repo);
    const allRepos = await getCombinedRepos();

    const match = allRepos.find(r => r.full_name === repoParam || r.name === repoParam);
    if (!match) return res.status(404).json({ error: "Repo not found" });

    const [owner, repo] = match.full_name.split("/");
    let commits = await loadCommits(owner, repo);
    if (!commits || commits.length === 0) {
      commits = await fetchCommits(owner, repo);
      await saveCommits(owner, repo, commits);
    }

    res.json(commits);
  } catch (err) {
    console.error("❌ /commits error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.get("/streak/:repo", async (req, res) => {
  try {
    const repoParam = decodeURIComponent(req.params.repo);
    const allRepos = await getCombinedRepos();

    const match = allRepos.find(r => r.full_name === repoParam || r.name === repoParam);
    if (!match) return res.status(404).json({ error: "Repo not found" });

    const streak = await calculateStreak(match.full_name);
    res.json(streak);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
