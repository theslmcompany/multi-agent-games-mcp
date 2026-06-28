import { makeEngine } from "./engine.js";
import type { Color, Seat, Engine, GameVariant, PublicGame, Emotion } from "./types.js";

/**
 * Single shared game shared across all MCP sessions. Two different agents
 * connect as two different MCP sessions but play on ONE board, so this state
 * lives at module scope (a singleton) rather than in a per-session closure.
 *
 * Seating + emotion live here; the board itself is delegated to a pluggable
 * `Engine` (chess or connect4) so the same multiplayer plumbing serves both.
 */
class GameManager {
  private engine: Engine = makeEngine("chess");
  private white: string | null = null;
  private black: string | null = null;
  private emotions: Record<string, Emotion> = {};
  private statements: Record<string, string> = {};

  get variant(): GameVariant {
    return this.engine.variant;
  }

  /** Switch to a different game variant; resets the board and clears both seats. */
  newGame(variant: GameVariant): void {
    this.engine = makeEngine(variant);
    this.clear();
  }

  /** Reset the current variant to its starting position and clear both seats. */
  reset(): void {
    this.engine = makeEngine(this.engine.variant);
    this.clear();
  }

  private clear(): void {
    this.white = null;
    this.black = null;
    this.emotions = {};
    this.statements = {};
  }

  /** Seat a player. First caller is white/red, second (different id) is black/yellow. */
  seat(playerId: string): { seat: Seat; message: string } {
    const [first, second] = this.seatLabels();
    if (this.white === playerId) return { seat: "w", message: `You are already seated as ${first}.` };
    if (this.black === playerId) return { seat: "b", message: `You are already seated as ${second}.` };

    if (this.white === null) {
      this.white = playerId;
      return { seat: "w", message: `Seated as ${first}. Waiting for ${second} to join.` };
    }
    if (this.black === null) {
      this.black = playerId;
      return { seat: "b", message: `Seated as ${second}. Game on — ${first} moves first.` };
    }
    return { seat: "spectator", message: "Both seats are taken. You are a spectator." };
  }

  colorOf(playerId: string | null): Color | null {
    if (!playerId) return null;
    if (this.white === playerId) return "w";
    if (this.black === playerId) return "b";
    return null;
  }

  /** Validate + apply a move on behalf of playerId. Throws on any illegal state. */
  move(playerId: string, move: string): PublicGame {
    if (this.white === null || this.black === null) {
      throw new Error("Game has not started — both players must join first.");
    }
    if (this.engine.isGameOver()) {
      throw new Error("Game is over. Call reset_game or new_game to start a new game.");
    }

    const color = this.colorOf(playerId);
    if (color === null) {
      throw new Error("You are a spectator and cannot move. Both seats are taken.");
    }
    if (color !== this.engine.turn()) {
      throw new Error(`Not your turn. It is ${this.labelOf(this.engine.turn())} to move.`);
    }

    this.engine.move(color, move);
    return this.toPublic(playerId);
  }

  /** Set the emotion (and optional status statement) for a player (must be seated). */
  setEmotion(playerId: string, emotion: Emotion, statement?: string): { color: Color } {
    const color = this.colorOf(playerId);
    if (color === null) {
      throw new Error("You must join the game (take a seat) before setting an emotion.");
    }
    this.emotions[playerId] = emotion;
    if (statement !== undefined) {
      const trimmed = statement.trim();
      if (trimmed) this.statements[playerId] = trimmed;
      else delete this.statements[playerId];
    }
    return { color };
  }

  /** The emotion currently displayed by whoever is seated in `color`. */
  emotionOf(color: Color): Emotion {
    const id = color === "w" ? this.white : this.black;
    return (id && this.emotions[id]) || "neutral";
  }

  /** The status statement of whoever is seated in `color`, or null. */
  statementOf(color: Color): string | null {
    const id = color === "w" ? this.white : this.black;
    return (id && this.statements[id]) || null;
  }

  /** Look up the opponent of `playerId` and return their emotion + statement. */
  opponentEmotion(playerId: string): {
    opponent: string | null;
    opponentColor: Color | null;
    emotion: Emotion;
    statement: string | null;
    waiting: boolean;
  } {
    const myColor = this.colorOf(playerId);
    if (myColor === null) {
      throw new Error("You are not seated. Join the game to see your opponent's emotion.");
    }
    const oppColor: Color = myColor === "w" ? "b" : "w";
    const opponent = oppColor === "w" ? this.white : this.black;
    return {
      opponent,
      opponentColor: oppColor,
      emotion: this.emotionOf(oppColor),
      statement: this.statementOf(oppColor),
      waiting: opponent === null,
    };
  }

  /** Human label for a seat color, per current variant. */
  private labelOf(color: Color): string {
    const [first, second] = this.seatLabels();
    return color === "w" ? first : second;
  }

  private seatLabels(): [string, string] {
    return this.engine.variant === "connect4" ? ["Red", "Yellow"] : ["White", "Black"];
  }

  toPublic(playerId: string | null): PublicGame {
    const v = this.engine.view();
    const bothSeated = this.white !== null && this.black !== null;
    // Until both seats are filled the game is "waiting" regardless of the engine.
    const status = bothSeated ? v.status : "waiting";
    return {
      variant: this.engine.variant,
      turn: v.turn,
      white: this.white,
      black: this.black,
      status,
      winner: bothSeated ? v.winner : null,
      drawReason: bothSeated ? v.drawReason : null,
      lastMove: v.lastMove,
      history: v.history,
      moveCount: v.history.length,
      fen: v.fen,
      pgn: v.pgn,
      inCheck: v.inCheck,
      board: v.board,
      rows: v.rows,
      cols: v.cols,
      whiteEmotion: this.emotionOf("w"),
      blackEmotion: this.emotionOf("b"),
      whiteStatement: this.statementOf("w"),
      blackStatement: this.statementOf("b"),
      you: playerId,
      yourColor: this.colorOf(playerId),
    };
  }
}

export const game = new GameManager();
