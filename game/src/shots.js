// The screenshot scenes behind ?shot=start|play|boss|over. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (flee the nearest threat, aim at the nearest enemy, hold fire), so the frame is what a
// short game really looks like and the same seed always gives the same frame. The over
// scene's pilot never fires and barely moves, so it is caught out like a hurried player.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const BOSS_SECONDS = 14;
const OVER_LIMIT_SECONDS = 240;

/** Pick the nearest enemy to aim at, or null when the field is empty. */
function nearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/**
 * Autopilot input for one step: move away from the closest danger (enemy or enemy
 * bullet) inside the flee radius, drift toward the centre otherwise; aim at the
 * nearest enemy and hold fire. `passive` stands still but keeps firing (the over
 * scene): it kills a few, then the swarm closes in.
 */
function autopilot(state, passive) {
  const p = state.player;
  if (passive) {
    const target = nearestEnemy(state);
    return {
      move: { x: 0, y: 0 },
      aim: target ? { x: target.x, y: target.y } : { x: p.x, y: p.y - 100 },
      firing: true,
    };
  }
  let fx = 0;
  let fy = 0;
  const FLEE = 170;
  for (const e of state.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < FLEE) {
      const w = (FLEE - d) / FLEE;
      fx += (dx / d) * w;
      fy += (dy / d) * w;
    }
  }
  for (const b of state.ebullets) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 120) {
      const w = (120 - d) / 120;
      fx += (dx / d) * w * 1.4;
      fy += (dy / d) * w * 1.4;
    }
  }
  if (Math.hypot(fx, fy) < 0.15) {
    // Nothing close: drift toward the centre so the frame stays composed.
    fx = (FIELD.width / 2 - p.x) / FIELD.width;
    fy = (FIELD.height / 2 - p.y) / FIELD.height;
  }
  const len = Math.hypot(fx, fy) || 1;
  const target = nearestEnemy(state);
  return {
    move: { x: fx / len, y: fy / len },
    aim: target ? { x: target.x, y: target.y } : { x: p.x, y: p.y - 100 },
    firing: true,
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * score to show. start = title over drifting enemies; play = mid-wave combat;
 * boss = the wave-5 boss fight; over = a game over with a real score.
 */
export function stageShot(name, world) {
  if (name === 'start') {
    world.demoReset();
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.reset();
  if (name === 'boss') {
    world.startWave(5);
    for (let i = 0; i < BOSS_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, false));
      if (world.state.over) break;
    }
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: 0 };
  }
  if (name === 'over') {
    for (let i = 0; i < OVER_LIMIT_SECONDS / STEP; i += 1) {
      if (world.step(STEP, autopilot(world.state, true)) & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // Play until the field is busy (mid-wave, seven hostiles up), never past the cap:
  // a frame caught in a breather lull would show an empty arena.
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    world.step(STEP, autopilot(world.state, false));
    if (world.state.over) break;
    if (world.state.elapsed > 4 && world.state.enemies.length >= 7 && world.state.phase === 'wave') break;
  }
  return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: 0 };
}
