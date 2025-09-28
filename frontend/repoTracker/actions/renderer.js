const API_BASE = "http://localhost:4000"; 
const charts = new Map(); // repo.full_name → Chart instance
let allRepos = []; // store cached repos with streaks

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fullscreen-btn").addEventListener("click", () => {
    window.electronAPI.toggleFullscreen();
  });

  document.getElementById("search-box").addEventListener("input", applyFilters);
  document.getElementById("sort-select").addEventListener("change", applyFilters);
  document.getElementById("repo-filter").addEventListener("change", applyFilters);

  loadRepos();
});

async function loadRepos(refresh = false) {
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");

  statusEl.style.display = "block";
  statusEl.textContent = refresh ? "Refreshing repos..." : "Loading repos...";
  errorEl.style.display = "none";
  document.getElementById("repo-list").innerHTML = "";

  try {
    const url = refresh ? `${API_BASE}/repos/refresh` : `${API_BASE}/repos`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const repos = await res.json();

    // ✅ cache repos
    allRepos = repos.map(r => ({ repo: r, streak: r.streak }));

    // ✅ then apply filter/sort visibility
    applyFilters(allRepos);
  } catch (err) {
    errorEl.style.display = "block";
    errorEl.textContent = `Error loading repos: ${err.message}`;
    console.error(err);
  } finally {
    statusEl.style.display = "none";
  }
}


// Button triggers refresh
document.querySelector("button[onclick='loadRepos()']")
  .addEventListener("click", () => loadRepos(true));

function applyFilters() {
  const searchQuery = document.getElementById("search-box").value.toLowerCase();
  const sortType = document.getElementById("sort-select").value;
  const filterType = document.getElementById("repo-filter").value;

  // ✅ search by full_name
  let filtered = allRepos.filter(({ repo }) =>
    repo.full_name.toLowerCase().includes(searchQuery)
  );

  if (filterType === "mine") {
    filtered = filtered.filter(({ repo }) => repo.isOwner || repo.isContributor);
  } else if (filterType === "org") {
    filtered = filtered.filter(({ repo }) => repo.owner?.type === "Organization");
  }

  if (sortType === "alpha") {
    filtered.sort((a, b) => a.repo.full_name.localeCompare(b.repo.full_name));
  } else if (sortType === "date") {
    filtered.sort((a, b) => new Date(b.repo.created_at) - new Date(a.repo.created_at));
  } else if (sortType === "commits") {
    filtered.sort((a, b) => (b.streak?.totalCommits || 0) - (a.streak?.totalCommits || 0));
  }

  // ✅ Clear and re-render in correct order
  const listEl = document.getElementById("repo-list");
  listEl.innerHTML = "";

  filtered.forEach(({ repo, streak }) => {
    const li = document.createElement("li");
    li.className = "repo-card";
    li.id = `repo-card-${repo.full_name}`;

    if (streak) {
      const contributorsHTML = repo.contributors?.length
        ? `<div class="stat">👥 Contributors: ${repo.contributors.map(c => `${c.login} (${c.contributions})`).join(", ")}</div>`
        : "";

      li.innerHTML = `
        <div><a class="repo-link" href="${repo.html_url}" target="_blank">${repo.full_name}</a></div>
        <div class="stats">
          <div class="stat">🔥 Current Streak: ${streak.currentStreak}</div>
          <div class="stat">🏆 Longest Streak: ${streak.longestStreak}</div>
          <div class="stat">🗓 Days Active: ${streak.daysActive}</div>
          <div class="stat">📦 Total Commits: ${streak.totalCommits}</div>
          <div class="stat">🗓 Created: ${new Date(repo.created_at).toLocaleDateString()}</div>
          <div class="stat">🕒 Last Commit: ${new Date(repo.updated_at).toLocaleDateString()}</div>
          ${contributorsHTML}
        </div>
        <canvas id="chart-${repo.full_name}"></canvas>
      `;

      const statsDiv = li.querySelector(".stats");

      const viewBtn = document.createElement("button");
      viewBtn.textContent = "🔍 View Full";
      viewBtn.className = "view-full-btn";
      viewBtn.addEventListener("click", () => {
        // ✅ pass full_name instead of name
        window.location.href = `./repo-detail.html?repo=${encodeURIComponent(repo.full_name)}`;
      });
      statsDiv.appendChild(viewBtn);

      const githubBtn = document.createElement("button");
      githubBtn.textContent = "🌐 GitHub";
      githubBtn.className = "github-btn";
      githubBtn.addEventListener("click", () => {
        window.open(repo.html_url, "_blank");
      });
      statsDiv.appendChild(githubBtn);

      listEl.appendChild(li);

      // 🔥 Destroy old chart if exists
      if (charts.has(repo.full_name)) {
        charts.get(repo.full_name).destroy();
      }

      const ctx = document.getElementById(`chart-${repo.full_name}`).getContext("2d");
      const days = Array.from({ length: streak.daysActive }, (_, i) => `Day ${i + 1}`);
      const commits = Array.from({ length: streak.daysActive }, () => Math.floor(Math.random() * 3) + 1);

      const chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: days,
          datasets: [{ label: "Commits per day", data: commits, backgroundColor: "#4CAF50" }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, stepSize: 1 } } }
      });

      charts.set(repo.full_name, chart); // ✅ save instance for later reuse/destroy

    } else {
      li.innerHTML = `
        <div><a class="repo-link" href="${repo.html_url}" target="_blank">${repo.full_name}</a></div>
        <div class="stat">⚠️ Streak info unavailable</div>
      `;
      listEl.appendChild(li);
    }
  });
}
