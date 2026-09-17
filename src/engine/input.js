// Keyboard, mouse and touch input. Camera look is mouse-drag or touch-drag on
// the right half of the screen; the left half acts as a virtual joystick.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();      // keys pressed this frame
    this.lookDX = 0; this.lookDY = 0;
    this.joy = { x: 0, y: 0, active: false };
    this.fire = false;             // fire pressed this frame
    this.dragging = false;
    this.locked = false;
    this.enabled = true;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k); this.pressed.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) { this.dragging = true; this._dragMoved = 0; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        if (this.dragging && this._dragMoved < 6 && this.enabled) this.fire = true;
        this.dragging = false;
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging || this.locked) {
        this.lookDX += e.movementX; this.lookDY += e.movementY;
        this._dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // touch: left half = joystick, right half = look
    this._touches = new Map();
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const side = t.clientX < window.innerWidth / 2 ? 'joy' : 'look';
        this._touches.set(t.identifier, { side, sx: t.clientX, sy: t.clientY, lx: t.clientX, ly: t.clientY, moved: 0 });
        if (side === 'joy') this.joy.active = true;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const s = this._touches.get(t.identifier); if (!s) continue;
        if (s.side === 'joy') {
          const dx = t.clientX - s.sx, dy = t.clientY - s.sy;
          const len = Math.hypot(dx, dy) || 1, r = Math.min(len, 60) / 60;
          this.joy.x = dx / len * r; this.joy.y = dy / len * r;
        } else {
          this.lookDX += (t.clientX - s.lx) * 2; this.lookDY += (t.clientY - s.ly) * 2;
          s.moved += Math.abs(t.clientX - s.lx) + Math.abs(t.clientY - s.ly);
          s.lx = t.clientX; s.ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        const s = this._touches.get(t.identifier); if (!s) continue;
        if (s.side === 'joy') { this.joy.active = false; this.joy.x = this.joy.y = 0; }
        else if (s.moved < 8) this.fire = true;
        this._touches.delete(t.identifier);
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  down(code) { return this.enabled && this.keys.has(code); }
  justPressed(code) { return this.enabled && this.pressed.has(code); }

  /** Movement axis: x = strafe (-1..1), y = forward (-1..1). */
  axis() {
    let x = 0, y = 0;
    if (this.enabled) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.joy.active) { x += this.joy.x; y -= this.joy.y; }
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  consumeLook() {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return r;
  }

  /** Call at end of frame. */
  flush() {
    this.pressed.clear();
    this.fire = false;
  }
}
