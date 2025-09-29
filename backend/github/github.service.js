const { githubFetch, GITHUB_API } = require("./github.api");
const { saveCache, loadCache, saveCommits, loadCommits } = require("./github.cache");
const { formatDate } = require("../utils");

const USER = process.env.GITHUB_USER;
const ORG_OWNER = "college-of-mary-immaculate";

let cachedRepos = null;

// --- Repos ---
async function getCombinedRepos() {
  if (cachedRepos) return cachedRepos;

  const { ok: userOk, data: userRepos } = await githubFetch(
    `/user/repos?per_page=100&affiliation=owner,collaborator`
  );
  const { ok: orgOk, data: orgRepos } = await githubFetch(
    `/orgs/${ORG_OWNER}/repos?per_page=100&type=all`
  );

  const combined = [...(userOk ? userRepos : []), ...(orgOk ? orgRepos : [])];
  const uniqueMap = new Map();
  combined.forEach(r => {
    if (r.full_name && !uniqueMap.has(r.full_name)) uniqueMap.set(r.full_name, r);
  });

  cachedRepos = Array.from(uniqueMap.values());
  return cachedRepos;
}

// --- Commits ---
async function fetchCommits(owner, repo) {
  let commits = [];
  let page = 1, perPage = 100;

  while (true) {
    const { ok, data } = await githubFetch(
      `/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`
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
    url: c.html_url,
  }));
}

// --- Streak calculation ---
async function calculateStreak(repoFullName) {
  const [owner, repo] = repoFullName.split("/");
  let commits = await loadCommits(owner, repo);

  if (!commits.length) {
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

  return { repo: repoFullName, currentStreak, longestStreak, totalCommits: commitDates.length, daysActive: uniqueDates.length };
}

// --- Repo enrichment ---
async function enrichRepos(repos) {
  return Promise.all(
    repos.map(async repo => {
      const { ok, data } = await githubFetch(
        `/repos/${repo.owner.login}/${repo.name}/contributors`
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
        isContributor: contributors.some(c => c.login.toLowerCase() === USER.toLowerCase()),
      };
    })
  );
}

module.exports = {
  getCombinedRepos,
  fetchCommits,
  calculateStreak,
  enrichRepos,
  saveCache,
  loadCache,
  saveCommits,
  loadCommits,
};
