const express = require("express");
const router = express.Router();
const { readCommandsFile, writeCommandsFile } = require("../utils");

// Get all commands
router.get("/", async (req, res) => {
  try {
    const cmds = await readCommandsFile();
    res.json(cmds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create or update a command
router.post("/", async (req, res) => {
  try {
    const { cmd, desc } = req.body;
    if (!cmd || !desc) return res.status(400).json({ error: "cmd and desc required" });
    const all = await readCommandsFile();
    all[cmd] = desc;
    await writeCommandsFile(all);
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a command
router.delete("/:cmd", async (req, res) => {
  try {
    const { cmd } = req.params;
    const all = await readCommandsFile();
    if (!all[cmd]) return res.status(404).json({ error: "Command not found" });
    delete all[cmd];
    await writeCommandsFile(all);
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename a command
router.patch("/rename", async (req, res) => {
  try {
    const { oldCmd, newCmd, desc } = req.body;
    if (!oldCmd || !newCmd) return res.status(400).json({ error: "oldCmd and newCmd required" });
    const all = await readCommandsFile();
    if (!all[oldCmd]) return res.status(404).json({ error: "oldCmd not found" });
    const value = desc || all[oldCmd];
    delete all[oldCmd];
    all[newCmd] = value;
    await writeCommandsFile(all);
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
