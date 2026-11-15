// Keyboard and pointer input. Movement keys give a steering vector; the mouse gives an
// aim point in logical field coordinates; one-shot presses (confirm, pause, mute) are
// queued as bit flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const KEYS = {
  up: new Set(['ArrowUp', 'KeyW']),
  down: new Set(['ArrowDown', 'KeyS']),
  left: new Set(['ArrowLeft', 'KeyA']),
  right: new Set(['ArrowRight', 'KeyD']),
  confirm: new Set(['Space', 'Enter']),
  pause: new Set(['KeyP', 'Escape']),
  mute: new Set(['KeyM']),
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  let spaceHeld = false;
  let actions = 0;
  /** Mouse aim in logical field coordinates (updated by the renderer scale). */
  const mouse = { x: 640, y: 300, down: false, inside: false };
  let toLogical = (cx, cy) => ({ x: cx, y: cy });

  function keyGroup(code) {
    for (const [name, set] of Object.entries(KEYS)) {
      if (set.has(code)) return name;
    }
    return null;
  }

  window.addEventListener('keydown', (event) => {
    const group = keyGroup(event.code);
    if (!group) return;
    if (group in held) held[group] = true;
    else if (group === 'confirm') {
      spaceHeld = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (group === 'pause' && !event.repeat) actions |= ACTION_PAUSE;
    else if (group === 'mute' && !event.repeat) actions |= ACTION_MUTE;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const group = keyGroup(event.code);
    if (group && group in held) held[group] = false;
    if (group === 'confirm') spaceHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
    spaceHeld = false;
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.inside = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.inside = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    /** Normalised steering vector from the held movement keys. */
    moveVector() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** True while the mouse button or Space is held (hold to fire). */
    firing() {
      return mouse.down || spaceHeld;
    },
    mouse,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The renderer installs the client-to-logical coordinate mapping once it knows the scale. */
    setMapping(fn) {
      toLogical = fn;
    },
  };
}
