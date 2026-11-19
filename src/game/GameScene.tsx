import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'

import { DeepSea } from './DeepSea'
import { useGameSession, type GameSession } from './GameSession'
import { MobsLayer } from './MobViews'
import { Cockpit, FlightControls } from './Submarine'
import { TorpedoLauncher } from './Weapon'

function GameLoop({ session }: { session: GameSession }) {
  const camera = useThree((state) => state.camera)
  const { status } = useGameSession(session)

  useEffect(() => {
    if (status === 'playing') camera.position.set(0, 0, 0)
  }, [camera, status])

  useFrame((_, delta) => session.update(Math.min(delta, 0.1), camera.position))

  return null
}

// Draws the cockpit after the ocean/fish pass and clears the depth buffer once per frame
// so fish never clip inside the cockpit walls, without overriding R3F's render pipeline.
function CockpitForeground({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null)
  const lastClearedFrame = useRef(-1)

  useFrame(({ camera }) => {
    const applyForeground = (root: THREE.Object3D | null) => {
      root?.traverse((obj) => {
        if (obj === camera || !(obj instanceof THREE.Mesh)) return
        obj.renderOrder = 10
        obj.frustumCulled = false
        obj.onBeforeRender = (renderer) => {
          if (lastClearedFrame.current !== renderer.info.render.frame) {
            lastClearedFrame.current = renderer.info.render.frame
            renderer.clearDepth()
          }
        }
      })
    }

    applyForeground(groupRef.current)
    applyForeground(camera)
  })

  return <group ref={groupRef}>{children}</group>
}

export function GameScene({ session }: { session: GameSession }) {
  const { status } = useGameSession(session)

  useEffect(() => {
    if (status === 'gameover') document.exitPointerLock()
  }, [status])

  return (
    <>
      <GameLoop session={session} />
      <FlightControls session={session} />

      <DeepSea />
      <MobsLayer session={session} />
      <TorpedoLauncher session={session} />

      <CockpitForeground>
        <Suspense fallback={null}>
          <Cockpit />
        </Suspense>
      </CockpitForeground>

      {status === 'playing' && <PointerLockControls />}
    </>
  )
}