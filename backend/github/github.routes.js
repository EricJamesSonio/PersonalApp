const express = require("express");
const router = express.Router();
const { getCombinedRepos, enrichRepos, fetchCommits, calculateStreak, saveCache, loadCache, loadCommits } = require("./github.service");
const { formatDate } = require("../utils");

const USER = process.env.GITHUB_USER;

router.get("/profile", async (req, res) => {
  try {
    const repos = (await loadCache()) || [];
    const enriched = Array.isArray(repos) ? repos : [];

    let totalCommits = 0;
    let allDates = [];

    for (const r of enriched) {
      if (!r?.full_name || !r.streak) continue;
      totalCommits += r.streak.totalCommits || 0;

      const [owner, repo] = r.full_name.split("/");
      const commits = (await loadCommits(owner, repo)) || [];
      
      // Ensure dates are in YYYY-MM-DD format
      commits.forEach(c => {
        if (c.date) {
          const formattedDate = formatDate(c.date);
          if (formattedDate) allDates.push(formattedDate);
        }
      });
    }

    // Count commits per day
    const dailyCounts = allDates.reduce((acc, d) => {
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    
    // Convert to array and sort by date
    const heatmap = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

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
    console.error("Profile error:", err);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/repos/refresh", async (req, res) => {
  try {
    const allRepos = await getCombinedRepos();
    const nonEmpty = allRepos.filter(r => r.size > 0 && r.name && r.owner?.login);
    const enriched = await enrichRepos(nonEmpty);
    await saveCache(enriched);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/commits/:repo", async (req, res) => {
  try {
    const repoParam = decodeURIComponent(req.params.repo);
    const allRepos = await getCombinedRepos();
    const match = allRepos.find(r => r.full_name === repoParam || r.name === repoParam);
    if (!match) return res.status(404).json({ error: "Repo not found" });

    const [owner, repo] = match.full_name.split("/");
    let commits = await loadCommits(owner, repo);
    if (!commits.length) {
      commits = await fetchCommits(owner, repo);
    }
    res.json(commits);
  } catch (err) {
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
