// terminal.js
export let terminalInstance = null;

export function initTerminal(options = {}) {
  const highlightCallback = options.onHighlight || (() => {});
  let currentHighlight = null;
  const commandHistory = [];
  let historyIndex = -1;

  // Create terminal elements if not already
  if (!document.getElementById("terminal-container")) {
    const container = document.createElement("div");
    container.id = "terminal-container";
    container.style.display = "none";
    container.style.position = "fixed";
    container.style.bottom = "20px"; 
    container.style.left = "50%"; 
    container.style.transform = "translateX(-50%)"; 
    container.style.width = "600px"; 
    container.style.height = "150px";
    container.style.backgroundColor = "#1e1e1e";
    container.style.color = "#fff";
    container.style.fontFamily = "monospace";
    container.style.border = "2px solid #333"; 
    container.style.borderRadius = "8px"; 
    container.style.overflow = "hidden";
    container.style.padding = "5px";
    container.style.zIndex = "9999";
    container.style.flexDirection = "column";

    const output = document.createElement("div");
    output.id = "terminal-output";
    output.style.flex = "1"; // Fill space above input
    output.style.overflowY = "auto"; // Scrollable content
    container.appendChild(output);

    const input = document.createElement("input");
    input.type = "text";
    input.id = "terminal-input";
    input.placeholder = "Type command (e.g., dishl)";
    input.style.width = "100%";
    input.style.background = "none";
    input.style.border = "none";
    input.style.color = "#fff";
    input.style.fontFamily = "monospace";
    input.style.outline = "none";
    input.style.padding = "5px";
    container.appendChild(input);

    document.body.appendChild(container);
  }

  const terminalContainer = document.getElementById("terminal-container");
  const terminalInput = document.getElementById("terminal-input");
  const terminalOutput = document.getElementById("terminal-output");

  function appendLine(text, isCommand = false) {
    const line = document.createElement("div");
    line.className =
      "terminal-line " +
      (isCommand ? "terminal-command" : "terminal-output");
    line.textContent = text;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight; // Scroll to bottom
  }

  async function fetchCommands() {
    const res = await fetch("http://localhost:4000/api/commands");
    if (!res.ok) throw new Error("Failed to fetch commands");
    return await res.json();
  }

async function handleCommand(cmd) {
  try {
    const cmds = await fetchCommands();

    if (cmds[cmd]) {
      const desc = cmds[cmd];
      const lowerDesc = desc.toLowerCase();

      // Map description → actual function
      if (lowerDesc.includes("highlight")) {
        // remove highlights
        if (currentHighlight) {
          currentHighlight.forEach((el) => el.classList.remove("highlight"));
          appendLine("Highlight removed.");
          currentHighlight = null;
          highlightCallback(null);
        } else {
          appendLine("No highlight to remove.");
        }
      } else if (lowerDesc.includes("open the terminal dashboard")) {
        // Open dashboard
        const baseUrl = window.location.origin;
        window.open(`${baseUrl}/terminal-dashboard.html`, "_blank");
        appendLine("Opening terminal dashboard...");
      } else {
        // Default: just echo description
        appendLine(`→ ${desc}`);
      }
    } else {
      appendLine(`Unknown command: ${cmd}`);
    }
  } catch (err) {
    appendLine("Error: " + err.message);
  }
}

  terminalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const cmd = e.target.value.trim().toLowerCase();
      if (!cmd) return;
      commandHistory.push(cmd);
      historyIndex = -1;
      appendLine(cmd, true);
      handleCommand(cmd);
      terminalInput.value = "";
    }
  });

  document.addEventListener("keydown", (e) => {
    // Toggle terminal: Ctrl + `
    if (e.ctrlKey && e.key === "`") {
      const isVisible = terminalContainer.style.display === "flex";
      terminalContainer.style.display = isVisible ? "none" : "flex";
      if (!isVisible) terminalInput.focus(); // focus only when opened
    }

    // Command history navigation
    if (terminalContainer.style.display === "flex") {
      if (e.key === "ArrowUp") {
        if (historyIndex < commandHistory.length - 1) historyIndex++;
        terminalInput.value =
          commandHistory[commandHistory.length - 1 - historyIndex] || "";
      } else if (e.key === "ArrowDown") {
        if (historyIndex > 0) historyIndex--;
        terminalInput.value =
          commandHistory[commandHistory.length - 1 - historyIndex] || "";
      }
    }
  });

  function highlightElements(elements) {
    if (currentHighlight)
      currentHighlight.forEach((el) => el.classList.remove("highlight"));
    currentHighlight = elements;
    if (currentHighlight)
      currentHighlight.forEach((el) => el.classList.add("highlight"));
    highlightCallback(currentHighlight);
  }

  terminalInstance = {
    highlight: highlightElements,
    removeHighlight: () => {
      if (currentHighlight)
        currentHighlight.forEach((el) => el.classList.remove("highlight"));
      currentHighlight = null;
    },
    appendLine,
  };

  return terminalInstance;
}
