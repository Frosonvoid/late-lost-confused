import * as THREE from 'three'

import {
  Lionfish,
  Mob,
  NativeFish,
  placeMob,
  type NativeSpecies,
} from './Mobs'

export interface MobSpawnerConfig {
  chunkSize?: number
  spawnMinRadius?: number
  spawnMaxRadius?: number
  despawnRadius?: number
  baseRatePerSecond?: number
  travelRateScale?: number
  chunkEntryBonus?: number
  lionfishCount?: number
  nativePerSpeciesCount?: number
}

// Moves an active spawning bubble with the submarine across ocean chunks:
// - Despawns mobs left behind outside the bubble
// - Spawns new mobs ahead as you enter fresh chunks
// - Scales spawn rate dynamically with movement speed
export class MobSpawner {
  readonly chunkSize: number
  readonly spawnMinRadius: number
  readonly spawnMaxRadius: number
  readonly despawnRadius: number

  private readonly baseRatePerSecond: number
  private readonly travelRateScale: number
  private readonly chunkEntryBonus: number
  private readonly lionfishCount: number
  private readonly nativePerSpeciesCount: number

  private lastChunkX: number | null = null
  private lastChunkZ: number | null = null
  private readonly lastPlayerPos = new THREE.Vector3()
  private hasLastPos = false
  private spawnProgress = 0

  constructor(config: MobSpawnerConfig = {}) {
    this.chunkSize = config.chunkSize ?? 32
    this.spawnMinRadius = config.spawnMinRadius ?? 24
    this.spawnMaxRadius = config.spawnMaxRadius ?? 48
    this.despawnRadius = config.despawnRadius ?? 56
    this.baseRatePerSecond = config.baseRatePerSecond ?? 0.8
    this.travelRateScale = config.travelRateScale ?? 0.35
    this.chunkEntryBonus = config.chunkEntryBonus ?? 3.0
    this.lionfishCount = config.lionfishCount ?? 12
    this.nativePerSpeciesCount = config.nativePerSpeciesCount ?? 3
  }

  createInitialPopulation(origin = new THREE.Vector3()): Mob[] {
    const species: NativeSpecies[] = ['clownfish', 'parrotfish', 'blue tang']

    const mobs: Mob[] = [
      ...Array.from({ length: this.lionfishCount }, () => new Lionfish()),
      ...species.flatMap((kind) =>
        Array.from(
          { length: this.nativePerSpeciesCount },
          () => new NativeFish(kind),
        ),
      ),
    ]

    mobs.forEach((mob) => placeMob(mob, origin, true))
    return mobs
  }

  update(
    mobs: Mob[],
    delta: number,
    playerPosition: THREE.Vector3,
    playerHeading: THREE.Vector3,
  ) {
    const chunkX = Math.floor(playerPosition.x / this.chunkSize)
    const chunkZ = Math.floor(playerPosition.z / this.chunkSize)
    const enteredNewChunk =
      this.lastChunkX !== null &&
      (chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ)

    this.lastChunkX = chunkX
    this.lastChunkZ = chunkZ

    const distanceMoved = this.hasLastPos
      ? playerPosition.distanceTo(this.lastPlayerPos)
      : 0
    this.lastPlayerPos.copy(playerPosition)
    this.hasLastPos = true

    const despawnDistSq = this.despawnRadius * this.despawnRadius

    // 1. Despawn mobs left behind outside the active bubble.
    for (const mob of mobs) {
      if (!mob.isAlive) {
        mob.deadFor += delta
        continue
      }

      if (mob.position.distanceToSquared(playerPosition) > despawnDistSq) {
        mob.despawn()
      }
    }

    // 2. Spawn rate scales as you move and surges when entering a new chunk.
    this.spawnProgress +=
      delta * this.baseRatePerSecond +
      distanceMoved * this.travelRateScale +
      (enteredNewChunk ? this.chunkEntryBonus : 0)

    // 3. Spawn recycled mobs into the newly loaded chunk ahead of the submarine.
    while (this.spawnProgress >= 1) {
      const candidate = mobs.find((mob) => !mob.isAlive)
      if (!candidate) {
        this.spawnProgress = 0
        break
      }

      this.spawnProgress -= 1
      placeMob(candidate, playerPosition, {
        frontOnly: true,
        forward: playerHeading,
        minDistance: this.spawnMinRadius,
        maxDistance: this.spawnMaxRadius,
      })
      candidate.revive()
    }
  }

  reset() {
    this.lastChunkX = null
    this.lastChunkZ = null
    this.hasLastPos = false
    this.spawnProgress = 0
  }
}