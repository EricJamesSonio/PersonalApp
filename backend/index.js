require("dotenv").config();
const express = require("express");
const cors = require("cors");

const githubRoutes = require("./github/github");
const commandRoutes = require("./commands/commands");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/commands", commandRoutes);
app.use("/", githubRoutes);

// Root
app.get("/", (req, res) => {
  res.send("✅ Tracker Backend running! Try /repos or /api/commands");
});

// Start server
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
