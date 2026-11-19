import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

import {
  LIONFISH_CLIPS,
  LIONFISH_LENGTH,
  LIONFISH_YAW_OFFSET,
} from './config'
import { ErrorBoundary } from './ErrorBoundary'
import type { GameSession } from './GameSession'
import { Lionfish, Mob, NativeFish, type NativeSpecies } from './Mobs'

const glbUrls = import.meta.glob<string>('../assets/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
})

const lionfishUrl = Object.entries(glbUrls).find(([path]) =>
  /lion/i.test(path),
)?.[1]

if (lionfishUrl) {
  useGLTF.preload(lionfishUrl)
} else {
  console.warn('No lionfish .glb found in src/assets/, drawing placeholders instead.')
}

const NATIVE_COLORS: Record<NativeSpecies, string> = {
  clownfish: '#ff7a1a',
  parrotfish: '#2ecc71',
  'blue tang': '#2f6df6',
}

const simplify = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '')

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
  const { scene, animations } = useGLTF(url)

  const { model, normalizedScale } = useMemo(() => {
    const copy = cloneSkinned(scene)

    copy.traverse((child) => {
      child.visible = true
      if (!(child instanceof THREE.Mesh)) return

      child.frustumCulled = false

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]

      materials.forEach((mat) => {
        if (!mat) return
        mat.side = THREE.DoubleSide

        const isFin = /fin/i.test(mat.name || child.name)

        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.metalness = Math.min(mat.metalness, 0.2)
          mat.roughness = Math.max(mat.roughness, 0.45)

          if (isFin && mat.transparent) {
            mat.alphaTest = 0.1
          } else {
            mat.transparent = false
            mat.alphaTest = 0
            mat.opacity = 1
          }
        }

        mat.needsUpdate = true
      })
    })

    copy.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(copy)
    const size = box.getSize(new THREE.Vector3())
    const longest = Math.max(size.x, size.y, size.z)
    const scale =
      longest > 0.0001 && Number.isFinite(longest)
        ? LIONFISH_LENGTH / longest
        : 1

    return { model: copy, normalizedScale: scale }
  }, [scene])

  const cleanedAnimations = useMemo(
    () =>
      animations.map((clip) => {
        const cloned = clip.clone()
        cloned.tracks = cloned.tracks.filter(
          (track) => !/^(Armature|rig|Scene)\.scale$/i.test(track.name),
        )
        return cloned
      }),
    [animations],
  )

  const { actions, names } = useAnimations(cleanedAnimations, model)

  useEffect(() => {
    if (names.length === 0) return

    const clipName =
      names.find((name) => simplify(name).includes(LIONFISH_CLIPS.normal)) ?? names[0]
    const action = actions[clipName]
    if (!action) return

    action.reset().fadeIn(0.3).play()
    action.time = Math.random() * action.getClip().duration

    return () => {
      action.fadeOut(0.3)
    }
  }, [actions, names])

  return (
    <group scale={normalizedScale} rotation={[0, LIONFISH_YAW_OFFSET, 0]}>
      <primitive object={model} />
    </group>
  )
}

function LionfishBody() {
  const placeholder = <PlaceholderFish color="#e8531e" size={LIONFISH_LENGTH} />

  if (!lionfishUrl) return placeholder

  return (
    <ErrorBoundary fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <LionfishModel url={lionfishUrl} />
      </Suspense>
    </ErrorBoundary>
  )
}

function MobView({ mob, children }: { mob: Mob; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const lookTarget = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    mob.update(Math.min(delta, 0.1))

    const body = group.current
    if (!body) return

    body.visible = mob.isAlive
    if (!mob.isAlive) return

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

export function MobsLayer({ session }: { session: GameSession }) {
  return (
    <>
      {session.mobs.map((mob) => (
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