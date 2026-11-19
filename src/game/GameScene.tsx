import { Suspense, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'

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

export function GameScene({ session }: { session: GameSession }) {
  const { status } = useGameSession(session)

  useEffect(() => {
    if (status === 'gameover') document.exitPointerLock()
  }, [status])

  return (
    <>
      <DeepSea />
      <MobsLayer session={session} />
      <TorpedoLauncher session={session} />

      <Suspense fallback={null}>
        <Cockpit />
      </Suspense>

      {status === 'playing' && <PointerLockControls />}

      <GameLoop session={session} />
      <FlightControls session={session} />
    </>
  )
}