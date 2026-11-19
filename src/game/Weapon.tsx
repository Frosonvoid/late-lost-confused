import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import {
  FIRE_COOLDOWN_MS,
  MAX_TORPEDOES,
  TORPEDO_LIFETIME,
  TORPEDO_RADIUS,
  TORPEDO_SPEED,
} from './config'
import type { GameSession } from './GameSession'

// One reusable torpedo. Logic only: TorpedoLauncher draws it.
export class Torpedo {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  active = false

  private readonly previous = new THREE.Vector3()
  private readonly path = new THREE.Line3()
  private readonly closest = new THREE.Vector3()
  private age = 0

  launch(origin: THREE.Vector3, direction: THREE.Vector3) {
    this.position.copy(origin)
    this.previous.copy(origin)
    this.velocity.copy(direction).multiplyScalar(TORPEDO_SPEED)
    this.age = 0
    this.active = true
  }

  update(delta: number) {
    if (!this.active) return

    this.previous.copy(this.position)
    this.position.addScaledVector(this.velocity, delta)

    this.age += delta
    if (this.age > TORPEDO_LIFETIME) this.active = false
  }

  // Checks the whole path travelled this frame, so a fast torpedo cannot skip through a fish.
  hits(center: THREE.Vector3, radius: number) {
    this.path.set(this.previous, this.position)
    this.path.closestPointToPoint(center, true, this.closest)

    return this.closest.distanceTo(center) <= radius + TORPEDO_RADIUS
  }

  detonate() {
    this.active = false
  }
}

// Left click fires a torpedo along the camera's view while the mouse is captured.
export function TorpedoLauncher({ session }: { session: GameSession }) {
  const camera = useThree((state) => state.camera)

  const torpedoes = useMemo(
    () => Array.from({ length: MAX_TORPEDOES }, () => new Torpedo()),
    [],
  )
  const groups = useRef<(THREE.Group | null)[]>([])
  const forward = useRef(new THREE.Vector3())
  const origin = useRef(new THREE.Vector3())
  const aim = useRef(new THREE.Vector3())
  const lastShot = useRef(0)

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      // Only while the mouse is captured, so the click that captures it does not fire.
      if (event.button !== 0 || !document.pointerLockElement || !session.isPlaying) return

      const now = performance.now()
      if (now - lastShot.current < FIRE_COOLDOWN_MS) return

      const torpedo = torpedoes.find((candidate) => !candidate.active)
      if (!torpedo) return

      lastShot.current = now
      camera.getWorldDirection(forward.current)
      origin.current.copy(camera.position).addScaledVector(forward.current, 2)
      torpedo.launch(origin.current, forward.current)
    }

    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [camera, session, torpedoes])

  useFrame((_, delta) => {
    torpedoes.forEach((torpedo, index) => {
      if (torpedo.active) {
        torpedo.update(Math.min(delta, 0.1))

        const target = session.mobs.find(
          (mob) => mob.isAlive && torpedo.hits(mob.position, mob.hitRadius),
        )

        if (target) {
          session.scoreHit(target, torpedo.velocity)
          if (!target.isDodging) {
            torpedo.detonate()
          }
        }
      }

      const group = groups.current[index]
      if (!group) return

      group.visible = torpedo.active

      if (torpedo.active) {
        group.position.copy(torpedo.position)
        aim.current.copy(torpedo.position).add(torpedo.velocity)
        group.lookAt(aim.current)
      }
    })
  })

  return (
    <>
      {torpedoes.map((_, index) => (
        <group
          key={index}
          ref={(node) => {
            groups.current[index] = node
          }}
          visible={false}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.08, 0.6, 4, 8]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
        </group>
      ))}
    </>
  )
}