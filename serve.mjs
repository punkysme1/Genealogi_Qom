import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const appDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(appDir, "dist");

app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(3002, "127.0.0.1", () => {
  console.log("Nasab listening on 127.0.0.1:3002");
});
