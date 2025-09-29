let chartInstance;
let commitsData = [];
let terminal;
const API_BASE = window.electronAPI.API_BASE;

window.addEventListener("DOMContentLoaded", async () => {
  // ✅ Initialize terminal using Promise-based API
  terminal = await window.electronAPI.initTerminal({
    onHighlight: (elements) => console.log("highlighted:", elements),
  });
  terminal.appendLine("Terminal initialized. Press Ctrl+` to toggle.");

  // Button handlers
  document.getElementById("fullscreen-btn").addEventListener("click", () => {
    window.electronAPI.toggleFullscreen();
  });
  document.getElementById("back-btn").addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  // Load repo if URL has ?repo=
  const params = new URLSearchParams(window.location.search);
  const repoName = params.get("repo");
  if (repoName) loadRepo(repoName);
});

function calculateStreak(commits) {
  const commitDates = commits.map(c => new Date(c.date).toISOString().split("T")[0]);
  const uniqueDates = [...new Set(commitDates)].sort().reverse();
  let currentStreak = 0, longestStreak = 0, prevDate = null;

  uniqueDates.forEach(date => {
    if (!prevDate) {
      currentStreak = longestStreak = 1;
    } else {
      const diff = (new Date(prevDate) - new Date(date)) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else currentStreak = 1;
    }
    prevDate = date;
  });

  return {
    currentStreak,
    longestStreak,
    totalCommits: commitDates.length,
    daysActive: uniqueDates.length,
  };
}

async function loadRepo(repoName) {
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  const statsEl = document.getElementById("repo-stats");
  const chartEl = document.getElementById("repo-chart");
  const commitListEl = document.getElementById("commit-list");

  statusEl.style.display = "block";
  statusEl.textContent = "Loading repo details...";
  errorEl.style.display = "none";

  try {
    const reposRes = await fetch(`${API_BASE}/repos`);
    const repos = await reposRes.json();
    const repo = repos.find(r => r.full_name === repoName);
    if (!repo) throw new Error("Repo not found");

    const encodedName = encodeURIComponent(repoName);
    const commitsRes = await fetch(`${API_BASE}/commits/${encodedName}`);
    if (!commitsRes.ok) throw new Error(`Failed to fetch commits: ${commitsRes.status}`);
    commitsData = await commitsRes.json();

    const streak = calculateStreak(commitsData);
    document.getElementById("repo-title").textContent = repo.full_name;

    const contributorsHTML = repo.contributors?.length
      ? `<div class="stat">👥 Contributors: ${repo.contributors
          .map(c => `<a href="https://github.com/${c.login}" target="_blank">${c.login}</a> (${c.contributions})`)
          .join(", ")}</div>`
      : "";

    statsEl.innerHTML = `
      <div class="stat">🔥 Current Streak: ${streak.currentStreak}</div>
      <div class="stat">🏆 Longest Streak: ${streak.longestStreak}</div>
      <div class="stat">🗓 Days Active: ${streak.daysActive}</div>
      <div class="stat">📦 Total Commits: ${streak.totalCommits}</div>
      <div class="stat">🗓 Created: ${new Date(repo.created_at).toLocaleDateString()}</div>
      <div class="stat">🕒 Last Commit: ${new Date(repo.updated_at).toLocaleDateString()}</div>
      ${contributorsHTML}
    `;

    const commitsByDate = {};
    commitsData.forEach(c => {
      const day = new Date(c.date).toISOString().split("T")[0];
      commitsByDate[day] = (commitsByDate[day] || 0) + 1;
    });

    const sortedDays = Object.keys(commitsByDate).sort();
    const commitsPerDay = sortedDays.map(d => commitsByDate[d]);

    if (chartInstance) chartInstance.destroy();
    const ctx = chartEl.getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "bar",
      data: { labels: sortedDays, datasets: [{ label: "Commits per day", data: commitsPerDay, backgroundColor: "#4CAF50" }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, stepSize: 1 } },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          highlightCommits(sortedDays[elements[0].index]);
        },
      },
    });

    commitListEl.innerHTML = commitsData.map(c => `
      <div class="commit-card" data-date="${new Date(c.date).toISOString().split("T")[0]}">
        <div><strong>${c.sha.substring(0, 7)}</strong> - ${c.message}</div>
        <div>Author: ${c.author} | Date: ${new Date(c.date).toLocaleString()}</div>
        <div><a href="${c.url}" target="_blank">View on GitHub</a></div>
      </div>
    `).join("");

  } catch (err) {
    errorEl.style.display = "block";
    errorEl.textContent = err.message;
  } finally {
    statusEl.style.display = "none";
  }
}

function highlightCommits(date) {
  const commitCards = Array.from(document.querySelectorAll(`#commit-list .commit-card`));
  const toHighlight = commitCards.filter(el => el.dataset.date === date);

  // Clear previous highlights
  commitCards.forEach(el => el.classList.remove("highlight"));

  // Highlight and scroll
  toHighlight.forEach(el => {
    el.classList.add("highlight");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // Pass to terminal (for other terminal effects)
  if (terminal && typeof terminal.highlight === "function") {
    terminal.highlight(toHighlight);
  }
}
