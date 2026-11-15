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