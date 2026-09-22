export interface Player {
  name: string;
  score: number;
}

// In-memory only, like the existing drawn/hearts counters — a session
// doesn't survive a reload, and that's fine: it's meant to track one
// sitting, not to be a persistent profile system.
let players: Player[] = [];
let currentIndex = 0;

export function startSession(names: string[]): void {
  players = names.map((name) => ({ name, score: 0 }));
  currentIndex = 0;
}

export function endSession(): void {
  players = [];
  currentIndex = 0;
}

/** Same players, scores back to zero, turn back to the first player. */
export function restartSession(): void {
  for (const p of players) p.score = 0;
  currentIndex = 0;
}

export function hasSession(): boolean {
  return players.length > 0;
}

export function getPlayers(): Player[] {
  return players;
}

export function getCurrentIndex(): number {
  return currentIndex;
}

export function currentPlayer(): Player | null {
  return players[currentIndex] ?? null;
}

export function advanceTurn(): void {
  if (players.length === 0) return;
  currentIndex = (currentIndex + 1) % players.length;
}

export function awardPointToCurrent(): void {
  const player = currentPlayer();
  if (player) player.score++;
}

// Whoever actually earned a card's point — guessed right, won a physical
// challenge, and so on — is decided by the players themselves and isn't
// necessarily whoever's turn it is to read the card, so scoring needs to be
// assignable to any player, not just the current one.
export function awardPointTo(index: number): void {
  const player = players[index];
  if (player) player.score++;
}

/** Ranked by score, highest first; ties keep their original turn order. */
export function getStandings(): Player[] {
  return [...players].sort((a, b) => b.score - a.score);
}
