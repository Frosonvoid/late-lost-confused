import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

import {
  DEEP_COLOR,
  OCEAN_HALF_SIZE,
  SEABED_Y,
  SHALLOW_COLOR,
  SURFACE_Y,
} from './config'

// Background and fog share one colour that darkens as the sub dives.
function SeaWater() {
  const camera = useThree((state) => state.camera)
  const background = useRef<THREE.Color>(null)
  const fog = useRef<THREE.FogExp2>(null)

  useFrame(() => {
    if (!background.current || !fog.current) return

    const depthRatio = THREE.MathUtils.clamp(
      (camera.position.y - SEABED_Y) / (SURFACE_Y - SEABED_Y),
      0,
      1,
    )

    background.current.lerpColors(DEEP_COLOR, SHALLOW_COLOR, depthRatio)
    fog.current.color.copy(background.current)
  })

  return (
    <>
      <color ref={background} attach="background" args={[SHALLOW_COLOR]} />
      <fogExp2 ref={fog} attach="fog" args={[SHALLOW_COLOR, 0.02]} />
    </>
  )
}

function Seabed() {
  const geometry = useMemo(() => {
    const size = OCEAN_HALF_SIZE * 2
    const plane = new THREE.PlaneGeometry(size, size, 200, 200)
    plane.rotateX(-Math.PI / 2)

    const position = plane.attributes.position

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = position.getZ(i)

      const height =
        Math.sin(x * 0.05) * Math.cos(z * 0.04) * 3 +
        Math.sin(x * 0.13 + z * 0.11) * 1.2 +
        Math.sin(x * 0.31) * Math.cos(z * 0.29) * 0.4

      position.setY(i, height)
    }

    plane.computeVertexNormals()
    return plane
  }, [])

  return (
    <mesh geometry={geometry} position={[0, SEABED_Y, 0]}>
      <meshStandardMaterial color="#2b4a57" roughness={1} metalness={0} />
    </mesh>
  )
}

// Slowly sinking particles that wrap around the camera, so there is always
// something drifting past you and movement is easy to read.
function MarineSnow({ count = 900, size = 60 }: { count?: number; size?: number }) {
  const camera = useThree((state) => state.camera)
  const attribute = useRef<THREE.BufferAttribute>(null)

  const { base, fall, positions } = useMemo(() => {
    const base = new Float32Array(count * 3)
    const fall = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      base[i * 3] = Math.random() * size
      base[i * 3 + 1] = Math.random() * size
      base[i * 3 + 2] = Math.random() * size
      fall[i] = 0.1 + Math.random() * 0.3
    }

    return { base, fall, positions: new Float32Array(count * 3) }
  }, [count, size])

  useFrame((_, delta) => {
    const half = size / 2
    const wrap = (value: number, center: number) =>
      center + ((((value - center + half) % size) + size) % size) - half

    const { x, y, z } = camera.position

    for (let i = 0; i < count; i++) {
      base[i * 3 + 1] -= fall[i] * delta

      positions[i * 3] = wrap(base[i * 3], x)
      positions[i * 3 + 1] = wrap(base[i * 3 + 1], y)
      positions[i * 3 + 2] = wrap(base[i * 3 + 2], z)
    }

    if (attribute.current) attribute.current.needsUpdate = true
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          ref={attribute}
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#9fd8ff"
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </points>
  )
}

// Everything that makes the scene feel like deep water: colour, fog, light, floor, particles.
export function DeepSea() {
  return (
    <>
      <SeaWater />

      <ambientLight intensity={0.5} color="#4a90b8" />

      {/* Sunlight filtering down from the surface */}
      <directionalLight
        position={[10, 40, 10]}
        intensity={1.5}
        color="#8fd0f0"
      />

      {/* Image-based lighting. Metallic cockpit materials render black without it. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2} color="#8fd8ff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer form="rect" intensity={2} color="#1e90b0" position={[-6, 1, -2]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#0e6f8f" position={[6, 1, -2]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1} color="#2a5f80" position={[0, 1, -6]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1} color="#2a5f80" position={[0, 1, 6]} rotation-y={Math.PI} scale={[10, 4, 1]} />
      </Environment>

      <Seabed />
      <MarineSnow />
    </>
  )
}