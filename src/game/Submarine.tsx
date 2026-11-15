import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import cockpitUrl from '../assets/cockpit.glb?url'
import {
  BOOST_MULTIPLIER,
  COCKPIT_OFFSET,
  CRUISE_SPEED,
  MAX_HULL,
  OCEAN_HALF_SIZE,
  SEABED_Y,
  SURFACE_Y,
  WATER_DRAG,
} from './config'

// Game logic for the player's submarine. No rendering in here.
export class Submarine {
  readonly velocity = new THREE.Vector3()

  private hull = MAX_HULL
  private readonly target = new THREE.Vector3()

  get hullIntegrity() {
    return this.hull
  }

  get isDestroyed() {
    return this.hull <= 0
  }

  takeDamage(amount: number) {
    this.hull = Math.max(0, this.hull - amount)
  }

  reset() {
    this.hull = MAX_HULL
    this.velocity.set(0, 0, 0)
  }

  // Water drag: accelerates slowly toward the wanted direction and glides to a stop.
  steer(direction: THREE.Vector3, boosting: boolean, delta: number) {
    const speed = CRUISE_SPEED * (boosting ? BOOST_MULTIPLIER : 1)

    this.target.copy(direction).multiplyScalar(speed)
    this.velocity.lerp(this.target, 1 - Math.exp(-WATER_DRAG * delta))
  }
}

export function Cockpit() {
  const { scene } = useGLTF(cockpitUrl)
  const camera = useThree((state) => state.camera)
  const rootScene = useThree((state) => state.scene)

  const model = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    // Make the existing cockpit surfaces visible from inside.
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material]

        materials.forEach((material) => {
          material.side = THREE.DoubleSide
          material.needsUpdate = true
        })
      }
    })

    // Center the existing model around the camera.
    model.position.set(0, 0, 0)
    model.rotation.set(0, Math.PI, 0)
    model.scale.setScalar(9)
    model.updateMatrixWorld(true)

    // Calculate the center after rotation.
    const bounds = new THREE.Box3().setFromObject(model)
    const center = bounds.getCenter(new THREE.Vector3())

    // Move the rotated cockpit so its center aligns with the camera.
    model.position.copy(center).negate().add(COCKPIT_OFFSET)

    // R3F's default camera is not part of the scene graph, so anything
    // parented to it is never rendered. Add the camera to the scene first.
    rootScene.add(camera)
    camera.add(model)

    return () => {
      camera.remove(model)
      rootScene.remove(camera)
    }
  }, [camera, model, rootScene])

  return null
}

export function FlightControls({ submarine }: { submarine: Submarine }) {
  const camera = useThree((state) => state.camera)

  const keys = useRef(new Set<string>())
  const direction = useRef(new THREE.Vector3())
  const movement = useRef(new THREE.Vector3())

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code)
    }

    const onBlur = () => keys.current.clear()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useFrame((_, delta) => {
    const k = keys.current

    // "C" is an alternate descend key, because Ctrl+W closes the browser tab.
    direction.current.set(
      Number(k.has('KeyD') || k.has('ArrowRight')) -
        Number(k.has('KeyA') || k.has('ArrowLeft')),

      Number(k.has('Space')) -
        Number(k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC')),

      Number(k.has('KeyS') || k.has('ArrowDown')) -
        Number(k.has('KeyW') || k.has('ArrowUp')),
    )

    if (direction.current.lengthSq() > 1) {
      direction.current.normalize()
    }

    const boosting = k.has('ShiftLeft') || k.has('ShiftRight')
    submarine.steer(direction.current, boosting, delta)

    // Move relative to the direction the pilot is looking.
    movement.current.copy(submarine.velocity).applyQuaternion(camera.quaternion)
    camera.position.addScaledVector(movement.current, delta)

    // Stay inside the ocean: above the seabed, below the surface, inside the arena.
    camera.position.x = THREE.MathUtils.clamp(
      camera.position.x,
      -OCEAN_HALF_SIZE,
      OCEAN_HALF_SIZE,
    )
    camera.position.y = THREE.MathUtils.clamp(
      camera.position.y,
      SEABED_Y + 8,
      SURFACE_Y - 2,
    )
    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z,
      -OCEAN_HALF_SIZE,
      OCEAN_HALF_SIZE,
    )
  })

  return null
}

useGLTF.preload(cockpitUrl)