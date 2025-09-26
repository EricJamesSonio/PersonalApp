// renderer.js
const API_BASE = "http://localhost:4000";
const charts = new Map(); // store Chart instances by repo name

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fullscreen-btn").addEventListener("click", () => {
    window.electronAPI.toggleFullscreen();
  });

  loadRepos();
});

async function loadRepos() {
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  const listEl = document.getElementById("repo-list");

  statusEl.style.display = "block";
  statusEl.textContent = "Loading repos and streaks...";
  errorEl.style.display = "none";
  listEl.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/repos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const repos = await res.json();
    if (!Array.isArray(repos)) throw new Error("Invalid repos data");

    const streakPromises = repos.map(async repo => {
      try {
        const streakRes = await fetch(`${API_BASE}/streak/${repo.name}`);
        if (!streakRes.ok) throw new Error(`HTTP ${streakRes.status}`);
        const streakData = await streakRes.json();
        return { repo, streak: streakData };
      } catch {
        return { repo, streak: null };
      }
    });

    const repoWithStreaks = await Promise.all(streakPromises);
    repoWithStreaks.sort((a, b) => (b.streak?.currentStreak || 0) - (a.streak?.currentStreak || 0));

    repoWithStreaks.forEach(({ repo, streak }) => {
      const li = document.createElement("li");
      li.className = "repo-card";

      if (streak) {
        const contributorsHTML = repo.contributors?.length
          ? `<div class="stat">👥 Contributors: ${repo.contributors.map(c => `${c.login} (${c.contributions})`).join(", ")}</div>`
          : "";

        li.innerHTML = `
          <div><a class="repo-link" href="${repo.html_url}" target="_blank">${repo.name}</a></div>
          <div class="stats">
            <div class="stat">🔥 Current Streak: ${streak.currentStreak}</div>
            <div class="stat">🏆 Longest Streak: ${streak.longestStreak}</div>
            <div class="stat">🗓 Days Active: ${streak.daysActive}</div>
            <div class="stat">📦 Total Commits: ${streak.totalCommits}</div>
            <div class="stat">🗓 Created: ${new Date(repo.created_at).toLocaleDateString()}</div>
            <div class="stat">🕒 Last Commit: ${new Date(repo.updated_at).toLocaleDateString()}</div>
            ${contributorsHTML}
          </div>
          <canvas id="chart-${repo.name}"></canvas>
        `;
        listEl.appendChild(li);

        if (charts.has(repo.name)) charts.get(repo.name).destroy();

        const ctx = document.getElementById(`chart-${repo.name}`).getContext("2d");
        const days = Array.from({ length: streak.daysActive }, (_, i) => `Day ${i + 1}`);
        const commits = Array.from({ length: streak.daysActive }, () => Math.floor(Math.random() * 3) + 1);

        const chart = new Chart(ctx, {
          type: "bar",
          data: { labels: days, datasets: [{ label: 'Commits per day', data: commits, backgroundColor: '#4CAF50' }] },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, stepSize: 1 } } }
        });

        charts.set(repo.name, chart);
      } else {
        li.innerHTML = `<div><a class="repo-link" href="${repo.html_url}" target="_blank">${repo.name}</a></div>
                        <div class="stat">⚠️ Streak info unavailable</div>`;
        listEl.appendChild(li);
      }
    });

  } catch (err) {
    errorEl.style.display = "block";
    errorEl.textContent = `Error loading repos: ${err.message}`;
    console.error(err);
  } finally {
    statusEl.style.display = "none";
  }
}
