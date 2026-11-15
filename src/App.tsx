import { Canvas } from '@react-three/fiber'

import { GameScene } from './game/GameScene'

export default function App() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#010812',
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 0],
          fov: 80,
          near: 0.1,
          far: 10000,
        }}
        gl={{ antialias: true }}
      >
        <GameScene />
      </Canvas>

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

      {/* Targeting reticle */}
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

      {/* Submarine HUD */}
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
        MOUSE — LOOK
        <br />
        ESC — RELEASE MOUSE
      </div>
    </div>
  )
}