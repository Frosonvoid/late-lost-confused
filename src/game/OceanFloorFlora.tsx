import { Suspense, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { ErrorBoundary } from './ErrorBoundary'

// --- Tunable Reef Density & Glow Settings ---
const REEF_TILE_SIZE = 180
const CORAL_VARIANT_COUNT = 50 // Per coral variant in corals.glb (x3 = 150)
const TUBE_CORAL_COUNT = 60
const ANUBIAS_COUNT = 105
const FERN_COUNT = 115

const CORAL_GLOW_PALETTE = [
  { color: '#00e5ff', intensity: 0.65 }, // Electric cyan
  { color: '#ff3b8d', intensity: 0.6 }, // Bioluminescent magenta-coral
  { color: '#ff9d2e', intensity: 0.6 }, // Deep-sea amber
]

const TUBE_CORAL_GLOW = { color: '#14f1d9', intensity: 0.58 }

const glbUrls = import.meta.glob<string>('../assets/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
})

const findAsset = (pattern: RegExp) =>
  Object.entries(glbUrls).find(([path]) => pattern.test(path))?.[1]

const coralsUrl = findAsset(/\/corals\.glb$/i)
const tubeCoralUrl = findAsset(/tubecoral.*\.glb$/i)
const anubiasUrl = findAsset(/anubias.*\.glb$/i)
const fernUrl = findAsset(/fern.*\.glb$/i)

;[coralsUrl, tubeCoralUrl, anubiasUrl, fernUrl].forEach((url) => {
  if (url) useGLTF.preload(url)
})

type Placement = {
  x: number
  z: number
  rotY: number
  tiltX: number
  tiltZ: number
  scale: number
}

type OccupiedSpot = {
  x: number
  z: number
  radius: number
}

type PreparedSubMesh = {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  localMatrix: THREE.Matrix4
}

function createRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function wrapCoord(value: number, center: number, size: number): number {
  const half = size * 0.5
  return ((((value - center + half) % size) + size) % size) - half + center
}

function wrappedDelta(a: number, b: number, size: number): number {
  let d = (a - b) % size
  if (d > size * 0.5) d -= size
  if (d < -size * 0.5) d += size
  return d
}

function hasMesh(obj: THREE.Object3D): boolean {
  let found = false
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) found = true
  })
  return found
}

// Used ONLY for multi-asset pack files like corals.glb that contain multiple distinct models.
function extractVariants(scene: THREE.Group): THREE.Object3D[] {
  let candidates = scene.children.filter(hasMesh)
  while (candidates.length === 1) {
    const inner = candidates[0].children.filter(hasMesh)
    if (inner.length > 1) {
      candidates = inner
    } else {
      break
    }
  }
  return candidates.length > 0 ? candidates : [scene]
}

// Normalizes an entire multi-part object as ONE unified hierarchy so leaves, stems,
// branches, and bases keep their exact relative positions, rotations, and proportions.
function prepareUnifiedModelSubMeshes(
  source: THREE.Object3D,
  glow: { color: string; intensity: number } | null,
): PreparedSubMesh[] {
  const clone = source.clone(true)

  // Measure the complete assembled model without resetting child transforms.
  const measureGroup = new THREE.Group()
  measureGroup.add(clone)
  measureGroup.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(clone)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const normScale = maxDim > 1e-4 && Number.isFinite(maxDim) ? 1 / maxDim : 1

  // Anchor the assembled model's bottom-center at (0, 0, 0) while preserving all internal offsets.
  const normalizedRoot = new THREE.Group()
  normalizedRoot.scale.setScalar(normScale)
  normalizedRoot.position.set(
    -center.x * normScale,
    -box.min.y * normScale,
    -center.z * normScale,
  )
  normalizedRoot.add(clone)
  normalizedRoot.updateMatrixWorld(true)

  const subMeshes: PreparedSubMesh[] = []

  normalizedRoot.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return

    const sourceMat = Array.isArray(child.material) ? child.material[0] : child.material
    if (!sourceMat) return

    const mat = sourceMat.clone()
    mat.side = THREE.DoubleSide

    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.metalness = Math.min(mat.metalness, 0.08)
      mat.roughness = Math.max(mat.roughness, 0.58)

      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace
        mat.map.needsUpdate = true
      }

      if (mat.transparent || mat.alphaMap) {
        mat.transparent = false
        mat.alphaTest = 0.45
        mat.depthWrite = true
      }

      if (glow && glow.intensity > 0) {
        mat.emissive.set(glow.color)
        mat.emissiveIntensity = glow.intensity
        if (mat.map && !mat.emissiveMap) {
          mat.emissiveMap = mat.map
        }
      } else {
        mat.emissive.set('#000000')
        mat.emissiveIntensity = 0
      }
    }

    mat.needsUpdate = true

    subMeshes.push({
      geometry: child.geometry,
      material: mat,
      localMatrix: child.matrixWorld.clone(),
    })
  })

  return subMeshes
}

function allocateNonOverlappingPlacements(
  occupied: OccupiedSpot[],
  rand: () => number,
  count: number,
  minScale: number,
  maxScale: number,
  footprintFactor: number,
  clusterCenters: Array<{ x: number; z: number }>,
  clusterBias: number,
): Placement[] {
  const items: Placement[] = []
  const maxAttempts = 45

  for (let i = 0; i < count; i++) {
    const scale = minScale + rand() * (maxScale - minScale)
    const radius = scale * footprintFactor

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let x: number
      let z: number

      if (clusterCenters.length > 0 && rand() < clusterBias) {
        const hub = clusterCenters[Math.floor(rand() * clusterCenters.length)]
        const angle = rand() * Math.PI * 2
        const dist = 1.5 + Math.pow(rand(), 0.7) * 15
        x = wrapCoord(hub.x + Math.cos(angle) * dist, 0, REEF_TILE_SIZE)
        z = wrapCoord(hub.z + Math.sin(angle) * dist, 0, REEF_TILE_SIZE)
      } else {
        x = (rand() - 0.5) * REEF_TILE_SIZE
        z = (rand() - 0.5) * REEF_TILE_SIZE
      }

      let overlaps = false
      for (let j = 0; j < occupied.length; j++) {
        const other = occupied[j]
        const minDist = radius + other.radius
        const dx = wrappedDelta(x, other.x, REEF_TILE_SIZE)
        if (Math.abs(dx) >= minDist) continue
        const dz = wrappedDelta(z, other.z, REEF_TILE_SIZE)
        if (Math.abs(dz) >= minDist) continue

        if (dx * dx + dz * dz < minDist * minDist) {
          overlaps = true
          break
        }
      }

      if (!overlaps) {
        occupied.push({ x, z, radius })
        items.push({
          x,
          z,
          rotY: rand() * Math.PI * 2,
          tiltX: (rand() - 0.5) * 0.12,
          tiltZ: (rand() - 0.5) * 0.12,
          scale,
        })
        break
      }
    }
  }

  return items
}

function InstancedFloraGroup({
  subMeshes,
  placements,
  seabedMeshesRef,
}: {
  subMeshes: PreparedSubMesh[]
  placements: Placement[]
  seabedMeshesRef: MutableRefObject<THREE.Mesh[]>
}) {
  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const finalMatrix = useMemo(() => new THREE.Matrix4(), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const rayOrigin = useMemo(() => new THREE.Vector3(), [])
  const rayDown = useMemo(() => new THREE.Vector3(0, -1, 0), [])
  const worldNormal = useMemo(() => new THREE.Vector3(), [])

  const cache = useMemo(() => {
    const count = placements.length
    return {
      lastX: new Float64Array(count).fill(Number.NaN),
      lastZ: new Float64Array(count).fill(Number.NaN),
      groundY: new Float32Array(count),
      hasGround: new Uint8Array(count),
    }
  }, [placements])

  useFrame(({ camera }) => {
    if (placements.length === 0) return

    const seabedMeshes = seabedMeshesRef.current
    const camX = camera.position.x
    const camZ = camera.position.z

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i]
      const wx = wrapCoord(p.x, camX, REEF_TILE_SIZE)
      const wz = wrapCoord(p.z, camZ, REEF_TILE_SIZE)

      const moved =
        Math.abs(wx - cache.lastX[i]) > 0.05 || Math.abs(wz - cache.lastZ[i]) > 0.05

      if (seabedMeshes.length > 0 && (moved || cache.hasGround[i] === 0)) {
        rayOrigin.set(wx, 500, wz)
        raycaster.set(rayOrigin, rayDown)
        const hits = raycaster.intersectObjects(seabedMeshes, false)

        // Pick the LOWEST upward-facing hit so upper water/caustic layers are ignored.
        let lowestY = Number.POSITIVE_INFINITY
        for (let h = 0; h < hits.length; h++) {
          const hit = hits[h]
          if (hit.point.y >= -2) continue

          if (hit.face) {
            worldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
            if (worldNormal.y <= 0.3) continue
          }

          if (hit.point.y < lowestY) {
            lowestY = hit.point.y
          }
        }

        if (Number.isFinite(lowestY)) {
          cache.groundY[i] = lowestY
          cache.hasGround[i] = 1
          cache.lastX[i] = wx
          cache.lastZ[i] = wz
        } else {
          cache.hasGround[i] = 0
        }
      }

      if (cache.hasGround[i] === 1) {
        // Sink root base slightly into the sand so sloped edges sit firmly in the seabed.
        dummy.position.set(wx, cache.groundY[i] - 0.06 * p.scale, wz)
        dummy.rotation.set(p.tiltX, p.rotY, p.tiltZ)
        dummy.scale.setScalar(p.scale)
      } else {
        dummy.position.set(wx, -9999, wz)
        dummy.scale.setScalar(0)
      }

      dummy.updateMatrix()

      for (let m = 0; m < subMeshes.length; m++) {
        const inst = meshRefs.current[m]
        if (!inst) continue
        finalMatrix.multiplyMatrices(dummy.matrix, subMeshes[m].localMatrix)
        inst.setMatrixAt(i, finalMatrix)
      }
    }

    for (let m = 0; m < subMeshes.length; m++) {
      const inst = meshRefs.current[m]
      if (inst) inst.instanceMatrix.needsUpdate = true
    }
  })

  if (placements.length === 0) return null

  return (
    <>
      {subMeshes.map((sub, idx) => (
        <instancedMesh
          key={idx}
          ref={(el) => {
            meshRefs.current[idx] = el
          }}
          args={[sub.geometry, sub.material, placements.length]}
          frustumCulled={false}
        />
      ))}
    </>
  )
}

function CoralsScatter({
  url,
  placementBuckets,
  seabedMeshesRef,
}: {
  url: string
  placementBuckets: Placement[][]
  seabedMeshesRef: MutableRefObject<THREE.Mesh[]>
}) {
  const { scene } = useGLTF(url)

  const variants = useMemo(() => {
    const roots = extractVariants(scene)
    return roots.map((root, idx) => {
      const glow = CORAL_GLOW_PALETTE[idx % CORAL_GLOW_PALETTE.length]
      return {
        subMeshes: prepareUnifiedModelSubMeshes(root, glow),
        placements: placementBuckets[idx] ?? [],
      }
    })
  }, [scene, placementBuckets])

  return (
    <>
      {variants.map((variant, idx) => (
        <InstancedFloraGroup
          key={idx}
          subMeshes={variant.subMeshes}
          placements={variant.placements}
          seabedMeshesRef={seabedMeshesRef}
        />
      ))}
    </>
  )
}

function SingleSpeciesScatter({
  url,
  placements,
  glow,
  seabedMeshesRef,
}: {
  url: string
  placements: Placement[]
  glow: { color: string; intensity: number } | null
  seabedMeshesRef: MutableRefObject<THREE.Mesh[]>
}) {
  const { scene } = useGLTF(url)

  // Keep the entire GLB scene unified so multi-part plants preserve their exact structure.
  const subMeshes = useMemo(
    () => prepareUnifiedModelSubMeshes(scene, glow),
    [scene, glow],
  )

  return (
    <InstancedFloraGroup
      subMeshes={subMeshes}
      placements={placements}
      seabedMeshesRef={seabedMeshesRef}
    />
  )
}

export function OceanFloorFlora() {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const floraGroupRef = useRef<THREE.Group>(null)
  const seabedMeshesRef = useRef<THREE.Mesh[]>([])
  const lightGroupRef = useRef<THREE.Group>(null)
  const boxScratch = useMemo(() => new THREE.Box3(), [])
  const sizeScratch = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (seabedMeshesRef.current.length > 0) return

    const found: THREE.Mesh[] = []
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (obj instanceof THREE.InstancedMesh || obj instanceof THREE.SkinnedMesh) return

      let parent: THREE.Object3D | null = obj
      while (parent) {
        if (parent === floraGroupRef.current || parent === camera) return
        parent = parent.parent
      }

      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material
      if (mat?.side === THREE.BackSide) return

      obj.updateWorldMatrix(true, false)
      boxScratch.setFromObject(obj)
      boxScratch.getSize(sizeScratch)

      // Match wide ocean-floor planes/terrain while excluding world-enclosing sky domes.
      if (
        sizeScratch.x > 30 &&
        sizeScratch.z > 30 &&
        boxScratch.min.y < -2 &&
        boxScratch.max.y < 15
      ) {
        found.push(obj)
      }
    })

    if (found.length > 0) {
      seabedMeshesRef.current = found
      const floorY = Math.min(...found.map((m) => new THREE.Box3().setFromObject(m).min.y))
      if (lightGroupRef.current && Number.isFinite(floorY)) {
        lightGroupRef.current.position.y = floorY + 6
      }
    }
  })

  const layout = useMemo(() => {
    const rand = createRng(777)
    const occupied: OccupiedSpot[] = []

    const clusterCenters = Array.from({ length: 16 }, () => ({
      x: (rand() - 0.5) * (REEF_TILE_SIZE * 0.85),
      z: (rand() - 0.5) * (REEF_TILE_SIZE * 0.85),
    }))

    const coralBuckets: Placement[][] = [0, 1, 2].map(() =>
      allocateNonOverlappingPlacements(
        occupied,
        rand,
        CORAL_VARIANT_COUNT,
        1.7,
        3.6,
        0.58,
        clusterCenters,
        0.78,
      ),
    )

    const tubeCoralPlacements = allocateNonOverlappingPlacements(
      occupied,
      rand,
      TUBE_CORAL_COUNT,
      1.5,
      3.1,
      0.56,
      clusterCenters,
      0.75,
    )

    const anubiasPlacements = allocateNonOverlappingPlacements(
      occupied,
      rand,
      ANUBIAS_COUNT,
      1.3,
      2.5,
      0.55,
      clusterCenters,
      0.35,
    )

    const fernPlacements = allocateNonOverlappingPlacements(
      occupied,
      rand,
      FERN_COUNT,
      1.5,
      2.9,
      0.55,
      clusterCenters,
      0.3,
    )

    return {
      coralBuckets,
      tubeCoralPlacements,
      anubiasPlacements,
      fernPlacements,
    }
  }, [])

  return (
    <group ref={floraGroupRef}>
      <hemisphereLight args={['#38bdf8', '#041526', 0.85]} />
      <group ref={lightGroupRef} position={[0, -30, 0]}>
        <pointLight position={[0, 0, -18]} color="#00e5ff" intensity={30} distance={75} />
        <pointLight position={[-24, 0, -34]} color="#ff3b8d" intensity={25} distance={75} />
        <pointLight position={[26, 0, -28]} color="#14f1d9" intensity={25} distance={75} />
      </group>

      {coralsUrl && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <CoralsScatter
              url={coralsUrl}
              placementBuckets={layout.coralBuckets}
              seabedMeshesRef={seabedMeshesRef}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {tubeCoralUrl && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <SingleSpeciesScatter
              url={tubeCoralUrl}
              placements={layout.tubeCoralPlacements}
              glow={TUBE_CORAL_GLOW}
              seabedMeshesRef={seabedMeshesRef}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {anubiasUrl && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <SingleSpeciesScatter
              url={anubiasUrl}
              placements={layout.anubiasPlacements}
              glow={null}
              seabedMeshesRef={seabedMeshesRef}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {fernUrl && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <SingleSpeciesScatter
              url={fernUrl}
              placements={layout.fernPlacements}
              glow={null}
              seabedMeshesRef={seabedMeshesRef}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </group>
  )
}