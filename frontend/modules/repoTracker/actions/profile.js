// Global Variables
let heatmapData = [];
let allRepos = [];
let pinnedRepoNames = [];
const PINNED_STORAGE_KEY = 'github_pinned_repos';

// Navigation
function goBack() { 
  window.location.href = "./index.html"; 
}

// Initialize Profile
async function loadProfile() {
  try {
    const res = await fetch("http://localhost:4000/profile");
    const data = await res.json();

    document.getElementById("avatar").src =
      data.avatar_url || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
    document.getElementById("username").textContent = data.username || "Unknown User";
    document.getElementById("repos").textContent = data.repos || 0;
    document.getElementById("totalCommits").textContent = data.totalCommits || 0;

    const reposRes = await fetch("http://localhost:4000/repos");
    allRepos = await reposRes.json();

    // Load pinned repos from memory
    loadPinnedFromMemory();
    
    let pinned;
    if (pinnedRepoNames.length > 0) {
      // Use saved pinned repos
      pinned = allRepos.filter(r => pinnedRepoNames.includes(r.full_name)).slice(0, 6);
    } else {
      // Default: show repos where user is owner or contributor
      pinned = allRepos.filter(r => r.isOwner || (r.isContributor && !r.isOrg)).slice(0, 6);
      // Save default pinned repos
      pinnedRepoNames = pinned.map(r => r.full_name);
      savePinnedToMemory();
    }
    
    renderPinnedRepos(pinned);

    // Store heatmap data
    heatmapData = data.heatmap || [];
    
    // Populate year selector
    populateYearSelector(heatmapData);
    
    // Render initial heatmap (all time)
    renderHeatmap('all');

  } catch (err) { 
    console.error("❌ Failed to load profile:", err); 
  }
}

// Pinned Repos Management
function loadPinnedFromMemory() {
  const stored = sessionStorage.getItem(PINNED_STORAGE_KEY);
  if (stored) {
    try {
      pinnedRepoNames = JSON.parse(stored);
    } catch (e) {
      pinnedRepoNames = [];
    }
  }
}

function savePinnedToMemory() {
  sessionStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedRepoNames));
}

function openPinnedModal() {
  const modal = document.getElementById('pinned-modal');
  const selector = document.getElementById('repo-selector');
  selector.innerHTML = '';
  
const filteredRepos = allRepos.filter(r => r.isOwner || (r.isContributor && !r.isOrg));
const sortedRepos = [...filteredRepos].sort((a, b) => {
  const aIsPinned = pinnedRepoNames.includes(a.full_name);
  const bIsPinned = pinnedRepoNames.includes(b.full_name);
  if (aIsPinned && !bIsPinned) return -1;
  if (!aIsPinned && bIsPinned) return 1;
  return (b.streak?.totalCommits || 0) - (a.streak?.totalCommits || 0);
});
  
  sortedRepos.forEach(repo => {
    const div = document.createElement('div');
    div.className = 'repo-option';
    if (pinnedRepoNames.includes(repo.full_name)) {
      div.classList.add('selected');
    }
    
    div.innerHTML = `
      <div class="repo-option-name">${repo.name}</div>
      <div class="repo-option-stats">
        ⭐ ${repo.streak?.totalCommits || 0} commits
        ${repo.isOwner ? '👤 Owner' : repo.isContributor ? '🤝 Contributor' : ''}
      </div>
    `;
    
    div.onclick = () => toggleRepoSelection(repo.full_name, div);
    selector.appendChild(div);
  });
  
  updateSelectionCount();
  modal.style.display = 'block';
}

function closePinnedModal() {
  document.getElementById('pinned-modal').style.display = 'none';
}

function toggleRepoSelection(repoFullName, element) {
  const index = pinnedRepoNames.indexOf(repoFullName);
  
  if (index > -1) {
    // Remove from selection
    pinnedRepoNames.splice(index, 1);
    element.classList.remove('selected');
  } else {
    // Add to selection (max 6)
    if (pinnedRepoNames.length < 6) {
      pinnedRepoNames.push(repoFullName);
      element.classList.add('selected');
    } else {
      alert('You can only pin up to 6 repositories!');
    }
  }
  
  updateSelectionCount();
}

function updateSelectionCount() {
  document.getElementById('selected-count').textContent = pinnedRepoNames.length;
}

function savePinnedRepos() {
  savePinnedToMemory();
  
  const pinned = allRepos.filter(r => pinnedRepoNames.includes(r.full_name));
  renderPinnedRepos(pinned);
  
  closePinnedModal();
}

function renderPinnedRepos(repos) {
  const container = document.querySelector(".pinned-list");
  container.innerHTML = "";

  if (repos.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#8b949e;grid-column:1/-1;">No pinned repositories. Click "Edit Pinned" to select some!</p>';
    return;
  }

  repos.forEach(r => {
    const el = document.createElement("div");
    el.className = "pinned-card";
    el.innerHTML = `
      <strong>${r.name}</strong><br>
      ⭐ ${r.streak.totalCommits || 0} commits<br>
      <a href="./repo.html?repo=${encodeURIComponent(r.full_name)}">View Details</a>
    `;
    container.appendChild(el);
  });
}

// Year Selector
function populateYearSelector(heatmapData) {
  const years = new Set();
  heatmapData.forEach(item => {
    const year = new Date(item.date).getFullYear();
    years.add(year);
  });
  
  const sortedYears = Array.from(years).sort((a, b) => b - a);
  const selector = document.getElementById("year-selector");
  
  sortedYears.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    selector.appendChild(option);
  });
  
  selector.addEventListener("change", (e) => {
    renderHeatmap(e.target.value);
  });
}

function renderHeatmap(selectedYear) {
  const container = document.getElementById("cal-heatmap");
  container.innerHTML = ""; // Clear previous heatmap
  
  let startDate, endDate, range, filteredData;
  
  if (selectedYear === 'all') {
    if (heatmapData.length === 0) {
      // No data, fallback to last 12 months from today
      const today = new Date();
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
      range = 12;
      filteredData = [];
    } else {
      // Use actual earliest and latest commit dates from heatmapData
      const dates = heatmapData.map(d => new Date(d.date));
      const earliestDate = new Date(Math.min(...dates));
      const latestCommitDate = new Date(Math.max(...dates));
      const today = new Date();

      // Normalize earliestDate to first day of month
      startDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);

      // For endDate, choose the later of latest commit date or today
      const maxDate = latestCommitDate > today ? latestCommitDate : today;
      endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0); // last day of that month

      // Calculate months difference + 1
      range = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;

      // Filter data within range (should be all, but just in case)
      filteredData = heatmapData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= startDate && itemDate <= endDate;
      });
    }
  } else {
    // Show specific year (all 12 months)
    const year = parseInt(selectedYear);
    startDate = new Date(year, 0, 1); // January 1st
    endDate = new Date(year, 11, 31); // December 31st
    range = 12;
    
    // Filter data for selected year
    filteredData = heatmapData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });
  }

  console.log('Rendering heatmap:', {
    selectedYear,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    dataPoints: filteredData.length,
    range
  });

  const cal = new CalHeatmap();
  cal.paint({
    target: "#cal-heatmap",
    data: { source: filteredData, x: "date", y: "count" },
    date: { start: startDate },
    range: range,
    domain: { 
      type: "month", 
      gutter: 4,
      label: { text: "MMM", textAlign: "start", position: "top" }
    },
    subDomain: { 
      type: "day", 
      width: 11, 
      height: 11, 
      gutter: 2,
      radius: 2
    },
    scale: { 
      color: { 
        type: "threshold", 
        domain: [1, 3, 6, 9],
        range: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
      }
    }
  });
}


// Event Listeners
window.onclick = function(event) {
  const modal = document.getElementById('pinned-modal');
  if (event.target === modal) {
    closePinnedModal();
  }
}

// Initialize on load
loadProfile();