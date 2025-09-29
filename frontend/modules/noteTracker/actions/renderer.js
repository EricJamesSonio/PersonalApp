// renderer.js
const { fs, path, dirname } = window.electronAPI;

const foldersFile = path.join(dirname, "..", "storage", "folders.json");
const timelineFile = path.join(dirname, "..", "storage", "timeline.json");

let currentFolderIndex = null;

function initStorage() {
  if (!fs.existsSync(foldersFile)) fs.writeFileSync(foldersFile, "[]");
  if (!fs.existsSync(timelineFile)) fs.writeFileSync(timelineFile, "[]");
}

function logAction(action) {
  const timeline = JSON.parse(fs.readFileSync(timelineFile, "utf8"));
  timeline.push({ action, date: new Date().toLocaleString() });
  fs.writeFileSync(timelineFile, JSON.stringify(timeline, null, 2));
  renderTimeline();
}

function loadFolders() {
  initStorage();
  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  const listEl = document.getElementById("folders");
  listEl.innerHTML = "";

  if (folders.length === 0) {
    listEl.innerHTML = "<li>No folders yet</li>";
  } else {
    folders.forEach((f, idx) => {
      const li = document.createElement("li");
      li.textContent = `${f.name} (created: ${f.createdAt})`;
      li.onclick = () => openFolder(idx);
      listEl.appendChild(li);
    });
  }
}

function renderTimeline() {
  const timeline = JSON.parse(fs.readFileSync(timelineFile, "utf8"));
  const timelineEl = document.getElementById("timeline");
  timelineEl.innerHTML = "";
  timeline.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = `[${entry.date}] ${entry.action}`;
    timelineEl.appendChild(li);
  });
}

function createFolder() {
  const name = prompt("Enter folder name:");
  if (!name) return;

  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  folders.push({ name, createdAt: new Date().toLocaleString(), notes: [] });
  fs.writeFileSync(foldersFile, JSON.stringify(folders, null, 2));

  logAction(`Created folder "${name}"`);
  loadFolders();
}

function viewFolder() {
  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  if (folders.length === 0) return alert("No folders available");

  const choice = prompt(`Enter folder index (0 - ${folders.length - 1}):`);
  if (choice === null) return;
  const idx = parseInt(choice, 10);
  if (isNaN(idx) || idx < 0 || idx >= folders.length) return alert("Invalid index");

  openFolder(idx);
}

function renameFolder() {
  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  if (folders.length === 0) return alert("No folders available");

  const choice = prompt(`Enter folder index (0 - ${folders.length - 1}):`);
  if (choice === null) return;
  const idx = parseInt(choice, 10);
  if (isNaN(idx) || idx < 0 || idx >= folders.length) return alert("Invalid index");

  const newName = prompt("Enter new name:", folders[idx].name);
  if (!newName) return;

  folders[idx].name = newName;
  fs.writeFileSync(foldersFile, JSON.stringify(folders, null, 2));

  logAction(`Renamed folder to "${newName}"`);
  loadFolders();
}

function removeFolder() {
  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  if (folders.length === 0) return alert("No folders available");

  const choice = prompt(`Enter folder index (0 - ${folders.length - 1}):`);
  if (choice === null) return;
  const idx = parseInt(choice, 10);
  if (isNaN(idx) || idx < 0 || idx >= folders.length) return alert("Invalid index");

  if (!confirm(`Are you sure you want to remove "${folders[idx].name}"?`)) return;

  const removed = folders.splice(idx, 1)[0];
  fs.writeFileSync(foldersFile, JSON.stringify(folders, null, 2));

  logAction(`Removed folder "${removed.name}"`);
  loadFolders();
}

function openFolder(idx) {
  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  currentFolderIndex = idx;

  document.getElementById("folder-view").style.display = "none";
  document.getElementById("notes-view").style.display = "block";
  document.getElementById("folder-title").textContent = `📂 ${folders[idx].name}`;

  renderNotes();
}

function renderNotes() {
  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  if (currentFolderIndex === null) return;
  const notes = folders[currentFolderIndex].notes;

  const listEl = document.getElementById("notes");
  listEl.innerHTML = "";
  notes.forEach((note, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${note.date}</b>: ${note.text}
      <button onclick="updateNote(${i})">Edit</button>
      <button onclick="removeNote(${i})">Delete</button>`;
    listEl.appendChild(li);
  });
}

function addNote() {
  if (currentFolderIndex === null) return alert("No folder open");

  const text = document.getElementById("note-text").value.trim();
  if (!text) return;

  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  const note = { text, date: new Date().toLocaleString() };
  folders[currentFolderIndex].notes.push(note);

  fs.writeFileSync(foldersFile, JSON.stringify(folders, null, 2));
  logAction(`Added note to "${folders[currentFolderIndex].name}"`);

  document.getElementById("note-text").value = "";
  renderNotes();
}

function updateNote(idx) {
  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  const folder = folders[currentFolderIndex];
  const newText = prompt("Edit note:", folder.notes[idx].text);
  if (!newText) return;

  folder.notes[idx].text = newText;
  folder.notes[idx].date = new Date().toLocaleString();
  fs.writeFileSync(foldersFile, JSON.stringify(folders, null, 2));
  logAction(`Updated note in "${folder.name}"`);

  renderNotes();
}

function removeNote(idx) {
  const folders = JSON.parse(fs.readFileSync(foldersFile, "utf8"));
  const folder = folders[currentFolderIndex];

  if (!confirm(`Remove note: "${folder.notes[idx].text}"?`)) return;

  folder.notes.splice(idx, 1);
  fs.writeFileSync(foldersFile, JSON.stringify(folders, null, 2));
  logAction(`Removed note from "${folder.name}"`);

  renderNotes();
}

document.addEventListener("DOMContentLoaded", () => {
  loadFolders();
  renderTimeline();
});

// expose functions to window
window.createFolder = createFolder;
window.viewFolder = viewFolder;
window.renameFolder = renameFolder;
window.removeFolder = removeFolder;
window.addNote = addNote;
window.updateNote = updateNote;
window.removeNote = removeNote;
