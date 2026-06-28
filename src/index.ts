import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import express, { Request, Response } from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JoinGameSchema, MakeMoveSchema, SetEmotionSchema, NewGameSchema } from "./types.js";
import { game } from "./game.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transports: { [sessionId: string]: StreamableHTTPServerTransport | undefined } = {};
const UI_URI = "ui://chess-ui/index.html";

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }] };
}

function okResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

/**
 * @param playerId  the value of the x-player-id header for THIS session,
 *                  captured at initialize time and closed over by every tool.
 */
function createMcpServer(playerId: string | null): McpServer {
  const server = new McpServer({ name: "chess-ui", version: "1.0.0" });

  const requirePlayer = (): string => {
    if (!playerId) {
      throw new Error(
        "Missing player identity. Send an 'x-player-id' header when connecting to this MCP server."
      );
    }
    return playerId;
  };

  // Seat the calling player and open the board panel.
  registerAppTool(
    server,
    "join_game",
    {
      title: "Join Game",
      description:
        "Join the current game (chess or connect4) and open the board. The first player to join takes the first seat (White / Red), the second takes the second seat (Black / Yellow). Your identity comes from the x-player-id header.",
      _meta: { ui: { resourceUri: UI_URI } },
      inputSchema: JoinGameSchema.shape,
    },
    async () => {
      try {
        const id = requirePlayer();
        const { seat, message } = game.seat(id);
        return okResult({ seat, message, game: game.toPublic(id) });
      } catch (err: unknown) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // Make a move; re-opens / refreshes the board panel.
  registerAppTool(
    server,
    "make_move",
    {
      title: "Make Move",
      description:
        "Play a move on your turn. CHESS: SAN (\"Nf3\", \"e4\", \"O-O\") or coordinate (\"e2e4\", \"e7e8q\"). CONNECT4: the column to drop into, \"1\"–\"7\". Errors if it is not your turn or the move is illegal.",
      _meta: { ui: { resourceUri: UI_URI } },
      inputSchema: MakeMoveSchema.shape,
    },
    async ({ move }) => {
      try {
        const id = requirePlayer();
        const state = game.move(id, move);
        return okResult({ message: `Played ${move}.`, game: state });
      } catch (err: unknown) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // Set the calling player's emotion; drives their virtual face on the board.
  registerAppTool(
    server,
    "set_emotion",
    {
      title: "Set Emotion",
      description:
        "Set your current emotion and an optional single-sentence status. The emotion drives your virtual face and the status shows as a thinking cloud beside it; both are visible to your opponent via get_opponent_emotion. Emotion is one of: neutral, happy, sad, angry, surprised, nervous, confident, thinking.",
      _meta: { ui: { resourceUri: UI_URI } },
      inputSchema: SetEmotionSchema.shape,
    },
    async ({ emotion, statement }) => {
      try {
        const id = requirePlayer();
        const { color } = game.setEmotion(id, emotion, statement);
        return okResult({
          message: `Emotion set to ${emotion}${statement ? ` — "${statement}"` : ""}.`,
          color,
          game: game.toPublic(id),
        });
      } catch (err: unknown) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // Read the opponent's current emotion.
  server.registerTool(
    "get_opponent_emotion",
    {
      description:
        "Fetch your opponent's current emotion and status statement (the other seated player). Returns neutral / null if they have not set one.",
    },
    async () => {
      try {
        const id = requirePlayer();
        return okResult(game.opponentEmotion(id));
      } catch (err: unknown) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // Polled by the UI and usable by agents to read the board.
  server.registerTool(
    "get_board",
    {
      description:
        "Return the current board state: variant, whose turn, status, winner, move history, and the board (chess FEN/PGN or connect4 grid).",
    },
    async () => okResult(game.toPublic(playerId))
  );

  // Reset to a fresh game and clear both seats.
  registerAppTool(
    server,
    "reset_game",
    {
      title: "Reset Game",
      description: "Reset the board to the starting position and clear both player seats.",
      _meta: { ui: { resourceUri: UI_URI } },
      inputSchema: {},
    },
    async () => {
      try {
        game.reset();
        return okResult({ message: "Game reset.", game: game.toPublic(playerId) });
      } catch (err: unknown) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // Switch the game variant (chess <-> connect4); resets the board and seats.
  registerAppTool(
    server,
    "new_game",
    {
      title: "New Game",
      description:
        "Start a new game of a chosen variant: \"chess\" or \"connect4\". Resets the board to the starting position and clears both seats so players re-join with join_game.",
      _meta: { ui: { resourceUri: UI_URI } },
      inputSchema: NewGameSchema.shape,
    },
    async ({ variant }) => {
      try {
        game.newGame(variant);
        return okResult({
          message: `New ${variant} game started. Both seats cleared — call join_game to take a seat.`,
          game: game.toPublic(playerId),
        });
      } catch (err: unknown) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // UI resource. Falls back to src/ui/widget.html so `pnpm dev` works pre-build.
  registerAppResource(server, UI_URI, UI_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => {
    let htmlPath = path.join(__dirname, "..", "dist", "ui", "widget.html");
    try {
      await fs.access(htmlPath);
    } catch {
      htmlPath = path.join(__dirname, "ui", "widget.html");
    }
    const html = await fs.readFile(htmlPath, "utf-8");
    return { contents: [{ uri: UI_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
  });

  return server;
}

async function main() {
  const app = express();
  const port = Number(process.env.PORT) || 9006;

  app.use(
    cors({
      origin: "*",
      exposedHeaders: ["mcp-session-id"],
      allowedHeaders: ["content-type", "mcp-session-id", "x-player-id"],
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId]!;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Capture the player identity at initialize time for this whole session.
      const playerId = ((req.headers["x-player-id"] as string) || "").trim() || null;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport;
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) delete transports[transport.sessionId];
      };
      const server = createMcpServer(playerId);
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session." },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId]!.handleRequest(req, res);
  });

  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId]!.handleRequest(req, res);
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`Chess UI MCP server running on http://0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
