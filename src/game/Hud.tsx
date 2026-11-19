import { useEffect, useState, type FormEvent } from 'react'

import { useGameSession, type GameEvent, type GameSession } from './GameSession'
import type { ScoreEntry } from './Leaderboard'

export function Hud({ session }: { session: GameSession }) {
  const { score, hull, status, event } = useGameSession(session)

  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null)
  const [pilotName, setPilotName] = useState<string>(session.playerName)
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Show dodge, damage, and elimination notifications briefly when triggered.
  useEffect(() => {
    if (!event) return
    setActiveEvent(event)
    const timer = window.setTimeout(() => {
      setActiveEvent((current) => (current?.id === event.id ? null : current))
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [event])

  // Reset Game Over submission state whenever a new run begins.
  useEffect(() => {
    if (status === 'playing') {
      setLeaderboard(null)
      setSubmitError(null)
      setSubmitting(false)
    }
  }, [status])

  const handleSubmitScore = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting || leaderboard) return

    const trimmed = pilotName.trim().toUpperCase() || session.playerName
    setSubmitting(true)
    setSubmitError(null)

    try {
      const entries = await session.submit(trimmed)
      setLeaderboard(entries)
    } catch {
      setSubmitError('FAILED TO UPLOAD SCORE')
    } finally {
      setSubmitting(false)
    }
  }

  const clampedHull = Math.max(0, Math.min(100, Math.round(hull)))
  const hullColor =
    clampedHull > 50 ? '#2ee59d' : clampedHull > 25 ? '#f59e0b' : '#ef4444'

  return (
    <>
      {/* Top-Left: Pilot, Score & Hull Integrity */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          color: '#bfeaff',
          fontFamily: 'monospace',
          pointerEvents: 'none',
          textShadow: '0 0 8px #00b4d8',
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: '0.1em', opacity: 0.9 }}>
          PILOT: {session.playerName}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.06em',
            margin: '4px 0 8px',
          }}
        >
          SCORE {score}
        </div>
        <div style={{ fontSize: 12, letterSpacing: '0.08em', marginBottom: 4 }}>
          HULL {clampedHull}/100
        </div>
        <div
          style={{
            width: 170,
            height: 8,
            background: 'rgba(1, 14, 28, 0.85)',
            border: '1px solid rgba(191, 234, 255, 0.35)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${clampedHull}%`,
              height: '100%',
              background: hullColor,
              boxShadow: `0 0 8px ${hullColor}`,
              transition: 'width 0.15s ease, background-color 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* Top-Center: Mission Objective */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#bfeaff',
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: '0.14em',
          textAlign: 'center',
          pointerEvents: 'none',
          textShadow: '0 0 8px #00b4d8',
          whiteSpace: 'nowrap',
        }}
      >
        ELIMINATE INVASIVE LIONFISH // PROTECT NATIVE SPECIES
      </div>

      {/* Combat Event Feed: Dodge, Hull Damage, Eliminations & Penalties */}
      {status === 'playing' && activeEvent && (
        <div
          key={activeEvent.id}
          style={{
            position: 'absolute',
            top: 62,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 14px',
            background: 'rgba(1, 14, 28, 0.82)',
            border: `1px solid ${activeEvent.good ? 'rgba(46, 229, 157, 0.6)' : 'rgba(255, 107, 107, 0.65)'}`,
            borderRadius: 4,
            color: activeEvent.good ? '#2ee59d' : '#ff7b7b',
            fontFamily: 'monospace',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.12em',
            pointerEvents: 'none',
            textShadow: activeEvent.good
              ? '0 0 10px rgba(46, 229, 157, 0.6)'
              : '0 0 10px rgba(255, 107, 107, 0.6)',
            whiteSpace: 'nowrap',
          }}
        >
          {activeEvent.text}
        </div>
      )}

      {/* Game Over & Leaderboard Modal */}
      {status === 'gameover' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(1, 8, 18, 0.82)',
            backdropFilter: 'blur(4px)',
            fontFamily: 'monospace',
            color: '#bfeaff',
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: 380,
              maxWidth: '90vw',
              padding: 28,
              background: 'rgba(4, 20, 38, 0.95)',
              border: '1px solid rgba(191, 234, 255, 0.4)',
              borderRadius: 6,
              boxShadow: '0 0 30px rgba(0, 180, 216, 0.25)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#ff7b7b',
                letterSpacing: '0.14em',
                textShadow: '0 0 12px rgba(255, 107, 107, 0.6)',
              }}
            >
              HULL BREACHED // GAME OVER
            </div>

            <div
              style={{
                margin: '14px 0 20px',
                fontSize: 18,
                letterSpacing: '0.1em',
                color: '#2ee59d',
              }}
            >
              FINAL SCORE: {score}
            </div>

            {!leaderboard ? (
              <form onSubmit={handleSubmitScore} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    marginBottom: 8,
                    opacity: 0.85,
                  }}
                >
                  ENTER CALLSIGN FOR LEADERBOARD
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    maxLength={16}
                    value={pilotName}
                    onChange={(e) => setPilotName(e.target.value)}
                    placeholder="CALLSIGN"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      background: 'rgba(1, 10, 22, 0.9)',
                      border: '1px solid rgba(191, 234, 255, 0.4)',
                      borderRadius: 4,
                      color: '#bfeaff',
                      fontFamily: 'monospace',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(0, 180, 216, 0.25)',
                      border: '1px solid #38bdf8',
                      borderRadius: 4,
                      color: '#bfeaff',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      cursor: submitting ? 'default' : 'pointer',
                    }}
                  >
                    {submitting ? 'SAVING...' : 'SUBMIT'}
                  </button>
                </div>
                {submitError && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#ff7b7b' }}>
                    {submitError}
                  </div>
                )}
              </form>
            ) : (
              <div
                style={{
                  marginBottom: 18,
                  padding: 12,
                  background: 'rgba(1, 10, 22, 0.75)',
                  border: '1px solid rgba(191, 234, 255, 0.25)',
                  borderRadius: 4,
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    marginBottom: 8,
                    color: '#38bdf8',
                  }}
                >
                  TOP REEF DEFENDERS
                </div>
                {leaderboard.slice(0, 5).map((entry, idx) => (
                  <div
                    key={`${entry.name}-${idx}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      padding: '3px 0',
                      borderBottom: '1px solid rgba(191, 234, 255, 0.1)',
                    }}
                  >
                    <span>
                      {idx + 1}. {entry.name}
                    </span>
                    <span style={{ color: '#2ee59d' }}>{entry.score}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => session.restart()}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'rgba(46, 229, 157, 0.2)',
                border: '1px solid #2ee59d',
                borderRadius: 4,
                color: '#2ee59d',
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              DEPLOY AGAIN
            </button>
          </div>
        </div>
      )}
    </>
  )
}