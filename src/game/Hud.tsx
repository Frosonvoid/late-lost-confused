import { useEffect, useState, type CSSProperties } from 'react'

import { MAX_HULL } from './config'
import { useGameSession, type GameSession } from './GameSession'
import {
  getTopScores,
  qualifiesForLeaderboard,
  type ScoreEntry,
} from './Leaderboard'
const text: CSSProperties = {
  color: '#bfeaff',
  fontFamily: 'monospace',
  textShadow: '0 0 8px #00b4d8',
}

const button: CSSProperties = {
  ...text,
  padding: '8px 18px',
  fontSize: 14,
  cursor: 'pointer',
  background: 'rgba(0, 180, 216, 0.15)',
  border: '1px solid #00b4d8',
  borderRadius: 4,
}

function GameOverPanel({ session, score }: { session: GameSession; score: number }) {
  const [top, setTop] = useState<ScoreEntry[]>([])
  const [canSubmit, setCanSubmit] = useState(false)
  const [name, setName] = useState(session.playerName)

  // High-score check as soon as the game ends.
  useEffect(() => {
    let cancelled = false

    Promise.all([getTopScores(), qualifiesForLeaderboard(score)]).then(
      ([scores, qualifies]) => {
        if (cancelled) return
        setTop(scores)
        setCanSubmit(qualifies)
      },
    )

    return () => {
      cancelled = true
    }
  }, [score])

  const submit = async () => {
    setTop(await session.submit(name.trim() || session.playerName))
    setCanSubmit(false)
  }

  return (
    <div
      style={{
        ...text,
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'rgba(1, 8, 18, 0.88)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontSize: 34, color: '#ff7b7b' }}>GAME OVER</div>
      <div style={{ fontSize: 20 }}>FINAL SCORE: {score}</div>

      {canSubmit && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div>NEW HIGH SCORE! SUBMIT TO THE LEADERBOARD</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={name}
              maxLength={16}
              onChange={(event) => setName(event.target.value)}
              style={{ ...button, cursor: 'text', width: 160 }}
            />
            <button style={button} onClick={submit}>
              SUBMIT
            </button>
          </div>
        </div>
      )}

      <div style={{ minWidth: 260 }}>
        <div style={{ marginBottom: 6 }}>LEADERBOARD — TOP 10</div>
        {top.length === 0 && <div style={{ opacity: 0.6 }}>No scores yet</div>}
        {top.map((entry, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {index + 1}. {entry.name}
            </span>
            <span>{entry.score}</span>
          </div>
        ))}
      </div>

      <button style={button} onClick={() => session.restart()}>
        PLAY AGAIN
      </button>
    </div>
  )
}

export function Hud({ session }: { session: GameSession }) {
  const { score, hull, status, event } = useGameSession(session)
  const hullRatio = hull / MAX_HULL

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <style>{`
        @keyframes oceanhub-toast {
          0% { opacity: 0; transform: translate(-50%, 8px); }
          10% { opacity: 1; transform: translate(-50%, 0); }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Player info */}
      <div style={{ ...text, position: 'absolute', top: 20, left: 20, fontSize: 12, lineHeight: 1.8 }}>
        <div>PILOT: {session.playerName}</div>
        <div style={{ fontSize: 22 }}>SCORE {score}</div>
        <div>
          HULL {hull}/{MAX_HULL}
        </div>
        <div style={{ width: 180, height: 8, background: 'rgba(191, 234, 255, 0.2)' }}>
          <div
            style={{
              width: `${hullRatio * 100}%`,
              height: '100%',
              background: hullRatio > 0.3 ? '#2ee6a6' : '#ff5c5c',
            }}
          />
        </div>
      </div>

      {/* Objective */}
      <div
        style={{
          ...text,
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 12,
          textAlign: 'center',
        }}
      >
        ELIMINATE INVASIVE LIONFISH // PROTECT NATIVE SPECIES
      </div>

      {/* Score and damage feedback */}
      {event && (
        <div
          key={event.id}
          style={{
            ...text,
            position: 'absolute',
            top: '32%',
            left: '50%',
            fontSize: 18,
            color: event.good ? '#2ee6a6' : '#ff7b7b',
            animation: 'oceanhub-toast 1.5s forwards',
          }}
        >
          {event.text}
        </div>
      )}

      {status === 'gameover' && <GameOverPanel session={session} score={score} />}
    </div>
  )
}