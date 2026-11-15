// NEON VOID — tuning numbers and colours in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 430,
  accel: 3400,
  fireInterval: 0.15,
  bulletSpeed: 780,
  bulletRadius: 5,
  invulnerable: 2.0,
  maxLives: 5,
};

export const LIVES_START = 3;

/** Weapon levels: 1 = single shot, 2 = twin, 3 = triple spread, 4 = quad + faster. */
export const WEAPON = {
  maxLevel: 4,
  intervals: [0.15, 0.13, 0.12, 0.1],
  spreads: [[0], [-0.09, 0.09], [-0.14, 0, 0.14], [-0.2, -0.07, 0.07, 0.2]],
};

/** Enemy kinds: chaser seeks, weaver sines in, splitter births minis, shooter keeps range. */
export const ENEMY = {
  chaser: { radius: 16, speed: 150, hp: 1, score: 50, color: '#ff2d78', shape: 'tri' },
  weaver: { radius: 14, speed: 190, hp: 1, score: 75, color: '#ff9f1c', shape: 'diamond' },
  splitter: { radius: 20, speed: 110, hp: 2, score: 100, color: '#2ee66b', shape: 'hex' },
  mini: { radius: 10, speed: 230, hp: 1, score: 25, color: '#7dff5e', shape: 'tri' },
  shooter: { radius: 17, speed: 120, hp: 2, score: 150, color: '#b967ff', shape: 'square' },
  boss: { radius: 52, speed: 55, hp: 140, score: 2000, color: '#ff2244', shape: 'boss' },
};

export const EBULLET = { radius: 7, speed: 260 };

/** Combo: each kill refreshes a 3 s window; multiplier grows every 8 kills, capped at x8. */
export const COMBO = { window: 3, killsPerStep: 8, maxMult: 8 };

/** Wave N spawns 8 + 4N enemies; a boss leads every 5th wave. */
export const WAVE = {
  baseCount: 8,
  perWave: 4,
  spawnInterval: 0.6,
  breather: 3.0,
  bossEvery: 5,
};

/** Pickup drop chance per kill, and what a pickup does. */
export const PICKUP = {
  dropChance: 0.16,
  lifeChance: 0.08,
  magnetRadius: 130,
  lifeTime: 9,
};

export const PALETTE = {
  backdrop: '#05060f',
  grid: 'rgba(56, 120, 255, 0.10)',
  star: '#cdd8ff',
  player: '#35f1ff',
  bullet: '#8ef6ff',
  ebullet: '#ff5d5d',
  shield: '#4dd8ff',
  text: '#eef4ff',
  muted: '#8b93b8',
  gold: '#ffd166',
  panel: 'rgba(10, 14, 34, 0.82)',
};

export const FONT = '"Orbitron", "Rajdhani", system-ui, sans-serif';
export const FONT_FALLBACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-void.best';
export const MUTE_KEY = 'neon-void.muted';
