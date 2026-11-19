// Placeholder leaderboard stored in this browser (localStorage).
// TODO(PHP): replace the bodies of these three functions with fetch() calls to your
// backend (read the top 10, save a score). The callers already expect Promises,
// so nothing else in the game has to change.

export type ScoreEntry = {
  name: string
  score: number
}

const STORAGE_KEY = 'oceanhub.leaderboard'
const TOP_COUNT = 10

function load(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ScoreEntry[]) : []
  } catch {
    return []
  }
}

export async function getTopScores(): Promise<ScoreEntry[]> {
  return load()
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_COUNT)
}

// Game Over check: does this score earn a place in the top 10?
export async function qualifiesForLeaderboard(score: number): Promise<boolean> {
  if (score <= 0) return false

  const top = await getTopScores()
  return top.length < TOP_COUNT || score > top[top.length - 1].score
}

export async function submitScore(name: string, score: number): Promise<ScoreEntry[]> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...load(), { name, score }]))
  return getTopScores()
}