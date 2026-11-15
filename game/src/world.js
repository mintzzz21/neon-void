// The game's rules and state, with no drawing and no browser in it: the player's ship,
// the enemies, bullets, pickups, particles, waves and the boss, spawning, collisions,
// score, combo, lives and waves. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (sounds, screens) without the world
// knowing about them. Nothing here allocates after createWorld returns, except the
// short-lived arrays the step itself trims.

import { COMBO, EBULLET, ENEMY, FIELD, LIVES_START, PICKUP, PLAYER, WAVE, WEAPON } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_OVER = 4;
export const EVENT_WAVE = 8;
export const EVENT_BOSS = 16;
export const EVENT_PICKUP = 32;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    angle: -Math.PI / 2, fireCd: 0, invuln: 0, shield: false, weapon: 1, hidden: false,
  };
  const state = {
    player,
    enemies: [], bullets: [], ebullets: [], particles: [], pickups: [], floaters: [],
    score: 0, kills: 0, combo: 0, comboTimer: 0, comboMult: 1,
    lives: LIVES_START, wave: 0, phase: 'idle',
    spawnQueue: [], spawnTimer: 0, breatherTimer: 0, elapsed: 0,
    shake: 0, shakeX: 0, shakeY: 0,
    banner: '', bannerSub: '', bannerTimer: 0,
    demo: false, over: false, bossAnnounced: false, pickupsTaken: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.fireCd = 0;
    player.invuln = 0;
    player.shield = false;
    player.weapon = 1;
    player.hidden = false;
    state.enemies.length = 0;
    state.bullets.length = 0;
    state.ebullets.length = 0;
    state.particles.length = 0;
    state.pickups.length = 0;
    state.floaters.length = 0;
    state.score = 0;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.comboMult = 1;
    state.lives = LIVES_START;
    state.wave = 0;
    state.phase = 'idle';
    state.spawnQueue.length = 0;
    state.spawnTimer = 0;
    state.breatherTimer = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.shakeX = 0;
    state.shakeY = 0;
    state.banner = '';
    state.bannerSub = '';
    state.bannerTimer = 0;
    state.demo = false;
    state.over = false;
    state.bossAnnounced = false;
    state.pickupsTaken = 0;
    startWave(1);
  }

  /** Title-screen backdrop: drifting enemies, no player, nothing scores or dies.
   *  They stay in the margins, clear of the title text in the middle. */
  function demoReset() {
    reset();
    state.demo = true;
    state.phase = 'demo';
    state.banner = '';
    state.bannerTimer = 0;
    player.hidden = true;
    state.spawnQueue.length = 0;
    const bands = [
      () => ({ x: random.range(60, FIELD.width - 60), y: random.range(50, 130) }),
      () => ({ x: random.range(60, FIELD.width - 60), y: random.range(580, 680) }),
      () => ({ x: random.range(50, 200), y: random.range(160, 560) }),
      () => ({ x: random.range(1080, 1230), y: random.range(160, 560) }),
    ];
    for (let i = 0; i < 6; i += 1) {
      const kind = random.pick(['chaser', 'weaver', 'splitter', 'shooter']);
      const at = random.pick(bands)();
      const e = spawnEnemy(kind, at.x, at.y);
      // Demo drift: a slow straight drift, never steering at the hidden player.
      const a = random.angle();
      e.vx = Math.cos(a) * 42;
      e.vy = Math.sin(a) * 42;
    }
  }

  function edgePoint() {
    const side = random.int(0, 3);
    const m = 30;
    if (side === 0) return { x: random.range(m, FIELD.width - m), y: -m };
    if (side === 1) return { x: FIELD.width + m, y: random.range(m, FIELD.height - m) };
    if (side === 2) return { x: random.range(m, FIELD.width - m), y: FIELD.height + m };
    return { x: -m, y: random.range(m, FIELD.height - m) };
  }

  function spawnEnemy(kind, x, y) {
    const def = ENEMY[kind];
    const speedScale = Math.min(1.6, 1 + 0.03 * (state.wave - 1));
    const at = x === undefined ? edgePoint() : { x, y };
    const enemy = {
      kind, x: at.x, y: at.y, vx: 0, vy: 0,
      radius: def.radius, hp: kind === 'boss' ? def.hp + (state.wave - 5) * 4 : def.hp,
      maxHp: kind === 'boss' ? def.hp + (state.wave - 5) * 4 : def.hp,
      speed: def.speed * speedScale, color: def.color, shape: def.shape,
      t: random.range(0, Math.PI * 2), fireCd: random.range(1.2, 2.4),
      burstCd: 2.0, spawnCd: 5.0, rot: random.angle(),
    };
    state.enemies.push(enemy);
    return enemy;
  }

  function waveComp(n) {
    const list = [];
    const count = WAVE.baseCount + WAVE.perWave * n;
    for (let i = 0; i < count; i += 1) {
      const r = random();
      let kind = 'chaser';
      if (n >= 4 && r < 0.18) kind = 'shooter';
      else if (n >= 3 && r < 0.38) kind = 'splitter';
      else if (n >= 2 && r < 0.58) kind = 'weaver';
      list.push(kind);
    }
    return list;
  }

  /** Later waves spawn faster, so the arena stays busy as the counts grow. */
  function spawnInterval() {
    return Math.max(0.3, WAVE.spawnInterval - 0.04 * (state.wave - 1));
  }

  function startWave(n) {
    state.wave = n;
    state.phase = 'wave';
    state.bossAnnounced = false;
    state.spawnQueue = waveComp(n);
    if (n % WAVE.bossEvery === 0) {
      state.spawnQueue.unshift('boss', 'mini', 'mini', 'mini', 'mini');
      state.banner = `WAVE ${n} — VOIDBORN`;
      state.bannerSub = 'Destroy the boss ship';
    } else {
      state.banner = `WAVE ${n}`;
      state.bannerSub = `${state.spawnQueue.length} hostiles inbound`;
    }
    state.bannerTimer = 2.2;
    state.spawnTimer = 0.8;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length > 420) return;
      const a = random.angle();
      const s = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: random.range(0.3, 0.8), maxLife: 0.8, color, size: random.range(2, 5),
      });
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 1.0 });
    if (state.floaters.length > 24) state.floaters.shift();
  }

  function dropPickup(x, y) {
    if (!random.chance(PICKUP.dropChance)) return;
    const roll = random();
    let kind = 'weapon';
    if (roll < PICKUP.lifeChance && state.lives < PLAYER.maxLives) kind = 'life';
    else if (roll < PICKUP.lifeChance + 0.3) kind = 'shield';
    state.pickups.push({ x, y, vx: 0, vy: 0, kind, life: PICKUP.lifeTime, t: random.range(0, Math.PI * 2) });
  }

  function killEnemy(index) {
    const e = state.enemies[index];
    const mult = state.comboMult;
    const gained = ENEMY[e.kind].score * mult;
    state.score += gained;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.comboMult = Math.min(COMBO.maxMult, 1 + Math.floor(state.combo / COMBO.killsPerStep));
    burst(e.x, e.y, e.color, e.kind === 'boss' ? 90 : 22, e.kind === 'boss' ? 420 : 300);
    floater(e.x, e.y - 10, `+${gained}`, mult > 1 ? '#ffd166' : '#eef4ff');
    if (e.kind === 'splitter') {
      spawnEnemy('mini', e.x - 14, e.y);
      spawnEnemy('mini', e.x + 14, e.y);
    }
    if (e.kind === 'boss') {
      state.shake = 14;
      dropPickup(e.x - 60, e.y);
      dropPickup(e.x, e.y + 20);
      dropPickup(e.x + 60, e.y);
    } else {
      dropPickup(e.x, e.y);
    }
    state.enemies.splice(index, 1);
  }

  function hurtPlayer() {
    if (player.invuln > 0 || state.over) return false;
    if (player.shield) {
      player.shield = false;
      player.invuln = 1.0;
      burst(player.x, player.y, '#4dd8ff', 26, 320);
      state.shake = 6;
      return true;
    }
    state.lives -= 1;
    player.invuln = PLAYER.invulnerable;
    state.combo = 0;
    state.comboMult = 1;
    state.comboTimer = 0;
    burst(player.x, player.y, '#35f1ff', 40, 380);
    state.shake = 10;
    if (state.lives <= 0) {
      state.over = true;
      state.phase = 'done';
      burst(player.x, player.y, '#ff2d78', 90, 460);
      burst(player.x, player.y, '#35f1ff', 60, 380);
      player.hidden = true;
    }
    return true;
  }

  function fireBullet() {
    const level = player.weapon;
    const angles = WEAPON.spreads[level - 1];
    for (let i = 0; i < angles.length; i += 1) {
      const a = player.angle + angles[i];
      const nx = player.x + Math.cos(player.angle) * (PLAYER.radius + 6);
      const ny = player.y + Math.sin(player.angle) * (PLAYER.radius + 6);
      state.bullets.push({
        x: nx, y: ny, vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
        radius: PLAYER.bulletRadius, life: 0.9,
      });
    }
    player.fireCd = WEAPON.intervals[level - 1];
  }

  function fireEnemyOrb(e) {
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    state.ebullets.push({
      x: e.x, y: e.y, vx: Math.cos(a) * EBULLET.speed, vy: Math.sin(a) * EBULLET.speed,
      radius: EBULLET.radius, life: 4,
    });
  }

  function updatePlayer(dt, move, aim, firing) {
    player.vx += move.x * PLAYER.accel * dt;
    player.vy += move.y * PLAYER.accel * dt;
    const damp = Math.pow(0.0015, dt);
    player.vx *= damp;
    player.vy *= damp;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.speed) {
      player.vx = (player.vx / speed) * PLAYER.speed;
      player.vy = (player.vy / speed) * PLAYER.speed;
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
    player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    player.fireCd -= dt;
    if (firing && player.fireCd <= 0) fireBullet();
  }

  function updateEnemies(dt) {
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      e.t += dt;
      // Demo drifters keep their straight drift and wrap around the edges.
      if (state.demo) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += dt * 1.5;
        if (e.x < -40) e.x = FIELD.width + 40;
        if (e.x > FIELD.width + 40) e.x = -40;
        if (e.y < -40) e.y = FIELD.height + 40;
        if (e.y > FIELD.height + 40) e.y = -40;
        continue;
      }
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.kind === 'chaser' || e.kind === 'mini') {
        e.vx += (dx / d) * e.speed * 2.4 * dt;
        e.vy += (dy / d) * e.speed * 2.4 * dt;
      } else if (e.kind === 'weaver') {
        const px = -dy / d;
        const py = dx / d;
        const sway = Math.sin(e.t * 4) * 0.9;
        e.vx += ((dx / d) + px * sway) * e.speed * 2.2 * dt;
        e.vy += ((dy / d) + py * sway) * e.speed * 2.2 * dt;
      } else if (e.kind === 'splitter') {
        e.vx += (dx / d) * e.speed * 1.8 * dt;
        e.vy += (dy / d) * e.speed * 1.8 * dt;
      } else if (e.kind === 'shooter') {
        const want = d > 340 ? 1 : d < 220 ? -1 : 0;
        e.vx += (dx / d) * want * e.speed * 2 * dt;
        e.vy += (dy / d) * want * e.speed * 2 * dt;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && d < 560 && !state.demo) {
          fireEnemyOrb(e);
          e.fireCd = random.range(1.8, 2.6);
        }
      } else if (e.kind === 'boss') {
        e.vx += (dx / d) * e.speed * 1.6 * dt;
        e.vy += (dy / d) * e.speed * 1.6 * dt;
        e.burstCd -= dt;
        if (e.burstCd <= 0 && !state.demo) {
          const n = 10;
          for (let k = 0; k < n; k += 1) {
            const a = (k / n) * Math.PI * 2 + e.t;
            state.ebullets.push({
              x: e.x, y: e.y, vx: Math.cos(a) * EBULLET.speed * 0.85,
              vy: Math.sin(a) * EBULLET.speed * 0.85, radius: EBULLET.radius, life: 5,
            });
          }
          e.burstCd = 2.4;
        }
        e.spawnCd -= dt;
        if (e.spawnCd <= 0) {
          spawnEnemy('mini', e.x - 40, e.y);
          spawnEnemy('mini', e.x + 40, e.y);
          e.spawnCd = 6;
        }
      }
      const es = Math.hypot(e.vx, e.vy);
      if (es > e.speed) {
        e.vx = (e.vx / es) * e.speed;
        e.vy = (e.vy / es) * e.speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rot += dt * 1.5;
    }
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const rr = b.radius + e.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          state.bullets.splice(i, 1);
          e.hp -= 1;
          burst(b.x, b.y, '#8ef6ff', 5, 180);
          if (e.hp <= 0) killEnemy(j);
          break;
        }
      }
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.ebullets.splice(i, 1);
      }
    }
  }

  function updatePickups(dt) {
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const p = state.pickups[i];
      p.t += dt;
      p.life -= dt;
      if (p.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      const d = Math.hypot(player.x - p.x, player.y - p.y);
      if (d < PICKUP.magnetRadius && !player.hidden) {
        const pull = 520 * dt;
        p.x += ((player.x - p.x) / (d || 1)) * pull;
        p.y += ((player.y - p.y) / (d || 1)) * pull;
      }
      if (d < PLAYER.radius + 16 && !player.hidden) {
        state.pickups.splice(i, 1);
        state.pickupsTaken += 1;
        if (p.kind === 'weapon') {
          if (player.weapon < WEAPON.maxLevel) {
            player.weapon += 1;
            floater(player.x, player.y - 24, `WEAPON LV${player.weapon}`, '#ffd166');
          } else {
            state.score += 250;
            floater(player.x, player.y - 24, '+250', '#ffd166');
          }
        } else if (p.kind === 'shield') {
          player.shield = true;
          floater(player.x, player.y - 24, 'SHIELD UP', '#4dd8ff');
        } else {
          state.lives = Math.min(PLAYER.maxLives, state.lives + 1);
          floater(player.x, player.y - 24, '+1 SHIP', '#ff7ad9');
        }
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.05, dt);
      p.vy *= Math.pow(0.05, dt);
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.y -= 34 * dt;
      f.life -= dt * 0.9;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
  }

  function checkPlayerHits() {
    if (player.hidden || player.invuln > 0 || state.demo) return 0;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      const rr = PLAYER.radius + e.radius - 4;
      if (dist2(player.x, player.y, e.x, e.y) < rr * rr) {
        if (e.kind === 'boss') {
          hurtPlayer();
          player.vx = ((player.x - e.x) / (Math.hypot(player.x - e.x, player.y - e.y) || 1)) * 520;
          player.vy = ((player.y - e.y) / (Math.hypot(player.x - e.x, player.y - e.y) || 1)) * 520;
        } else {
          e.hp = 0;
          killEnemy(i);
          hurtPlayer();
        }
        return state.over ? EVENT_OVER : EVENT_HIT;
      }
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      const rr = PLAYER.radius + b.radius - 3;
      if (dist2(player.x, player.y, b.x, b.y) < rr * rr) {
        state.ebullets.splice(i, 1);
        hurtPlayer();
        return state.over ? EVENT_OVER : EVENT_HIT;
      }
    }
    return 0;
  }

  /**
   * One fixed step. `input` is { move, aim, firing } or null (title backdrop).
   * Returns bit flags of what happened this step.
   */
  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.comboMult = 1;
      }
    }
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 26);
      state.shakeX = random.range(-1, 1) * state.shake;
      state.shakeY = random.range(-1, 1) * state.shake;
    } else {
      state.shakeX = 0;
      state.shakeY = 0;
    }

    if (state.demo) {
      updateEnemies(dt);
      updateParticles(dt);
      return 0;
    }

    if (input) updatePlayer(dt, input.move, input.aim, input.firing);
    const killsBefore = state.kills;
    const pickupsBefore = state.pickupsTaken;
    updateEnemies(dt);
    updateBullets(dt);
    updatePickups(dt);
    updateParticles(dt);
    events |= checkPlayerHits();
    if (state.kills > killsBefore) events |= EVENT_KILL;
    if (state.pickupsTaken > pickupsBefore) events |= EVENT_PICKUP;
    if (state.over) return events | EVENT_OVER;

    if (state.phase === 'wave' && state.wave % WAVE.bossEvery === 0 && !state.bossAnnounced) {
      state.bossAnnounced = true;
      events |= EVENT_BOSS;
    }

    if (state.phase === 'wave') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          // Squads: enemies arrive in small clusters of the same kind, so the
          // arena reads as a swarm rather than a trickle of lone ships. Wave 1
          // stays single-file so a new player can learn the ropes.
          const kind = state.spawnQueue.shift();
          const at = edgePoint();
          spawnEnemy(kind, at.x, at.y);
          if (state.wave >= 2 && random.chance(0.45)) spawnEnemy(kind, at.x + random.range(-46, 46), at.y + random.range(-46, 46));
          if (state.wave >= 2 && random.chance(0.2)) spawnEnemy(kind, at.x + random.range(-70, 70), at.y + random.range(-70, 70));
          state.spawnTimer = spawnInterval();
        }
      } else if (state.enemies.length === 0) {
        const bonus = 250 * state.wave;
        state.score += bonus;
        floater(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE ${state.wave} CLEAR  +${bonus}`, '#ffd166');
        events |= EVENT_WAVE;
        state.phase = 'breather';
        state.breatherTimer = WAVE.breather;
      }
    } else if (state.phase === 'breather') {
      state.breatherTimer -= dt;
      if (state.breatherTimer <= 0) startWave(state.wave + 1);
    }
    return events;
  }

  reset();
  return { state, reset, demoReset, step, startWave, spawnEnemy };
}
