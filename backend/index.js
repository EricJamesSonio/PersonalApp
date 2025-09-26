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

// ✅ Check if .env variables are set
if (!USER || !TOKEN) {
  console.error("❌ Missing GITHUB_USER or GITHUB_TOKEN in .env file!");
} else {
  console.log("✅ .env loaded correctly");
  console.log("   👤 GITHUB_USER:", USER);
  console.log("   🔑 GITHUB_TOKEN length:", TOKEN.length);
}

// Helper: GitHub fetch with auth
async function githubFetch(url) {
  console.log("🌐 Fetching:", url);
  const res = await fetch(url, {
    headers: { Authorization: `token ${TOKEN}` },
  });
  const data = await res.json();
  console.log("📥 GitHub API response status:", res.status);
  if (!res.ok) console.log("❌ GitHub API error response:", data);
  return { ok: res.ok, data };
}

// Root
app.get("/", (req, res) => {
  res.send("✅ Dev Tracker Backend running! Try /repos or /streak/:repo");
});

// Fetch repos
app.get("/repos", async (req, res) => {
  try {
    console.log("🔎 USER:", USER);
    console.log("🔑 TOKEN loaded?", TOKEN ? "yes" : "no");

    // 1️⃣ Get all user repos
    const { ok, data } = await githubFetch(`${GITHUB_API}/users/${USER}/repos?per_page=100`);
    if (!ok) {
      return res.status(500).json({ error: data.message || "GitHub API error" });
    }

    if (!Array.isArray(data)) {
      console.error("⚠️ Unexpected /repos data:", data);
      return res.status(500).json({ error: "GitHub did not return an array" });
    }

    console.log(`📊 Found ${data.length} repos for user ${USER}`);

    // 2️⃣ Filter out empty repos
    const nonEmptyRepos = data.filter(r => r.size > 0 && r.name && r.owner?.login);
    console.log(`📦 Non-empty repos: ${nonEmptyRepos.length}`);

    // 3️⃣ Enrich with contributors
    const enrichedRepos = await Promise.all(nonEmptyRepos.map(async repo => {
      try {
        const { ok: contribOk, data: contribData } = await githubFetch(
          `${GITHUB_API}/repos/${repo.owner.login}/${repo.name}/contributors`
        );

        if (!contribOk) {
          console.warn(`⚠️ Failed contributors fetch for ${repo.name}`);
          return null;
        }

        const contributors = Array.isArray(contribData)
          ? contribData.map(c => ({ login: c.login, contributions: c.contributions }))
          : [];

        if (!contributors.some(c => c.login === USER)) {
          console.log(`⏭ Skipping ${repo.name}, user not a contributor`);
          return null;
        }

        return {
          name: repo.name,
          full_name: repo.full_name,
          html_url: repo.html_url,
          fork: repo.fork,
          size: repo.size,
          created_at: repo.created_at,
          updated_at: repo.pushed_at,
          contributors
        };
      } catch (err) {
        console.error(`❌ Error enriching repo ${repo.name}:`, err.message);
        return null;
      }
    }));

    const finalRepos = enrichedRepos.filter(r => r !== null);
    console.log(`✅ Final repos returned: ${finalRepos.length}`);
    res.json(finalRepos);
  } catch (err) {
    console.error("❌ Error in /repos:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get commits for a repo
app.get("/commits/:repo", async (req, res) => {
  try {
    const { repo } = req.params;
    const url = `${GITHUB_API}/repos/${process.env.GITHUB_USER}/${repo}/commits?per_page=100`;
    console.log("🔎 Fetching commits:", url);

    const response = await fetch(url, {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
    });

    const data = await response.json();
    console.log("📥 Response from GitHub commits:", data);

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || "GitHub API error" });
    }

    res.json(data);
  } catch (err) {
    console.error("❌ Error in /commits/:repo:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper: format date to YYYY-MM-DD
function formatDate(dateStr) {
  return new Date(dateStr).toISOString().split("T")[0];
}

// Streak stats for a repo
app.get("/streak/:repo", async (req, res) => {
  try {
    const { repo } = req.params;
    const url = `${GITHUB_API}/repos/${process.env.GITHUB_USER}/${repo}/commits?per_page=100`;
    console.log("🔎 Fetching commits for streak:", url);

    const response = await fetch(url, {
      headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
    });

    const commits = await response.json();
    console.log("📥 Commits response:", commits);

    if (!response.ok) {
      return res.status(response.status).json({ error: commits.message || "GitHub API error" });
    }

    if (!Array.isArray(commits)) {
      return res.status(500).json({ error: "Unexpected response from GitHub API" });
    }

    const commitDates = commits.map(c => formatDate(c.commit.author.date));
    const uniqueDates = [...new Set(commitDates)].sort().reverse();

    let currentStreak = 0;
    let longestStreak = 0;
    let prevDate = null;

    for (const d of uniqueDates) {
      if (!prevDate) {
        currentStreak = 1;
        longestStreak = 1;
      } else {
        const diffDays = (new Date(prevDate) - new Date(d)) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }
      prevDate = d;
    }

    res.json({
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

// Start server
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
