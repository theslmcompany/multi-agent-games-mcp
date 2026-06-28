// Standalone server to view the chess board widget on its own, with no MCP host.
// The widget detects there is no host and renders a built-in demo (cycling
// emotions + thinking clouds) so you can iterate on the UI in isolation.
//
//   pnpm build && pnpm preview      # then open http://localhost:9007
//
// For live-reload development of the widget alone, use `pnpm ui:dev` (Vite).
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PREVIEW_PORT) || 9007;
const uiDir = path.join(__dirname, "dist", "ui");
const widget = path.join(uiDir, "widget.html");

const app = express();

app.get("/", (_req, res) => {
  if (!fs.existsSync(widget)) {
    res
      .status(503)
      .send("Widget not built yet. Run `pnpm build` (or `pnpm build:ui`) first.");
    return;
  }
  res.sendFile(widget);
});

app.use(express.static(uiDir));

app.listen(port, "0.0.0.0", () => {
  console.log(`Chess widget preview running on http://0.0.0.0:${port}`);
  if (!fs.existsSync(widget)) {
    console.log("  (widget not built yet — run `pnpm build` first)");
  }
});
