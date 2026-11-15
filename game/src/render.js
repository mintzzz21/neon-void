// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon vector art: layered strokes for glow (shadowBlur only on the few things
// that need it), a pre-rendered starfield background, canvas text for the HUD and panels.

import { FIELD, FONT, FONT_FALLBACK, PALETTE, PLAYER } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 78 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function polygon(ctx, x, y, radius, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const finalWave = cachedLabel('WAVE REACHED ');

  // The starfield + nebula backdrop, painted once to an offscreen canvas.
  const bg = document.createElement('canvas');
  bg.width = FIELD.width;
  bg.height = FIELD.height;
  {
    const b = bg.getContext('2d');
    b.fillStyle = PALETTE.backdrop;
    b.fillRect(0, 0, FIELD.width, FIELD.height);
    const nebulae = [
      { x: 220, y: 160, r: 320, c: 'rgba(64, 40, 160, 0.20)' },
      { x: 1060, y: 560, r: 360, c: 'rgba(16, 110, 160, 0.18)' },
      { x: 980, y: 120, r: 260, c: 'rgba(160, 30, 90, 0.14)' },
    ];
    for (const n of nebulae) {
      const g = b.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = g;
      b.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    const rng = createRandom(1337);
    for (let i = 0; i < 130; i += 1) {
      b.fillStyle = rng() < 0.12 ? '#ffffff' : PALETTE.star;
      b.globalAlpha = rng.range(0.25, 0.9);
      const s = rng() < 0.1 ? 2 : 1;
      b.fillRect(Math.floor(rng.range(0, FIELD.width)), Math.floor(rng.range(0, FIELD.height)), s, s);
    }
    b.globalAlpha = 1;
    b.strokeStyle = PALETTE.grid;
    b.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 80) {
      b.beginPath();
      b.moveTo(x + 0.5, 0);
      b.lineTo(x + 0.5, FIELD.height);
      b.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      b.beginPath();
      b.moveTo(0, y + 0.5);
      b.lineTo(FIELD.width, y + 0.5);
      b.stroke();
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Client (CSS pixel) coordinates -> logical field coordinates. */
  function clientToLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const px = (clientX - rect.left) * ratio;
    const py = (clientY - rect.top) * ratio;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, font, baseline) {
    const key = `${size}|${font || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${size}px ${font || FONT_FALLBACK}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowText(value, x, y, size, color, align) {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 22;
    text(value, x, y, size, color, align, FONT);
    context.shadowBlur = 0;
    text(value, x, y, size, color, align, FONT);
    context.restore();
  }

  function drawShip(x, y, angle, radius, color, flame) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    if (flame) {
      context.fillStyle = 'rgba(255, 170, 40, 0.85)';
      context.beginPath();
      context.moveTo(-radius * 0.7, -5);
      context.lineTo(-radius * (1.25 + flame * 0.5), 0);
      context.lineTo(-radius * 0.7, 5);
      context.closePath();
      context.fill();
    }
    context.shadowColor = color;
    context.shadowBlur = 16;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(radius * 1.3, 0);
    context.lineTo(-radius * 0.9, radius * 0.85);
    context.lineTo(-radius * 0.45, 0);
    context.lineTo(-radius * 0.9, -radius * 0.85);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(radius * 0.35, 0, radius * 0.28, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawEnemy(e) {
    context.save();
    context.translate(e.x, e.y);
    const hurt = e.hp < e.maxHp;
    context.globalAlpha = 0.28;
    context.fillStyle = e.color;
    polygon(context, 0, 0, e.radius + 7, e.shape === 'hex' ? 6 : e.shape === 'square' ? 4 : 3, e.rot);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = e.color;
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1.5;
    if (e.shape === 'tri' || e.shape === 'diamond') {
      const sides = e.shape === 'tri' ? 3 : 4;
      polygon(context, 0, 0, e.radius, sides, e.rot);
      context.fill();
      context.stroke();
    } else if (e.shape === 'hex') {
      polygon(context, 0, 0, e.radius, 6, e.rot);
      context.fill();
      context.stroke();
      context.fillStyle = PALETTE.backdrop;
      polygon(context, 0, 0, e.radius * 0.45, 6, -e.rot);
      context.fill();
    } else if (e.shape === 'square') {
      context.rotate(e.rot * 0.4);
      context.fillRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
      context.strokeRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
      context.fillStyle = PALETTE.backdrop;
      context.beginPath();
      context.arc(0, 0, e.radius * 0.32, 0, Math.PI * 2);
      context.fill();
    } else if (e.shape === 'boss') {
      context.rotate(e.rot * 0.25);
      context.shadowColor = e.color;
      context.shadowBlur = 26;
      polygon(context, 0, 0, e.radius, 8, 0);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      polygon(context, 0, 0, e.radius, 8, 0);
      context.stroke();
      context.fillStyle = PALETTE.backdrop;
      polygon(context, 0, 0, e.radius * 0.55, 8, Math.PI / 8);
      context.fill();
      context.fillStyle = e.color;
      context.beginPath();
      context.arc(0, 0, e.radius * 0.28, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(0, 0, e.radius * 0.12, 0, Math.PI * 2);
      context.fill();
    }
    if (hurt && e.maxHp > 2) {
      context.restore();
      const w = e.radius * 2;
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
      context.fillStyle = '#ff5d5d';
      context.fillRect(e.x - w / 2, e.y - e.radius - 12, (w * e.hp) / e.maxHp, 5);
      return;
    }
    context.restore();
  }

  function drawField(state) {
    context.drawImage(bg, 0, 0);
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    for (const p of state.pickups) {
      const bob = Math.sin(p.t * 3) * 3;
      const blink = p.life < 3 ? (Math.floor(p.life * 6) % 2 === 0 ? 1 : 0.35) : 1;
      context.globalAlpha = blink;
      context.save();
      context.translate(p.x, p.y + bob);
      context.shadowBlur = 14;
      if (p.kind === 'weapon') {
        context.shadowColor = '#ffd166';
        context.fillStyle = '#ffd166';
        polygon(context, 0, 0, 13, 5, -Math.PI / 2);
        context.fill();
      } else if (p.kind === 'shield') {
        context.shadowColor = '#4dd8ff';
        context.strokeStyle = '#4dd8ff';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(0, 0, 12, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = '#4dd8ff';
        context.beginPath();
        context.arc(0, 0, 4, 0, Math.PI * 2);
        context.fill();
      } else {
        context.shadowColor = '#ff7ad9';
        context.fillStyle = '#ff7ad9';
        context.beginPath();
        context.moveTo(0, 9);
        context.bezierCurveTo(-14, -4, -8, -14, 0, -6);
        context.bezierCurveTo(8, -14, 14, -4, 0, 9);
        context.fill();
      }
      context.restore();
    }
    context.globalAlpha = 1;
    for (const e of state.enemies) drawEnemy(e);
    for (const b of state.bullets) {
      context.save();
      context.shadowColor = PALETTE.bullet;
      context.shadowBlur = 12;
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    for (const b of state.ebullets) {
      context.save();
      context.shadowColor = '#ff2244';
      context.shadowBlur = 12;
      context.fillStyle = PALETTE.ebullet;
      context.beginPath();
      context.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    const player = state.player;
    if (!player.hidden) {
      const blink = player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0;
      if (!blink) {
        const flame = 0.5 + 0.5 * Math.sin(state.elapsed * 31);
        drawShip(player.x, player.y, player.angle, PLAYER.radius, PALETTE.player, flame);
        if (player.shield) {
          context.save();
          context.strokeStyle = PALETTE.shield;
          context.globalAlpha = 0.7 + 0.3 * Math.sin(state.elapsed * 6);
          context.lineWidth = 2.5;
          context.shadowColor = PALETTE.shield;
          context.shadowBlur = 12;
          context.beginPath();
          context.arc(player.x, player.y, PLAYER.radius + 10, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
      }
    }
    for (const f of state.floaters) {
      context.globalAlpha = Math.max(0, f.life);
      text(f.text, f.x, f.y, 20, f.color, 'center', FONT);
    }
    context.globalAlpha = 1;
    if (state.bannerTimer > 0) {
      const a = Math.min(1, state.bannerTimer / 0.5, (2.2 - state.bannerTimer) / 0.3 + 0.4);
      context.globalAlpha = Math.max(0, Math.min(1, a));
      glowText(state.banner, FIELD.width / 2, 300, 54, '#35f1ff', 'center');
      if (state.bannerSub) text(state.bannerSub, FIELD.width / 2, 340, 22, PALETTE.muted, 'center');
      context.globalAlpha = 1;
    }
  }

  function drawHud(state, best) {
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left', FONT, 'top');
    if (best > 0) text(bestLabel(best), 24, 54, 17, PALETTE.muted, 'left', FONT, 'top');
    text(waveLabel(state.wave), FIELD.width / 2, 18, 26, PALETTE.text, 'center', FONT, 'top');
    const label = 'SHIPS';
    text(label, FIELD.width - 24, 18, 17, PALETTE.muted, 'right', FONT, 'top');
    for (let i = 0; i < state.lives; i += 1) {
      const x = FIELD.width - 36 - i * 34;
      context.save();
      context.translate(x, 62);
      context.rotate(Math.PI / 2);
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.moveTo(11, 0);
      context.lineTo(-8, 7);
      context.lineTo(-4, 0);
      context.lineTo(-8, -7);
      context.closePath();
      context.fill();
      context.restore();
    }
    if (state.comboMult > 1) {
      const w = 150;
      const frac = state.comboTimer / 3;
      context.fillStyle = 'rgba(255,209,102,0.25)';
      context.fillRect(24, 84, w, 8);
      context.fillStyle = PALETTE.gold;
      context.fillRect(24, 84, w * Math.max(0, frac), 8);
      text(`COMBO x${state.comboMult}`, 24, 98, 17, PALETTE.gold, 'left', FONT, 'top');
    }
    const pips = state.player.weapon;
    text('WEAPON', 24, FIELD.height - 32, 15, PALETTE.muted, 'left', FONT, 'top');
    for (let i = 0; i < 4; i += 1) {
      context.fillStyle = i < pips ? PALETTE.gold : 'rgba(255,255,255,0.15)';
      context.beginPath();
      context.arc(100 + i * 22, FIELD.height - 24, 6, 0, Math.PI * 2);
      context.fill();
    }
    if (state.player.shield) text('SHIELD', FIELD.width - 24, FIELD.height - 32, 15, PALETTE.shield, 'right', FONT, 'top');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || 'rgba(53, 241, 255, 0.4)';
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    glowText(title, FIELD.width / 2, y + 78, 46, accent || '#35f1ff', 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + state.shakeX * view.scale, view.y + state.shakeY * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      context.save();
      context.fillStyle = 'rgba(5, 6, 15, 0.72)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.restore();
      glowText('NEON VOID', FIELD.width / 2, 218, 92, '#35f1ff', 'center');
      text('A TWIN-STICK ARENA SURVIVAL SHOOTER', FIELD.width / 2, 262, 22, PALETTE.muted, 'center', FONT);
      const lines = [
        'WASD / arrows — fly      Mouse — aim      Hold click / Space — fire',
        'Survive the waves. Chain kills for combo. Grab weapon, shield and ship drops.',
        'A boss warps in every 5th wave.   P — pause      M — sound ' + (muted ? 'off' : 'on'),
        '',
        best > 0 ? `BEST ${best}` : 'No runs yet — set the first best score.',
      ];
      drawPanelLines(lines);
      text('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 596, 24, PALETTE.gold, 'center', FONT);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The void waits for you.'], 'Press P or click to resume');
    } else if (screen === SCREEN_OVER) {
      const lines = [finalLabel(state.score), finalWave(state.wave), bestLabel(best)];
      drawPanel('GAME OVER', lines, 'Press R or click to fly again', '#ff2d78');
    }
  }

  function drawPanelLines(lines) {
    for (let i = 0; i < lines.length; i += 1) {
      const y = 316 + i * 34;
      const color = i === 4 ? PALETTE.gold : PALETTE.text;
      const size = i === 4 ? 22 : 20;
      text(lines[i], FIELD.width / 2, y, size, color, 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, clientToLogical };
}
