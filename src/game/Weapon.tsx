import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { useGameSession, type GameSession } from './GameSession'

// --- Tunable Harpoon Charge, Size & Water Physics Constants ---
const HARPOON_LENGTH = 3.8 // Enlarged length for clear underwater silhouette (up from 2.4)
const MIN_LAUNCH_SPEED = 32 // Quick tap: weaker launch, drops & slows down sooner
const MAX_LAUNCH_SPEED = 105 // Full charge: high-powered pneumatic shot, flat trajectory
const CHARGE_DURATION = 1.0 // Seconds to reach 100% charge
const WATER_DRAG = 0.52 // Exponential water resistance bleeding momentum over distance
const HARPOON_GRAVITY = 6.8 // Downward pull causing slower/longer shots to sink
const MIN_EFFECTIVE_SPEED = 5.5 // Despawns once piercing momentum is spent
const MAX_LIFETIME = 5.0
const FIRE_COOLDOWN = 0.25
const HARPOON_HIT_RADIUS = 0.55 // Scaled hitbox to match the larger harpoon

// Blender's Z-axis (Up) maps to Three.js's Y-axis in .glb exports.
const HARPOON_MODEL_ROTATION: [number, number, number] = [0, Math.PI / 2, 0]

const glbUrls = import.meta.glob<string>('../assets/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
})

const harpoonUrl = Object.entries(glbUrls).find(([path]) =>
  /harpoon/i.test(path),
)?.[1]

if (harpoonUrl) {
  useGLTF.preload(harpoonUrl)
} else {
  console.warn('No harpoon .glb found in src/assets/, using fallback spear mesh.')
}

type HarpoonProjectile = {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  age: number
}

function distanceSqToSegment(
  point: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  scratchAB: THREE.Vector3,
  scratchAP: THREE.Vector3,
): number {
  scratchAB.subVectors(b, a)
  scratchAP.subVectors(point, a)
  const lenSq = scratchAB.lengthSq()
  if (lenSq < 1e-8) return scratchAP.lengthSq()
  const t = THREE.MathUtils.clamp(scratchAP.dot(scratchAB) / lenSq, 0, 1)
  return scratchAP.addScaledVector(scratchAB, -t).lengthSq()
}

function PlaceholderHarpoon() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.075, HARPOON_LENGTH * 0.82, 10]} />
        <meshStandardMaterial
          color="#d8e6f0"
          emissive="#38bdf8"
          emissiveIntensity={0.35}
          metalness={0.25}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0, HARPOON_LENGTH * 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.14, HARPOON_LENGTH * 0.22, 10]} />
        <meshStandardMaterial
          color="#f1f5f9"
          emissive="#7dd3fc"
          emissiveIntensity={0.45}
          metalness={0.3}
          roughness={0.25}
        />
      </mesh>
    </group>
  )
}

function HarpoonMesh({ url }: { url: string }) {
  const { scene } = useGLTF(url)

  const { model, normalizedScale } = useMemo(() => {
    const copy = scene.clone(true)

    copy.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.frustumCulled = false

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]

      materials.forEach((mat) => {
        if (!mat) return
        mat.side = THREE.DoubleSide
        if (mat instanceof THREE.MeshStandardMaterial) {
          // Keep metallic reflections low and add a subtle sonar-cyan sheen so the
          // harpoon stands out clearly against dark deep-sea water.
          mat.metalness = Math.min(mat.metalness, 0.2)
          mat.roughness = Math.max(mat.roughness, 0.35)
          mat.emissive.set('#38bdf8')
          mat.emissiveIntensity = 0.35
        }
        mat.needsUpdate = true
      })
    })

    copy.updateMatrixWorld(true)
    const size = new THREE.Box3().setFromObject(copy).getSize(new THREE.Vector3())
    const longest = Math.max(size.x, size.y, size.z)
    const scale =
      longest > 0.0001 && Number.isFinite(longest)
        ? HARPOON_LENGTH / longest
        : 1

    return { model: copy, normalizedScale: scale }
  }, [scene])

  return (
    <group scale={normalizedScale} rotation={HARPOON_MODEL_ROTATION}>
      <primitive object={model} />
    </group>
  )
}

function HarpoonView({ projectile }: { projectile: HarpoonProjectile }) {
  const groupRef = useRef<THREE.Group>(null)
  const wakeRef = useRef<THREE.Mesh>(null)
  const lookTarget = useRef(new THREE.Vector3())

  useFrame(() => {
    const body = groupRef.current
    if (!body) return

    body.position.copy(projectile.position)

    const speedSq = projectile.velocity.lengthSq()
    if (speedSq > 1e-4) {
      lookTarget.current.copy(projectile.position).add(projectile.velocity)
      body.lookAt(lookTarget.current)
    }

    // Stretch the cavitation wake trail proportionally to current speed.
    const wake = wakeRef.current
    if (wake) {
      const speedRatio = THREE.MathUtils.clamp(
        Math.sqrt(speedSq) / MAX_LAUNCH_SPEED,
        0.15,
        1.2,
      )
      wake.scale.set(1, speedRatio, 1)
    }
  })

  return (
    <group ref={groupRef} position={projectile.position}>
      {harpoonUrl ? (
        <Suspense fallback={<PlaceholderHarpoon />}>
          <HarpoonMesh url={harpoonUrl} />
        </Suspense>
      ) : (
        <PlaceholderHarpoon />
      )}

      {/* Hydrodynamic bubble/sonar wake trail behind the harpoon */}
      <mesh
        ref={wakeRef}
        position={[0, 0, -HARPOON_LENGTH * 0.95]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.11, 0.008, HARPOON_LENGTH * 1.15, 10]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.42}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Local glint light so the harpoon illuminates nearby water & fish in flight */}
      <pointLight color="#38bdf8" intensity={4.5} distance={10} decay={2} />
    </group>
  )
}

export function TorpedoLauncher({ session }: { session: GameSession }) {
  const camera = useThree((state) => state.camera)
  const { status } = useGameSession(session)

  const [projectiles, setProjectiles] = useState<HarpoonProjectile[]>([])
  const activeRef = useRef<HarpoonProjectile[]>([])
  const nextId = useRef(1)
  const cooldownRef = useRef(0)

  const isHoldingRef = useRef(false)
  const isChargingRef = useRef(false)
  const chargeRef = useRef(0)

  const prevPos = useRef(new THREE.Vector3())
  const forward = useRef(new THREE.Vector3())
  const aimPoint = useRef(new THREE.Vector3())
  const launchDir = useRef(new THREE.Vector3())
  const hitDir = useRef(new THREE.Vector3())
  const scratchAB = useRef(new THREE.Vector3())
  const scratchAP = useRef(new THREE.Vector3())

  const fireHarpoon = useCallback(
    (chargeLevel: number) => {
      if (!session.isPlaying) return

      cooldownRef.current = FIRE_COOLDOWN
      const launchSpeed = THREE.MathUtils.lerp(
        MIN_LAUNCH_SPEED,
        MAX_LAUNCH_SPEED,
        chargeLevel,
      )

      camera.getWorldDirection(forward.current).normalize()

      const spawnPos = camera.position
        .clone()
        .addScaledVector(forward.current, 2.3)
        .add(new THREE.Vector3(0, -0.35, 0))

      aimPoint.current.copy(camera.position).addScaledVector(forward.current, 40)
      launchDir.current.subVectors(aimPoint.current, spawnPos).normalize()

      const harpoon: HarpoonProjectile = {
        id: nextId.current++,
        position: spawnPos,
        velocity: launchDir.current.multiplyScalar(launchSpeed).clone(),
        age: 0,
      }

      activeRef.current = [...activeRef.current, harpoon]
      setProjectiles(activeRef.current)
    },
    [camera, session],
  )

  useEffect(() => {
    if (status !== 'playing') {
      activeRef.current = []
      setProjectiles([])
      isHoldingRef.current = false
      isChargingRef.current = false
      chargeRef.current = 0
      session.setHarpoonCharge(0)
    }
  }, [status, session])

  // Hold Left Click to charge; release Left Click to launch.
  useEffect(() => {
    const cancelCharge = () => {
      isHoldingRef.current = false
      isChargingRef.current = false
      chargeRef.current = 0
      session.setHarpoonCharge(0)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (!session.isPlaying || !document.pointerLockElement) return

      isHoldingRef.current = true
      if (cooldownRef.current <= 0) {
        isChargingRef.current = true
        chargeRef.current = 0.05
        session.setHarpoonCharge(0.05)
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return
      isHoldingRef.current = false

      if (isChargingRef.current) {
        const releaseCharge = chargeRef.current
        isChargingRef.current = false
        chargeRef.current = 0
        session.setHarpoonCharge(0)
        fireHarpoon(releaseCharge)
      }
    }

    const handlePointerLockChange = () => {
      if (!document.pointerLockElement && isChargingRef.current) {
        cancelCharge()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointerlockchange', handlePointerLockChange)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
    }
  }, [fireHarpoon, session])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)

    if (cooldownRef.current > 0) {
      cooldownRef.current = Math.max(0, cooldownRef.current - delta)
    }

    // Start charging automatically if the player kept holding Left Click through reload cooldown.
    if (
      session.isPlaying &&
      document.pointerLockElement &&
      isHoldingRef.current &&
      !isChargingRef.current &&
      cooldownRef.current <= 0
    ) {
      isChargingRef.current = true
      chargeRef.current = 0.05
    }

    if (isChargingRef.current) {
      chargeRef.current = Math.min(1, chargeRef.current + delta / CHARGE_DURATION)
      session.setHarpoonCharge(chargeRef.current)
    }

    if (!session.isPlaying || activeRef.current.length === 0) return

    let listChanged = false
    const surviving: HarpoonProjectile[] = []

    for (const harpoon of activeRef.current) {
      harpoon.age += delta
      prevPos.current.copy(harpoon.position)

      // 1. Hydrodynamic water drag bleeds momentum over distance.
      harpoon.velocity.multiplyScalar(Math.exp(-WATER_DRAG * delta))

      // 2. Underwater gravity pulls the harpoon downward into an arc.
      harpoon.velocity.y -= HARPOON_GRAVITY * delta

      // 3. Advance position.
      harpoon.position.addScaledVector(harpoon.velocity, delta)

      // 4. Swept segment collision check against fish.
      let hitTarget = false
      const speed = harpoon.velocity.length()

      if (speed >= MIN_EFFECTIVE_SPEED) {
        hitDir.current.copy(harpoon.velocity).divideScalar(speed)

        for (const mob of session.mobs) {
          if (!mob.isAlive) continue

          const hitThreshold = mob.hitRadius + HARPOON_HIT_RADIUS
          const distSq = distanceSqToSegment(
            mob.position,
            prevPos.current,
            harpoon.position,
            scratchAB.current,
            scratchAP.current,
          )

          if (distSq <= hitThreshold * hitThreshold) {
            session.scoreHit(mob, hitDir.current)
            hitTarget = true
            break
          }
        }
      }

      const outOfPower = speed < MIN_EFFECTIVE_SPEED
      const expired = harpoon.age >= MAX_LIFETIME
      const tooFar = harpoon.position.distanceToSquared(camera.position) > 110 * 110

      if (hitTarget || outOfPower || expired || tooFar) {
        listChanged = true
      } else {
        surviving.push(harpoon)
      }
    }

    if (listChanged) {
      activeRef.current = surviving
      setProjectiles(surviving)
    }
  })

  return (
    <>
      {projectiles.map((harpoon) => (
        <HarpoonView key={harpoon.id} projectile={harpoon} />
      ))}
    </>
  )
}