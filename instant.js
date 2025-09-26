const { spawn } = require("child_process");
const path = require("path");

// List of folders to install
const folders = ["backend", "frontend"];

// Function to run npm install in a folder
function installDependencies(folder) {
  return new Promise((resolve, reject) => {
    console.log(`\nInstalling dependencies in ${folder}...`);

    // Detect OS shell automatically
    const isWin = process.platform === "win32";
    const command = isWin ? "npm.cmd" : "npm"; // npm.cmd needed for Windows

    const child = spawn(command, ["install"], {
      cwd: path.join(__dirname, folder),
      stdio: "inherit",
      shell: true
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install failed in ${folder} with code ${code}`));
    });
  });
}

// Run installations sequentially
async function main() {
  try {
    for (const folder of folders) {
      await installDependencies(folder);
    }
    console.log("\n✅ All dependencies installed successfully!");
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  }
}

main();
