import { z } from "zod";

// --- Game variants ---

export const GAME_VARIANTS = ["chess", "connect4"] as const;
export type GameVariant = (typeof GAME_VARIANTS)[number];

export const NewGameSchema = z.object({
  variant: z
    .enum(GAME_VARIANTS)
    .describe(
      'Which game to play: "chess" or "connect4". Resets the board to the starting ' +
        "position and clears both player seats so two players can re-join."
    ),
});
export type NewGame = z.infer<typeof NewGameSchema>;

// --- Tool inputs ---

export const JoinGameSchema = z.object({
  name: z
    .string()
    .optional()
    .describe("Optional display name for this player. Defaults to the x-player-id header value."),
});
export type JoinGame = z.infer<typeof JoinGameSchema>;

export const MakeMoveSchema = z.object({
  move: z
    .string()
    .describe(
      "The move to play. CHESS: SAN (e.g. \"Nf3\", \"e4\", \"O-O\") or coordinate form " +
        '(e.g. "e2e4", "e7e8q" for promotion). CONNECT4: the column to drop your disc into, ' +
        '"1"–"7" from left to right (e.g. "4" for the center column).'
    ),
});
export type MakeMove = z.infer<typeof MakeMoveSchema>;

// Emotions that drive each player's virtual face on the board.
export const EMOTIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "nervous",
  "confident",
  "thinking",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const SetEmotionSchema = z.object({
  emotion: z
    .enum(EMOTIONS)
    .describe(
      "Your current emotion. Drives your virtual face on the board and is visible to your opponent: " +
        EMOTIONS.join(", ") +
        "."
    ),
  statement: z
    .string()
    .max(140)
    .optional()
    .describe(
      "Optional single-sentence status (a thought/taunt/plan) shown as a thinking cloud beside your face and readable by your opponent."
    ),
});
export type SetEmotion = z.infer<typeof SetEmotionSchema>;

// --- Public game state (sent to UI + returned by tools) ---

// Seats are always tracked as "w"/"b" internally (first/second to join) regardless
// of variant. In chess they render as White/Black; in connect4 as Red/Yellow.
export type Color = "w" | "b";
export type Seat = Color | "spectator";
export type GameStatus =
  | "waiting"
  | "active"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "win";

// A connect4 cell: empty, red ("w" seat) or yellow ("b" seat).
export type Disc = "" | "r" | "y";

export interface LastMove {
  san: string; // human label: "Nf3" (chess) or "col 4" (connect4)
  from?: string; // chess origin square
  to?: string; // chess destination square
  cell?: { row: number; col: number }; // connect4 dropped-disc cell
}

export interface MoveRecord {
  san: string;
  by: Color;
  fen?: string; // chess only
}

/** Variant-specific board fields produced by an engine. */
export interface EngineView {
  turn: Color;
  status: GameStatus;
  winner: Color | null;
  drawReason: string | null;
  lastMove: LastMove | null;
  history: MoveRecord[];
  // chess
  fen?: string;
  pgn?: string;
  inCheck?: boolean;
  // connect4
  board?: Disc[][];
  rows?: number;
  cols?: number;
}

/** A pluggable game engine. The coordinator owns seating; the engine owns the board. */
export interface Engine {
  readonly variant: GameVariant;
  turn(): Color;
  isGameOver(): boolean;
  /** Apply a move for `color`. Throws on an illegal move. */
  move(color: Color, move: string): void;
  /** Variant-specific board snapshot. */
  view(): EngineView;
}

export interface PublicGame {
  variant: GameVariant;
  turn: Color;
  white: string | null;
  black: string | null;
  status: GameStatus;
  winner: Color | null;
  drawReason: string | null;
  lastMove: LastMove | null;
  history: MoveRecord[];
  moveCount: number;
  // chess-only board fields
  fen?: string;
  pgn?: string;
  inCheck?: boolean;
  // connect4-only board fields
  board?: Disc[][];
  rows?: number;
  cols?: number;
  // Current emotion of each seated player (neutral when unset/empty).
  whiteEmotion: Emotion;
  blackEmotion: Emotion;
  // Optional single-sentence status shown as a thinking cloud beside the face.
  whiteStatement: string | null;
  blackStatement: string | null;
  // Identity of the session reading this state (from x-player-id header).
  you: string | null;
  yourColor: Color | null;
}
