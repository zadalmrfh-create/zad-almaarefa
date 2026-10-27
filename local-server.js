import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./server.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;

// Only public files are served. Never expose source, credentials, or dependencies.
const blockedSegments = new Set(["node_modules", ".git", "books"]);
const blockedNames = new Set([
  "server.js", "local-server.js", "test-gemini.js", "package.json",
  "package-lock.json", "vercel.json", ".env", ".env.example",
  ".gitignore", "readme.md", "start-local.bat", "start-tunnel.bat", "readme-chatbot-ar.txt", "library-catalog.json", "summary-text-index.json", "chatbot-updates-ar.txt", "chatbot-pro-updates-ar.txt"
]);
app.use((req, res, next) => {
  let decoded;
  try { decoded = decodeURIComponent(req.path).toLowerCase(); }
  catch { return res.sendStatus(400); }
  const parts = decoded.split(/[\/\\]/).filter(Boolean);
  if (parts.some(part => part.startsWith(".") || blockedSegments.has(part) || blockedNames.has(part)) || /\.(?:map|log|bak|sql|env|bat|ps1|sh|md|json)$/i.test(decoded)) {
    return res.sendStatus(403);
  }
  next();
});
app.use(express.static(path.join(root, "public"), { dotfiles: "deny", index: "index.html" }));
app.use((req, res) => res.status(404).send("Not found"));
app.listen(port, "127.0.0.1", () => {
  console.log(`Zad Al-Maarefa local site: http://localhost:${port}`);
  if (!process.env.GEMINI_API_KEY) console.warn("GEMINI_API_KEY is missing: chatbot is unavailable.");
});
