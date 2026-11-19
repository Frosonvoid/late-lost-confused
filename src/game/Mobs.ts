import * as THREE from 'three'

import { OCEAN_HALF_SIZE, SEABED_Y, SURFACE_Y } from './config'

// Logic for every creature in the ocean. No rendering in here: MobViews.tsx draws
// each mob at its position, facing its heading.
export abstract class Mob {
  private static nextId = 0

  readonly id = Mob.nextId++
  readonly position = new THREE.Vector3()
  readonly heading = new THREE.Vector3(0, 0, 1)

  // Mobs wander around this point and turn back when they drift too far.
  readonly home = new THREE.Vector3()
  roamRadius = 12

  // Seconds spent destroyed/despawned, used for respawning.
  deadFor = 0

  private alive = true
  private dodgeTimer = 0
  private readonly toHome = new THREE.Vector3()
  private readonly dodgeDirection = new THREE.Vector3()
  private readonly upAxis = new THREE.Vector3(0, 1, 0)
  private readonly fallbackAxis = new THREE.Vector3(1, 0, 0)

  abstract readonly name: string
  abstract readonly collisionDamage: number // hull HP the submarine loses on collision
  abstract readonly torpedoScore: number // score change when a torpedo hits it
  abstract readonly swimSpeed: number
  abstract readonly hitRadius: number
  abstract readonly dodgeRate: number // 0 to 1 chance to evade an incoming harpoon

  get isAlive() {
    return this.alive
  }

  get isDodging() {
    return this.dodgeTimer > 0
  }

  // Default behaviour: swim ahead, and turn gently back toward home when too far away.
  update(delta: number) {
    if (!this.alive) return

    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - delta)
    }

    const speedMultiplier = this.dodgeTimer > 0 ? 3.2 : 1
    this.position.addScaledVector(
      this.heading,
      this.swimSpeed * speedMultiplier * delta,
    )

    this.position.x = THREE.MathUtils.clamp(
      this.position.x,
      -OCEAN_HALF_SIZE,
      OCEAN_HALF_SIZE,
    )
    this.position.y = THREE.MathUtils.clamp(
      this.position.y,
      SEABED_Y + 6,
      SURFACE_Y - 4,
    )
    this.position.z = THREE.MathUtils.clamp(
      this.position.z,
      -OCEAN_HALF_SIZE,
      OCEAN_HALF_SIZE,
    )

    if (
      this.dodgeTimer === 0 &&
      this.position.distanceTo(this.home) > this.roamRadius
    ) {
      this.toHome.copy(this.home).sub(this.position).normalize()
      this.heading.lerp(this.toHome, Math.min(1, 2 * delta)).normalize()
    }
  }

  // Returns the score change (positive for a good hit, negative for a penalty).
  // Returns 0 if already dead or if the mob successfully dodges the harpoon.
  hitByTorpedo(incomingDirection?: THREE.Vector3): number {
    if (!this.alive || this.dodgeTimer > 0) return 0

    if (this.dodgeRate > 0 && Math.random() < this.dodgeRate) {
      this.performDodge(incomingDirection)
      return 0
    }

    this.alive = false
    this.deadFor = 0
    return this.torpedoScore
  }

  private performDodge(incomingDirection?: THREE.Vector3) {
    const referenceDir =
      incomingDirection && incomingDirection.lengthSq() > 1e-4
        ? incomingDirection
        : this.heading

    this.dodgeDirection.crossVectors(referenceDir, this.upAxis)
    if (this.dodgeDirection.lengthSq() < 1e-4) {
      this.dodgeDirection.crossVectors(referenceDir, this.fallbackAxis)
    }
    this.dodgeDirection.normalize()

    if (Math.random() < 0.5) {
      this.dodgeDirection.negate()
    }
    this.dodgeDirection.y += (Math.random() - 0.5) * 0.6
    this.dodgeDirection.normalize()

    this.heading.copy(this.dodgeDirection)
    this.dodgeTimer = 0.45
  }

  // Returns the HP the submarine should lose, e.g. submarine.takeDamage(mob.onCollision()).
  onCollision(): number {
    return this.alive ? this.collisionDamage : 0
  }

  despawn() {
    this.alive = false
    this.deadFor = 0
    this.dodgeTimer = 0
  }

  revive() {
    this.alive = true
    this.deadFor = 0
    this.dodgeTimer = 0
  }
}

// Invasive species: destroy these.
export class Lionfish extends Mob {
  readonly name = 'Lionfish'
  readonly collisionDamage = 20
  readonly torpedoScore = 100
  readonly swimSpeed = 3
  readonly hitRadius = 1
  readonly dodgeRate = 0.3 // 30% chance to dodge incoming harpoons
}

export type NativeSpecies = 'clownfish' | 'parrotfish' | 'blue tang'

// Protected species: hitting these costs points.
export class NativeFish extends Mob {
  readonly name: string
  readonly collisionDamage = 10
  readonly torpedoScore = -150
  readonly swimSpeed = 2
  readonly hitRadius = 0.7
  readonly dodgeRate = 0
  readonly species: NativeSpecies

  constructor(species: NativeSpecies) {
    super()
    this.species = species
    this.name = species
  }
}

export interface PlaceMobOptions {
  frontOnly?: boolean
  forward?: THREE.Vector3
  minDistance?: number
  maxDistance?: number
}

// Puts a mob at a random spot around `center` (or in a forward cone along `forward`).
export function placeMob(
  mob: Mob,
  center: THREE.Vector3,
  frontOnlyOrOptions: boolean | PlaceMobOptions = true,
) {
  const options: PlaceMobOptions =
    typeof frontOnlyOrOptions === 'boolean'
      ? { frontOnly: frontOnlyOrOptions }
      : frontOnlyOrOptions

  const {
    frontOnly = true,
    forward,
    minDistance = 12,
    maxDistance = 47,
  } = options

  const baseAngle =
    forward && forward.x * forward.x + forward.z * forward.z > 1e-4
      ? Math.atan2(forward.z, forward.x)
      : -Math.PI / 2

  const angle = frontOnly
    ? baseAngle + (Math.random() - 0.5) * (Math.PI * 0.85)
    : Math.random() * Math.PI * 2

  const distance = minDistance + Math.random() * (maxDistance - minDistance)

  mob.home.set(
    THREE.MathUtils.clamp(
      center.x + Math.cos(angle) * distance,
      -OCEAN_HALF_SIZE,
      OCEAN_HALF_SIZE,
    ),
    THREE.MathUtils.clamp(
      center.y + (Math.random() - 0.5) * 24,
      SEABED_Y + 12,
      SURFACE_Y - 6,
    ),
    THREE.MathUtils.clamp(
      center.z + Math.sin(angle) * distance,
      -OCEAN_HALF_SIZE,
      OCEAN_HALF_SIZE,
    ),
  )

  mob.position.copy(mob.home)
  mob.heading
    .set(Math.random() - 0.5, (Math.random() - 0.5) * 0.2, Math.random() - 0.5)
    .normalize()
}

export function spawnMobs(): Mob[] {
  const origin = new THREE.Vector3()
  const species: NativeSpecies[] = ['clownfish', 'parrotfish', 'blue tang']

  const mobs: Mob[] = [
    ...Array.from({ length: 6 }, () => new Lionfish()),
    ...species.flatMap((kind) => [new NativeFish(kind), new NativeFish(kind)]),
  ]

  mobs.forEach((mob) => placeMob(mob, origin, true))
  return mobs
}