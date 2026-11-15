import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useFBX } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

import {
  LIONFISH_CLIPS,
  LIONFISH_LENGTH,
  LIONFISH_YAW_OFFSET,
} from './config'
import { ErrorBoundary } from './ErrorBoundary'
import { Lionfish, Mob, NativeFish, type NativeSpecies } from './Mobs'

// Finds your lionfish FBX in src/assets whatever it is called (lionfish.fbx, lion-fish.fbx, ...).
// If there is none, a placeholder fish is drawn instead.
const fbxUrls = import.meta.glob<string>('../assets/*.fbx', {
  query: '?url',
  import: 'default',
  eager: true,
})

const lionfishUrl = Object.entries(fbxUrls).find(([path]) =>
  /lion/i.test(path),
)?.[1]

if (!lionfishUrl) {
  console.warn('No lionfish .fbx found in src/assets, drawing placeholders instead.')
}

const NATIVE_COLORS: Record<NativeSpecies, string> = {
  clownfish: '#ff7a1a',
  parrotfish: '#2ecc71',
  'blue tang': '#2f6df6',
}

const simplify = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '')

let clipNamesLogged = false

// Stand-in for any fish model that does not exist yet. Faces +Z, about 1 unit long.
function PlaceholderFish({ color, size = 1 }: { color: string; size?: number }) {
  return (
    <group scale={size}>
      <mesh scale={[0.5, 0.35, 1]}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, -0.65]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.25, 0.4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

function LionfishModel({ url }: { url: string }) {
  const fbx = useFBX(url)
  const group = useRef<THREE.Group>(null)

  // Skinned models must be cloned with SkeletonUtils, or the copies lose their skeleton.
  const model = useMemo(() => {
    const copy = cloneSkinned(fbx)

    const size = new THREE.Box3().setFromObject(copy).getSize(new THREE.Vector3())
    const longest = Math.max(size.x, size.y, size.z)

    if (longest > 0) copy.scale.multiplyScalar(LIONFISH_LENGTH / longest)
    copy.rotation.y = LIONFISH_YAW_OFFSET

    return copy
  }, [fbx])

  const { actions, names } = useAnimations(fbx.animations, group)

  useEffect(() => {
    if (!clipNamesLogged) {
      console.info('Lionfish animation clips:', names)
      clipNamesLogged = true
    }

    if (names.length === 0) return

    const clipName =
      names.find((name) => simplify(name).includes(LIONFISH_CLIPS.normal)) ?? names[0]
    const action = actions[clipName]
    if (!action) return

    action.reset().fadeIn(0.3).play()
    // Start each fish at a different point so they don't swim in sync.
    action.time = Math.random() * action.getClip().duration

    return () => {
      action.fadeOut(0.3)
    }
  }, [actions, names])

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  )
}

function LionfishBody() {
  const placeholder = <PlaceholderFish color="#e8531e" size={LIONFISH_LENGTH} />

  if (!lionfishUrl) return placeholder

  // Placeholder while loading, and if the file fails to load.
  return (
    <ErrorBoundary fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <LionfishModel url={lionfishUrl} />
      </Suspense>
    </ErrorBoundary>
  )
}

// Works for any Mob (polymorphism): it only calls update() and reads position/heading.
function MobView({ mob, children }: { mob: Mob; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const lookTarget = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    mob.update(Math.min(delta, 0.1))

    const body = group.current
    if (!body) return

    body.visible = mob.isAlive
    body.position.copy(mob.position)
    lookTarget.current.copy(mob.position).add(mob.heading)
    body.lookAt(lookTarget.current)
  })

  return (
    <group ref={group} position={mob.position}>
      {children}
    </group>
  )
}

function spawn<T extends Mob>(mob: T): T {
  // In front of the submarine's starting point.
  mob.home.set(
    (Math.random() - 0.5) * 50,
    (Math.random() - 0.5) * 24,
    -10 - Math.random() * 35,
  )
  mob.position.copy(mob.home)
  mob.heading
    .set(Math.random() - 0.5, (Math.random() - 0.5) * 0.2, Math.random() - 0.5)
    .normalize()

  return mob
}

export function MobsLayer() {
  const mobs = useMemo<Mob[]>(() => {
    const species: NativeSpecies[] = ['clownfish', 'parrotfish', 'blue tang']

    return [
      ...Array.from({ length: 6 }, () => spawn(new Lionfish())),
      ...species.flatMap((kind) => [
        spawn(new NativeFish(kind)),
        spawn(new NativeFish(kind)),
      ]),
    ]
  }, [])

  return (
    <>
      {mobs.map((mob) => (
        <MobView key={mob.id} mob={mob}>
          {mob instanceof Lionfish && <LionfishBody />}
          {mob instanceof NativeFish && (
            <PlaceholderFish color={NATIVE_COLORS[mob.species]} />
          )}
        </MobView>
      ))}
    </>
  )
}