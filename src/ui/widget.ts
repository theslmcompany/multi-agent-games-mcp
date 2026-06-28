import { App } from "@modelcontextprotocol/ext-apps";
import type { PublicGame, Color, Emotion, Disc, GameVariant } from "../types.js";
import { EMOTIONS } from "../types.js";
import { faceSvg } from "./faces.js";

const app = new App({ name: "Chess / Connect 4", version: "1.0.0" });

// "mcp" when embedded in an MCP host; "preview" when served standalone.
let mode: "mcp" | "preview" = "mcp";

async function callTool<T = unknown>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const result = await app.callServerTool({ name, arguments: args });
  const block = result.content?.find((c: { type: string }) => c.type === "text") as
    | { text: string }
    | undefined;
  const parsed = JSON.parse(block?.text ?? "{}") as Record<string, unknown>;
  if (parsed["error"]) throw new Error(parsed["error"] as string);
  return parsed as T;
}

const PIECES: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Seat labels per variant: [first seat ("w"), second seat ("b")]. */
function seatLabels(variant: GameVariant): [string, string] {
  return variant === "connect4" ? ["Red", "Yellow"] : ["White", "Black"];
}

function colorName(c: Color, variant: GameVariant): string {
  return seatLabels(variant)[c === "w" ? 0 : 1];
}

/** Draw a player's virtual face, emotion label, and status thinking cloud. */
function renderFace(side: Color, emotion: Emotion, statement: string | null) {
  const key = side === "w" ? "white" : "black";
  const faceEl = document.getElementById(`${key}-face`);
  const labelEl = document.getElementById(`${key}-emotion`);
  const cloudEl = document.getElementById(`${key}-cloud`);

  if (faceEl) faceEl.innerHTML = faceSvg(emotion, side);
  if (labelEl) labelEl.textContent = emotion;
  if (cloudEl) {
    if (statement) {
      cloudEl.innerHTML = escapeHtml(statement);
      cloudEl.removeAttribute("hidden");
    } else {
      cloudEl.textContent = "";
      cloudEl.setAttribute("hidden", "");
    }
  }
}

/** Parse the piece-placement field of a FEN into an 8x8 grid (rank 8 -> 0). */
function fenToGrid(fen: string): string[][] {
  const placement = fen.split(" ")[0];
  return placement.split("/").map((row) => {
    const cells: string[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) cells.push("");
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

function renderChessBoard(board: HTMLElement, state: PublicGame) {
  const grid = fenToGrid(state.fen ?? "");
  const flip = state.yourColor === "b";

  const ranks = flip ? [...grid].reverse() : grid;
  const lm = state.lastMove;

  let html = "";
  ranks.forEach((cells, rIdx) => {
    const rankNum = flip ? rIdx + 1 : 8 - rIdx; // actual rank 1..8
    const cols = flip ? [...cells].reverse() : cells;
    cols.forEach((piece, cIdx) => {
      const fileIdx = flip ? 7 - cIdx : cIdx;
      const square = `${FILES[fileIdx]}${rankNum}`;
      const dark = (fileIdx + rankNum) % 2 === 0;
      const isLast = lm && (lm.from === square || lm.to === square);
      const cls = ["sq", dark ? "dark" : "light", isLast ? "last" : ""].join(" ").trim();
      const glyph = piece ? PIECES[piece] ?? "" : "";
      const pcls = piece && piece === piece.toUpperCase() ? "wp" : "bp";
      html += `<div class="${cls}" data-sq="${square}">${
        glyph ? `<span class="piece ${pcls}">${glyph}</span>` : ""
      }</div>`;
    });
  });
  board.className = "board chess";
  board.innerHTML = html;
}

function renderConnect4Board(board: HTMLElement, state: PublicGame) {
  const grid: Disc[][] = state.board ?? [];
  const lm = state.lastMove;
  let html = "";
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      const isLast = !!lm?.cell && lm.cell.row === r && lm.cell.col === c;
      const disc = cell === "r" ? "red" : cell === "y" ? "yellow" : "empty";
      html += `<div class="c4cell"><span class="disc ${disc}${isLast ? " last" : ""}"></span></div>`;
    });
  });
  board.className = "board connect4";
  board.innerHTML = html;
}

function renderBoard(state: PublicGame) {
  const board = document.getElementById("board");
  if (!board) return;
  if (state.variant === "connect4") renderConnect4Board(board, state);
  else renderChessBoard(board, state);
}

function bannerText(state: PublicGame): string {
  switch (state.status) {
    case "waiting":
      return state.white && !state.black
        ? `Waiting for ${seatLabels(state.variant)[1]} to join…`
        : "Waiting for players to join…";
    case "checkmate":
      return `Checkmate — ${colorName(state.winner!, state.variant)} wins!`;
    case "win":
      return `${colorName(state.winner!, state.variant)} wins — four in a row!`;
    case "stalemate":
      return "Stalemate — draw.";
    case "draw":
      return `Draw — ${state.drawReason ?? "agreed"}.`;
    default: {
      const turn = `${colorName(state.turn, state.variant)} to move`;
      const me =
        state.yourColor && state.yourColor === state.turn ? "  (your move)" : "";
      const check = state.variant === "chess" && state.inCheck ? " — check!" : "";
      return `${turn}${check}${me}`;
    }
  }
}

function render(state: PublicGame) {
  const title = document.getElementById("app-title");
  const whiteEl = document.getElementById("white-name");
  const blackEl = document.getElementById("black-name");
  const banner = document.getElementById("banner");
  const movelist = document.getElementById("movelist");
  const [firstLabel, secondLabel] = seatLabels(state.variant);

  if (title) title.textContent = state.variant === "connect4" ? "Connect Four" : "Chess";

  // Recolor the seat swatches to match the variant.
  const wSwatch = document.querySelector("#player-white .swatch");
  const bSwatch = document.querySelector("#player-black .swatch");
  if (wSwatch) wSwatch.className = `swatch ${state.variant === "connect4" ? "red" : "white"}`;
  if (bSwatch) bSwatch.className = `swatch ${state.variant === "connect4" ? "yellow" : "black"}`;

  const meTag = (id: string | null) => (state.you && state.you === id ? " (you)" : "");

  if (whiteEl) whiteEl.textContent = `${firstLabel}: ${state.white ?? "waiting…"}${meTag(state.white)}`;
  if (blackEl) blackEl.textContent = `${secondLabel}: ${state.black ?? "waiting…"}${meTag(state.black)}`;
  if (banner) {
    banner.textContent = bannerText(state);
    banner.className = `banner ${state.status}`;
  }

  renderFace("w", state.whiteEmotion, state.whiteStatement);
  renderFace("b", state.blackEmotion, state.blackStatement);
  renderBoard(state);

  if (movelist) {
    let rows = "";
    for (let i = 0; i < state.history.length; i += 2) {
      const w = state.history[i]?.san ?? "";
      const b = state.history[i + 1]?.san ?? "";
      rows += `<li><span class="mv">${w}</span><span class="mv">${b}</span></li>`;
    }
    movelist.innerHTML = rows;
  }
}

// --- Standalone preview mock (used when not embedded in an MCP host) ---
// Static demo so the UI doesn't churn when there is no live game. URL params:
//   ?game=connect4         preview the connect4 board (default: chess)
//   ?emotion=happy / ?face=angry / ?blackEmotion=nervous   preview a face
const DEMO_MOVES = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6"];
function pickEmotion(param: string | null, fallback: Emotion): Emotion {
  return (EMOTIONS as readonly string[]).includes(param ?? "") ? (param as Emotion) : fallback;
}

function mockChess(q: URLSearchParams): PublicGame {
  const we = pickEmotion(q.get("emotion") ?? q.get("face"), "confident");
  const be = pickEmotion(q.get("blackEmotion"), "thinking");
  return {
    variant: "chess",
    fen: "rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5",
    pgn: "",
    inCheck: false,
    turn: "w",
    white: "demo-white",
    black: "demo-black",
    status: "active",
    winner: null,
    drawReason: null,
    lastMove: { san: "Nxd4", from: "f3", to: "d4" },
    history: DEMO_MOVES.map((san, i) => ({ san, by: i % 2 === 0 ? "w" : "b", fen: "" })),
    moveCount: DEMO_MOVES.length,
    whiteEmotion: we,
    blackEmotion: be,
    whiteStatement: "Preview mode — no live game (connect via the MCP host to play).",
    blackStatement: null,
    you: "demo-white",
    yourColor: "w",
  };
}

function mockConnect4(q: URLSearchParams): PublicGame {
  const we = pickEmotion(q.get("emotion") ?? q.get("face"), "confident");
  const be = pickEmotion(q.get("blackEmotion"), "thinking");
  const _ = "" as Disc;
  const r = "r" as Disc;
  const y = "y" as Disc;
  const board: Disc[][] = [
    [_, _, _, _, _, _, _],
    [_, _, _, _, _, _, _],
    [_, _, _, _, _, _, _],
    [_, _, _, r, _, _, _],
    [_, _, y, r, _, _, _],
    [_, y, y, r, r, _, _],
  ];
  return {
    variant: "connect4",
    board,
    rows: 6,
    cols: 7,
    turn: "b",
    white: "demo-red",
    black: "demo-yellow",
    status: "active",
    winner: null,
    drawReason: null,
    lastMove: { san: "col 4", cell: { row: 3, col: 3 } },
    history: [
      { san: "col 4", by: "w" }, { san: "col 3", by: "b" },
      { san: "col 4", by: "w" }, { san: "col 2", by: "b" },
      { san: "col 4", by: "w" }, { san: "col 3", by: "b" },
      { san: "col 5", by: "w" },
    ],
    moveCount: 7,
    whiteEmotion: we,
    blackEmotion: be,
    whiteStatement: "Preview mode — connect4 demo (connect via the MCP host to play).",
    blackStatement: null,
    you: "demo-red",
    yourColor: "w",
  };
}

function mockState(): PublicGame {
  const q = new URLSearchParams(location.search);
  const game = (q.get("game") ?? "").toLowerCase();
  return game === "connect4" ? mockConnect4(q) : mockChess(q);
}

async function getState(): Promise<PublicGame> {
  if (mode === "preview") return mockState();
  return callTool<PublicGame>("get_board");
}

let lastHash = "";
async function refresh() {
  try {
    const state = await getState();
    const hash = JSON.stringify(state);
    if (hash === lastHash) return;
    lastHash = hash;
    render(state);
  } catch (err) {
    console.error("refresh failed:", err);
  }
}

/** Connect to the MCP host, falling back to standalone preview after a timeout. */
async function connectOrPreview() {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("no MCP host")), 1200)
  );
  try {
    await Promise.race([app.connect(), timeout]);
  } catch {
    mode = "preview";
    const dot = document.querySelector(".status-text");
    if (dot) dot.textContent = "Preview";
  }
}

async function init() {
  await connectOrPreview();
  refresh();
  setInterval(refresh, 1500);
}

init();
