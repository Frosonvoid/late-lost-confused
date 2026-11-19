import * as THREE from 'three'

// Ocean layout (world units). The camera starts mid-water at y = 0.
export const SEABED_Y = -40
export const SURFACE_Y = 40
export const OCEAN_HALF_SIZE = 400

// Water colour fades from SHALLOW (near the surface) to DEEP (near the seabed).
export const SHALLOW_COLOR = new THREE.Color('#0a4a6e')
export const DEEP_COLOR = new THREE.Color('#010812')

// Submarine
export const MAX_HULL = 100
export const CRUISE_SPEED = 8
export const BOOST_MULTIPLIER = 2.2
export const WATER_DRAG = 1.5 // lower = heavier water, longer glide

// Where the pilot's seat sits inside the cockpit model. Put your tuned value here.
export const COCKPIT_OFFSET = new THREE.Vector3(0, 0, -1)

// Lionfish model (FBX files come in wildly different scales, so it is resized to this length).
export const LIONFISH_LENGTH = 1.6

// If the fish swims sideways or backwards, try Math.PI / 2, -Math.PI / 2 or Math.PI.
export const LIONFISH_YAW_OFFSET = 0

// Animation clip names, lowercase with spaces and symbols removed. Any clip whose
// name contains one of these is used. The console logs the real clip names once.
export const LIONFISH_CLIPS = {
  normal: 'swimnormal',
  fast: 'dolphinswim',
  idle: 'idleswim',
}

// Combat
export const TORPEDO_SPEED = 70
export const TORPEDO_LIFETIME = 3 // seconds before a missed torpedo disappears
export const TORPEDO_RADIUS = 0.3
export const MAX_TORPEDOES = 8
export const FIRE_COOLDOWN_MS = 400
export const SUB_COLLISION_RADIUS = 1.5 // how big the submarine is for fish collisions
export const INVULNERABLE_SECONDS = 1 // grace period after the hull takes a hit
export const RESPAWN_SECONDS = 3 // how long a destroyed fish stays gone