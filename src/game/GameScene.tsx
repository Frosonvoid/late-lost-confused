import { Suspense, useMemo } from 'react'
import { PointerLockControls } from '@react-three/drei'

import { DeepSea } from './DeepSea'
import { MobsLayer } from './MobViews'
import { Cockpit, FlightControls, Submarine } from './Submarine'

export function GameScene() {
  const submarine = useMemo(() => new Submarine(), [])

  return (
    <>
      <DeepSea />
      <MobsLayer />

      <Suspense fallback={null}>
        <Cockpit />
      </Suspense>

      <PointerLockControls />
      <FlightControls submarine={submarine} />
    </>
  )
}