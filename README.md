# chess-ui

MCP server where **two agents play a board game** — **chess** or **Connect Four** —
against each other, with a live board rendered in a UI panel. Each agent identifies
itself with an `x-player-id` HTTP header; the first to join takes the first seat
(White / Red), the second takes the second seat (Black / Yellow).

## Run

```sh
pnpm install
pnpm dev                 # tsx, no build (port 9006)
# or
pnpm build && pnpm start
curl http://localhost:9006/health   # -> {"status":"ok"}
```

Override the port with `PORT=9999 pnpm start`.

## How two agents connect

Each agent connects to `http://localhost:9006/mcp` and **must send an
`x-player-id` header** identifying itself. The id is captured when the MCP
session initializes and bound to that session for its lifetime.

```
Agent A  --(x-player-id: alice)-->  /mcp   => seated White
Agent B  --(x-player-id: bob)  -->  /mcp   => seated Black
```

Both sessions share **one** game (state lives at module scope, not per-session),
so the two agents play the same board.

## Tools

| Tool | Input | Purpose |
|------|-------|---------|
| `new_game` | `variant` | Switch the game to `chess` or `connect4`. Resets the board and clears both seats. |
| `join_game` | `name?` | Take a seat (first → White/Red, second → Black/Yellow). Opens the board panel. |
| `make_move` | `move` | Play a move on your turn. **Chess:** SAN (`Nf3`, `O-O`) or coordinate (`e2e4`, `e7e8q`). **Connect4:** the column `1`–`7`. Rejects wrong-turn / illegal moves. |
| `set_emotion` | `emotion`, `statement?` | Set your emotion (drives your virtual face) plus an optional one-sentence status (shown as a thinking cloud). Both visible to the opponent. |
| `get_opponent_emotion` | – | Fetch the opponent's current emotion + status statement. |
| `get_board` | – | Read current state: variant, turn, status, winner, history, the board (chess FEN/PGN or connect4 grid), and both players' emotions/statements. Polled by the UI. |
| `reset_game` | – | Reset the current variant's board and clear both seats. |

Emotions: `neutral, happy, sad, angry, surprised, nervous, confident, thinking`.

## Game variants

The server starts in **chess**. Call `new_game` with `variant: "connect4"` (or back
to `"chess"`) to switch — it resets the board and clears both seats, so the two
agents then re-`join_game`. Seats are always tracked as first/second internally and
labelled per variant: White/Black for chess, Red/Yellow for Connect Four (Red, the
first seat, moves first). Connect Four is a 7-column × 6-row board; drop a disc into
a column `1`–`7` and win with four in a row (horizontal, vertical, or diagonal).

## Emotions & status clouds

Each agent can broadcast an `emotion` and a single-sentence `statement` via
`set_emotion`. The emotion renders as a virtual SVG face beside that player; the
statement renders as a thinking cloud next to the face. The opponent reads both
with `get_opponent_emotion` (or from `get_board`), so emotions are a shared
signalling channel — bluff, taunt, or telegraph as you like.

## Run the widget on its own

Two ways to view the board UI without an MCP host (it auto-detects no host and
renders a static demo board — no churn):

```sh
pnpm build && pnpm preview   # static server -> http://localhost:9007
# or, with live reload while editing the UI:
pnpm ui:dev                  # Vite dev server (prints its own URL)
```

Override the preview port with `PREVIEW_PORT=9999 pnpm preview`. Preview URL params:
`?game=connect4` to preview the Connect Four board, and `?emotion=<name>` /
`?blackEmotion=<name>` to preview a specific face.

## UI

`new_game` / `join_game` / `make_move` / `reset_game` carry `_meta.ui.resourceUri`
so invoking them opens the panel (`ui://chess-ui/index.html`). The widget polls
`get_board` every 1.5s and renders per variant: a chess board from FEN (flipped when
you are Black) or the Connect Four grid of dropped discs. It highlights the last
move and lists move history. Built as a single inlined HTML file via
`vite-plugin-singlefile`.

## Notes

- Chess rules (legality, check, checkmate, stalemate, draws) are handled by
  [`chess.js`](https://github.com/jhlywa/chess.js) — not hand-rolled. Connect Four
  (drop, win detection, full-board draw) is a small built-in engine in `src/engine.ts`.
- Both variants are pluggable `Engine`s; the coordinator (`src/game.ts`) owns seating
  and the shared emotion channel and delegates the board to the active engine.
- Missing `x-player-id` => tools error asking for the header. `get_board` still
  works (read-only) but you are treated as a spectator.
