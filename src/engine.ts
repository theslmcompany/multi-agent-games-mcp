import { Chess } from "chess.js";
import type {
  Color,
  Disc,
  Engine,
  EngineView,
  GameVariant,
  LastMove,
  MoveRecord,
} from "./types.js";

/** Chess engine backed by chess.js (move validation, FEN/PGN, end detection). */
export class ChessEngine implements Engine {
  readonly variant: GameVariant = "chess";
  private chess = new Chess();
  private last: LastMove | null = null;
  private hist: MoveRecord[] = [];

  turn(): Color {
    return this.chess.turn();
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  move(color: Color, move: string): void {
    const parsed = this.parseMove(move);
    let result;
    try {
      result = this.chess.move(parsed);
    } catch {
      throw new Error(`Illegal move: "${move}". Legal moves: ${this.chess.moves().join(", ")}`);
    }
    this.last = { san: result.san, from: result.from, to: result.to };
    this.hist.push({ san: result.san, by: color, fen: this.chess.fen() });
  }

  view(): EngineView {
    const { status, winner, drawReason } = this.status();
    return {
      turn: this.chess.turn(),
      status,
      winner,
      drawReason,
      lastMove: this.last,
      history: this.hist,
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      inCheck: this.chess.inCheck(),
    };
  }

  /** Accept SAN ("Nf3") or coordinate ("e2e4", "e7e8q"). */
  private parseMove(move: string): string | { from: string; to: string; promotion?: string } {
    const m = move.trim();
    const coord = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(m);
    if (coord) {
      return {
        from: coord[1].toLowerCase(),
        to: coord[2].toLowerCase(),
        promotion: coord[3]?.toLowerCase(),
      };
    }
    return m;
  }

  private status(): { status: EngineView["status"]; winner: Color | null; drawReason: string | null } {
    if (this.chess.isCheckmate()) {
      // Side to move is checkmated, so the other side won.
      return { status: "checkmate", winner: this.chess.turn() === "w" ? "b" : "w", drawReason: null };
    }
    if (this.chess.isStalemate()) {
      return { status: "stalemate", winner: null, drawReason: "stalemate" };
    }
    if (this.chess.isDraw()) {
      let reason = "50-move rule or repetition";
      if (this.chess.isInsufficientMaterial()) reason = "insufficient material";
      else if (this.chess.isThreefoldRepetition()) reason = "threefold repetition";
      return { status: "draw", winner: null, drawReason: reason };
    }
    return { status: "active", winner: null, drawReason: null };
  }
}

const C4_ROWS = 6;
const C4_COLS = 7;

/** Connect Four: 7 columns x 6 rows, drop discs, first to four-in-a-row wins. */
export class Connect4Engine implements Engine {
  readonly variant: GameVariant = "connect4";
  // board[row][col]; row 0 is the TOP row, row 5 the bottom.
  private board: Disc[][];
  private turnColor: Color = "w"; // red ("w" seat) moves first
  private last: LastMove | null = null;
  private hist: MoveRecord[] = [];
  private winner: Color | null = null;

  constructor() {
    this.board = Connect4Engine.emptyBoard();
  }

  private static emptyBoard(): Disc[][] {
    return Array.from({ length: C4_ROWS }, () => Array.from({ length: C4_COLS }, () => "" as Disc));
  }

  turn(): Color {
    return this.turnColor;
  }

  isGameOver(): boolean {
    return this.winner !== null || this.isFull();
  }

  move(color: Color, move: string): void {
    const col = this.parseColumn(move);
    // Drop: find the lowest empty row in this column.
    let row = -1;
    for (let r = C4_ROWS - 1; r >= 0; r--) {
      if (this.board[r][col] === "") {
        row = r;
        break;
      }
    }
    if (row < 0) {
      throw new Error(`Column ${col + 1} is full. Choose another column (1–${C4_COLS}).`);
    }
    const disc: Disc = color === "w" ? "r" : "y";
    this.board[row][col] = disc;
    const san = `col ${col + 1}`;
    this.last = { san, cell: { row, col } };
    this.hist.push({ san, by: color });
    if (this.isWin(row, col, disc)) {
      this.winner = color;
    } else {
      this.turnColor = color === "w" ? "b" : "w";
    }
  }

  view(): EngineView {
    let status: EngineView["status"] = "active";
    let winner: Color | null = null;
    let drawReason: string | null = null;
    if (this.winner !== null) {
      status = "win";
      winner = this.winner;
    } else if (this.isFull()) {
      status = "draw";
      drawReason = "board full";
    }
    return {
      turn: this.turnColor,
      status,
      winner,
      drawReason,
      lastMove: this.last,
      history: this.hist,
      board: this.board.map((r) => [...r]),
      rows: C4_ROWS,
      cols: C4_COLS,
    };
  }

  private parseColumn(move: string): number {
    const m = move.trim().toLowerCase();
    // Accept "4", "col 4", "c4" — extract the first 1–7 digit.
    const digit = /([1-7])/.exec(m);
    if (!digit) {
      throw new Error(`Invalid column "${move}". Drop into a column 1–${C4_COLS} (e.g. "4").`);
    }
    return Number(digit[1]) - 1;
  }

  private isFull(): boolean {
    return this.board[0].every((cell) => cell !== "");
  }

  /** Check for four-in-a-row through the just-placed disc at (row, col). */
  private isWin(row: number, col: number, disc: Disc): boolean {
    const dirs: Array<[number, number]> = [
      [0, 1], // horizontal
      [1, 0], // vertical
      [1, 1], // diagonal down-right
      [1, -1], // diagonal down-left
    ];
    for (const [dr, dc] of dirs) {
      let count = 1;
      count += this.countDir(row, col, dr, dc, disc);
      count += this.countDir(row, col, -dr, -dc, disc);
      if (count >= 4) return true;
    }
    return false;
  }

  private countDir(row: number, col: number, dr: number, dc: number, disc: Disc): number {
    let n = 0;
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLS && this.board[r][c] === disc) {
      n++;
      r += dr;
      c += dc;
    }
    return n;
  }
}

export function makeEngine(variant: GameVariant): Engine {
  return variant === "connect4" ? new Connect4Engine() : new ChessEngine();
}
