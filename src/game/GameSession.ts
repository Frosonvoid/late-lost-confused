import { useSyncExternalStore } from 'react'
import * as THREE from 'three'

import { SUB_COLLISION_RADIUS } from './config'
import { submitScore, type ScoreEntry } from './Leaderboard'
import { placeMob, type Mob } from './Mobs'
import { MobSpawner } from './MobSpawner'
import { Submarine } from './Submarine'

export type GameStatus = 'playing' | 'gameover'

export type GameEvent = {
  id: number
  text: string
  good: boolean
}

export type GameSnapshot = {
  score: number
  hull: number
  status: GameStatus
  event: GameEvent | null
}

export class GameSession {
  readonly playerName = 'GUEST' // TODO(PHP): use the logged-in user's display name
  readonly submarine = new Submarine()
  readonly spawner = new MobSpawner()
  readonly mobs: Mob[] = this.spawner.createInitialPopulation()

  private score = 0
  private status: GameStatus = 'playing'
  private event: GameEvent | null = null
  private eventCount = 0
  private snapshot: GameSnapshot
  private readonly listeners = new Set<() => void>()

  constructor() {
    this.snapshot = this.createSnapshot()
  }

  get isPlaying() {
    return this.status === 'playing'
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  update(delta: number, subPosition: THREE.Vector3) {
    if (!this.isPlaying) return

    this.submarine.tick(delta)

    this.spawner.update(
      this.mobs,
      delta,
      subPosition,
      this.submarine.heading,
    )

    for (const mob of this.mobs) {
      if (!mob.isAlive) continue

      if (mob.position.distanceTo(subPosition) < SUB_COLLISION_RADIUS + mob.hitRadius) {
        this.collide(mob, subPosition)
      }
    }
  }

  scoreHit(mob: Mob, incomingDirection?: THREE.Vector3) {
    if (!this.isPlaying) return

    const change = mob.hitByTorpedo(incomingDirection)
    const label = mob.name.toUpperCase()

    if (change === 0) {
      if (mob.isDodging) {
        this.notify(`${label} DODGED!`, false)
      }
      return
    }

    this.score = Math.max(0, this.score + change)
    this.notify(
      change > 0 ? `+${change} ${label} ELIMINATED` : `${change} PROTECTED ${label} HIT`,
      change > 0,
    )
  }

  restart() {
    this.score = 0
    this.event = null
    this.status = 'playing'
    this.submarine.reset()
    this.spawner.reset()

    const origin = new THREE.Vector3()
    this.mobs.forEach((mob) => {
      placeMob(mob, origin, true)
      mob.revive()
    })

    this.emit()
  }

  submit(name: string): Promise<ScoreEntry[]> {
    return submitScore(name, this.score)
  }

  private collide(mob: Mob, subPosition: THREE.Vector3) {
    mob.heading.copy(mob.position).sub(subPosition).normalize()

    const damage = mob.onCollision()
    if (!this.submarine.takeDamage(damage)) return

    this.notify(`-${damage} HULL DAMAGE`, false)

    if (this.submarine.isDestroyed) {
      this.status = 'gameover'
      this.emit()
    }
  }

  private notify(text: string, good: boolean) {
    this.event = { id: ++this.eventCount, text, good }
    this.emit()
  }

  private emit() {
    this.snapshot = this.createSnapshot()
    this.listeners.forEach((listener) => listener())
  }

  private createSnapshot(): GameSnapshot {
    return {
      score: this.score,
      hull: this.submarine.hullIntegrity,
      status: this.status,
      event: this.event,
    }
  }
}

export function useGameSession(session: GameSession) {
  return useSyncExternalStore(session.subscribe, session.getSnapshot)
}