import * as THREE from 'three'

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

  private alive = true
  private readonly toHome = new THREE.Vector3()

  abstract readonly name: string
  abstract readonly collisionDamage: number // hull HP the submarine loses on collision
  abstract readonly torpedoScore: number // score change when a torpedo hits it
  abstract readonly swimSpeed: number

  get isAlive() {
    return this.alive
  }

  // Default behaviour: swim ahead, and turn gently back toward home when too far away.
  update(delta: number) {
    if (!this.alive) return

    this.position.addScaledVector(this.heading, this.swimSpeed * delta)

    if (this.position.distanceTo(this.home) > this.roamRadius) {
      this.toHome.copy(this.home).sub(this.position).normalize()
      this.heading.lerp(this.toHome, Math.min(1, 2 * delta)).normalize()
    }
  }

  // Returns the score change (positive for a good hit, negative for a penalty).
  hitByTorpedo(): number {
    if (!this.alive) return 0

    this.alive = false
    return this.torpedoScore
  }

  // Returns the HP the submarine should lose, e.g. submarine.takeDamage(mob.onCollision()).
  onCollision(): number {
    return this.alive ? this.collisionDamage : 0
  }
}

// Invasive species: destroy these.
export class Lionfish extends Mob {
  readonly name = 'Lionfish'
  readonly collisionDamage = 20
  readonly torpedoScore = 100
  readonly swimSpeed = 3
  readonly isInvasive = true
}

export type NativeSpecies = 'clownfish' | 'parrotfish' | 'blue tang'

// Protected species: hitting these costs points.
export class NativeFish extends Mob {
  readonly name: string
  readonly collisionDamage = 10
  readonly torpedoScore = -150
  readonly swimSpeed = 2
  readonly species: NativeSpecies

  constructor(species: NativeSpecies) {
    super()
    this.species = species
    this.name = species
  }
}