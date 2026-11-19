import { useGameSession, useHarpoonCharge, type GameSession } from './GameSession'

export function HarpoonChargeBar({ session }: { session: GameSession }) {
  const { status } = useGameSession(session)
  const charge = useHarpoonCharge(session)

  if (status !== 'playing' || charge <= 0) return null

  const percent = Math.round(charge * 100)
  const isFull = charge >= 0.95
  const barColor = isFull ? '#2ee59d' : charge >= 0.5 ? '#38bdf8' : '#bfeaff'
  const glowColor = isFull ? 'rgba(46, 229, 157, 0.85)' : 'rgba(0, 180, 216, 0.75)'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 180,
        pointerEvents: 'none',
        fontFamily: 'monospace',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          marginBottom: 4,
          fontSize: 11,
          letterSpacing: '0.14em',
          color: barColor,
          textShadow: `0 0 8px ${glowColor}`,
        }}
      >
        {isFull ? 'MAX PRESSURE' : `PRESSURE ${percent}%`}
      </div>
      <div
        style={{
          width: '100%',
          height: 6,
          background: 'rgba(1, 14, 28, 0.85)',
          border: '1px solid rgba(191, 234, 255, 0.4)',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 0 10px rgba(0, 180, 216, 0.3)',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: barColor,
            boxShadow: `0 0 8px ${glowColor}`,
          }}
        />
      </div>
    </div>
  )
}