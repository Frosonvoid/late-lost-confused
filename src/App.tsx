import { useState } from 'react'
import { Canvas } from '@react-three/fiber'

import { ErrorBoundary } from './game/ErrorBoundary'
import { GameScene } from './game/GameScene'
import { GameSession } from './game/GameSession'
import { HarpoonChargeBar } from './game/HarpoonChargeBar'
import { Hud } from './game/Hud'

// Any crash is printed on screen instead of leaving a white page.
function ErrorScreen(error: Error) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 24,
        color: '#ff9b9b',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
      }}
    >
      {error.stack ?? error.message}
    </pre>
  )
}

export default function App() {
  const [session] = useState(() => new GameSession())

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#010812',
      }}
    >
      <ErrorBoundary fallback={ErrorScreen}>
        <Canvas
          camera={{
            position: [0, 0, 0],
            fov: 80,
            near: 0.1,
            far: 10000,
          }}
          gl={{ antialias: true }}
        >
          <GameScene session={session} />
        </Canvas>
      </ErrorBoundary>

      {/* Deep-water vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0, 12, 28, 0.55) 100%)',
        }}
      />

      {/* Targeting reticle & harpoon pressure gauge */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#bfeaff',
          fontSize: 24,
          pointerEvents: 'none',
          textShadow: '0 0 10px #00b4d8',
        }}
      >
        +
      </div>
      <HarpoonChargeBar session={session} />

      {/* Score, hull, objective and Game Over screen */}
      <Hud session={session} />

      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          left: 20,
          bottom: 20,
          color: '#bfeaff',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.8,
          pointerEvents: 'none',
          textShadow: '0 0 8px #00b4d8',
        }}
      >
        SUBMARINE SYSTEM // ONLINE
        <br />
        WASD / ARROWS — MOVE
        <br />
        SPACE / CTRL — ASCEND / DESCEND
        <br />
        SHIFT — BOOST
        <br />
        MOUSE — LOOK / AIM
        <br />
        HOLD LEFT CLICK — CHARGE HARPOON
        <br />
        ESC — RELEASE MOUSE
      </div>
    </div>
  )
}