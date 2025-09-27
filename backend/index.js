require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = 4000;

const GITHUB_API = "https://api.github.com";
const USER = process.env.GITHUB_USER;
const TOKEN = process.env.GITHUB_TOKEN;
const ORG_OWNER = "college-of-mary-immaculate"; // org owner username

if (!USER || !TOKEN) {
  console.error("❌ Missing GITHUB_USER or GITHUB_TOKEN in .env file!");
} else {
  console.log("✅ .env loaded correctly");
  console.log("   👤 GITHUB_USER:", USER);
  console.log("   🔑 GITHUB_TOKEN length:", TOKEN.length);
}

// GitHub fetch helper
async function githubFetch(url) {
  const res = await fetch(url, { headers: { Authorization: `token ${TOKEN}` } });
  const data = await res.json();
  if (!res.ok) console.log("❌ GitHub API error:", data);
  return { ok: res.ok, data };
}

// Format date
function formatDate(dateStr) {
  return new Date(dateStr).toISOString().split("T")[0];
}

// Cache combined repos to avoid duplicate API calls
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

  // Deduplicate by full_name
  const uniqueMap = new Map();
  combined.forEach(r => {
    if (r.full_name && !uniqueMap.has(r.full_name)) uniqueMap.set(r.full_name, r);
  });

  cachedRepos = Array.from(uniqueMap.values());
  return cachedRepos;
}

// Root
app.get("/", (req, res) => {
  res.send("✅ Personal; Tracker Backend running! Try /repos or /streak/:repo");
});

// Get repos you contributed to
app.get("/repos", async (req, res) => {
  try {
    const allRepos = await getCombinedRepos();
    const nonEmpty = allRepos.filter(r => r.size > 0 && r.name && r.owner?.login);

    const enriched = await Promise.all(
      nonEmpty.map(async repo => {
        const { ok, data } = await githubFetch(
          `${GITHUB_API}/repos/${repo.owner.login}/${repo.name}/contributors`
        );
        if (!ok) return null;
        const contributors = Array.isArray(data)
          ? data.map(c => ({ login: c.login, contributions: c.contributions }))
          : [];
        if (!contributors.some(c => c.login === USER)) return null;
        return {
          name: repo.name,
          full_name: repo.full_name,
          html_url: repo.html_url,
          fork: repo.fork,
          size: repo.size,
          created_at: repo.created_at,
          updated_at: repo.pushed_at,
          contributors,
        };
      })
    );

    res.json(enriched.filter(r => r));
  } catch (err) {
    console.error("❌ Error in /repos:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get streak info for frontend
app.get("/streak/:repo", async (req, res) => {
  try {
    const { repo } = req.params;
    const allRepos = await getCombinedRepos();
    const match = allRepos.find(r => r.name === repo);
    if (!match) return res.status(404).json({ error: "Repo not found" });

    const owner = match.owner.login;
    const { ok, data: commits } = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=100`
    );
    if (!ok || !Array.isArray(commits)) return res.status(500).json({ error: "Unable to fetch commits" });

    const commitDates = commits.map(c => formatDate(c.commit.author.date));
    const uniqueDates = [...new Set(commitDates)].sort().reverse();

    let currentStreak = 0, longestStreak = 0, prevDate = null;
    uniqueDates.forEach(d => {
      if (!prevDate) {
        currentStreak = 1;
        longestStreak = 1;
      } else {
        const diff = (new Date(prevDate) - new Date(d)) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else currentStreak = 1;
      }
      prevDate = d;
    });

    res.json({
      owner,
      repo,
      currentStreak,
      longestStreak,
      totalCommits: commitDates.length,
      daysActive: uniqueDates.length,
    });
  } catch (err) {
    console.error("❌ Error in /streak/:repo:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get commits for a repo
app.get("/commits/:repo", async (req, res) => {
  try {
    const { repo } = req.params;
    const allRepos = await getCombinedRepos();
    const match = allRepos.find(r => r.name === repo);
    if (!match) return res.status(404).json({ error: "Repo not found" });

    const owner = match.owner.login;
    let commits = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { ok, data } = await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`
      );
      if (!ok || !Array.isArray(data) || data.length === 0) break;
      commits = commits.concat(data);
      if (data.length < perPage) break;
      page++;
    }

    // Simplify commit info
    const simplified = commits.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url
    }));

    res.json(simplified);
  } catch (err) {
    console.error("❌ Error in /commits/:repo", err.message);
    res.status(500).json({ error: err.message });
  }
});


// Start server
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
