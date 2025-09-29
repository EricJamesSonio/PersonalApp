console.log("🚀 terminal.js executing...");

(function () {
  let terminalInstance = null;
  let currentHighlight = null;
  let commandHistory = [];
  let historyIndex = -1;

  function initTerminal(options = {}) {
    const highlightCallback = options.onHighlight || (() => {});

    // Create terminal container if not already
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
      output.style.flex = "1";
      output.style.overflowY = "auto";
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
        "terminal-line " + (isCommand ? "terminal-command" : "terminal-output");
      line.textContent = text;
      terminalOutput.appendChild(line);
      terminalOutput.scrollTop = terminalOutput.scrollHeight;
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
          const desc = cmds[cmd].toLowerCase();

          if (desc.includes("highlight")) {
            if (currentHighlight) {
              currentHighlight.forEach((el) => el.classList.remove("highlight"));
              appendLine("Highlight removed.");
              currentHighlight = null;
              highlightCallback(null);
            } else {
              appendLine("No highlight to remove.");
            }
          } else if (desc.includes("open the terminal dashboard")) {
            window.open(
              `${window.location.origin}/terminal/terminal-dashboard.html`,
              "_blank"
            );
            appendLine("Opening terminal dashboard...");
          } else {
            appendLine(`→ ${cmds[cmd]}`);
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
        const cmd = terminalInput.value.trim().toLowerCase();
        if (!cmd) return;
        commandHistory.push(cmd);
        historyIndex = -1;
        appendLine(cmd, true);
        handleCommand(cmd);
        terminalInput.value = "";
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "`") {
        const isVisible = terminalContainer.style.display !== "none";
        terminalContainer.style.display = isVisible ? "none" : "flex";
        if (!isVisible) terminalInput.focus();
      }

      if (terminalContainer.style.display !== "none") {
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

    window.terminalInstance = terminalInstance;
    return terminalInstance;
  }

console.log("✅ window.initTerminal exposed");

// ✅ Also tell preload (if available)
if (window.electronAPI && typeof window.electronAPI.registerInitTerminal === "function") {
  console.log("📢 Calling electronAPI.registerInitTerminal from terminal.js");
  window.electronAPI.registerInitTerminal(initTerminal);
}

})();
