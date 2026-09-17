// Procedural canvas textures: every material in the game is generated at
// runtime so the project ships with no binary assets.
import * as THREE from 'three';
import { fbm, snoise, mulberry32, clamp } from './noise.js';

const cache = new Map();

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(canvas, { repeat = 1, srgb = true, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = anisotropy;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Generic per-pixel generator. fn(u,v) -> [r,g,b] in 0..255 */
function pixelTexture(name, size, fn, opts) {
  const key = `${name}_${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b] = fn(x / size, y / size, x, y);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c, opts);
  cache.set(key, t);
  return t;
}

// Tileable noise helper: sample on a torus so the texture wraps seamlessly.
function tnoise(u, v, scale, oct = 4) {
  const a = u * Math.PI * 2, b = v * Math.PI * 2;
  const x = Math.cos(a) * scale, y = Math.sin(a) * scale;
  const z = Math.cos(b) * scale, w = Math.sin(b) * scale;
  return fbm(x + z * 0.7, y + w * 0.7, oct);
}

export function grassTexture(size = 512) {
  return pixelTexture('grass', size, (u, v) => {
    const n = tnoise(u, v, 6, 5);
    const n2 = tnoise(u + 0.3, v + 0.7, 40, 3);
    const t = clamp(0.5 + n * 0.5 + n2 * 0.25, 0, 1);
    const r = 40 + t * 70 + n2 * 20;
    const g = 80 + t * 90 + n2 * 20;
    const b = 22 + t * 30;
    return [r, g, b];
  }, { repeat: 1 });
}

export function rockTexture(size = 512) {
  return pixelTexture('rock', size, (u, v) => {
    const n = tnoise(u, v, 5, 6);
    const n2 = Math.abs(tnoise(u + 0.5, v, 30, 2));
    const t = clamp(0.55 + n * 0.35 - n2 * 0.4, 0, 1);
    return [70 + t * 110, 62 + t * 95, 55 + t * 80];
  });
}

export function sandTexture(size = 512) {
  return pixelTexture('sand', size, (u, v) => {
    const n = tnoise(u, v, 8, 4);
    const grain = tnoise(u, v, 90, 2);
    const t = clamp(0.6 + n * 0.25 + grain * 0.15, 0, 1);
    return [190 + t * 55, 165 + t * 55, 110 + t * 55];
  });
}

export function snowRockTexture(size = 512) {
  return pixelTexture('snowrock', size, (u, v) => {
    const n = tnoise(u, v, 5, 6);
    const t = clamp(0.7 + n * 0.3, 0, 1);
    return [200 + t * 55, 210 + t * 45, 225 + t * 30];
  });
}

export function barkTexture(size = 256) {
  return pixelTexture('bark', size, (u, v) => {
    const n = tnoise(u * 3, v * 0.5, 8, 5);
    const stripe = Math.sin(u * Math.PI * 24 + n * 4) * 0.5 + 0.5;
    const t = clamp(0.3 + stripe * 0.4 + n * 0.3, 0, 1);
    return [55 + t * 70, 38 + t * 45, 22 + t * 30];
  });
}

export function goldTexture(size = 256) {
  return pixelTexture('gold', size, (u, v) => {
    const n = tnoise(u, v, 12, 4);
    const t = clamp(0.75 + n * 0.25, 0, 1);
    return [220 * t + 20, 175 * t + 15, 60 * t];
  });
}

export function templeStoneTexture(size = 512) {
  return pixelTexture('temple', size, (u, v, x, y) => {
    const bw = size / 4, bh = size / 8;
    const row = Math.floor(y / bh);
    const xo = (row % 2) * bw * 0.5;
    const bx = ((x + xo) % bw) / bw, by = (y % bh) / bh;
    const mortar = (bx < 0.04 || bx > 0.96 || by < 0.06 || by > 0.94) ? 0.55 : 1;
    const n = tnoise(u, v, 20, 3);
    const t = clamp((0.6 + n * 0.3) * mortar, 0, 1);
    return [150 * t + 50, 120 * t + 40, 90 * t + 30];
  });
}

export function silkTexture(size = 256, base = [200, 20, 20]) {
  return pixelTexture(`silk_${base.join('_')}`, size, (u, v) => {
    const weave = (Math.sin(u * Math.PI * 200) * Math.sin(v * Math.PI * 200)) * 0.08;
    const gold = (Math.abs(((v * 8) % 1) - 0.5) < 0.03) ? 1 : 0;
    const n = tnoise(u, v, 6, 3) * 0.08;
    const t = clamp(0.85 + weave + n, 0, 1);
    if (gold) return [235, 200, 90];
    return [base[0] * t, base[1] * t, base[2] * t];
  });
}

export function skinTexture(size = 256, base = [232, 182, 106]) {
  return pixelTexture(`skin_${base.join('_')}`, size, (u, v) => {
    const n = tnoise(u, v, 30, 3) * 0.06;
    const t = clamp(0.94 + n, 0, 1);
    return [base[0] * t, base[1] * t, base[2] * t];
  });
}

/** Normal map from height noise (for water and rock). */
export function normalMapTexture(name, size = 512, scale = 12, strength = 2.0) {
  const key = `nm_${name}_${size}`;
  if (cache.has(key)) return cache.get(key);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    h[y * size + x] = tnoise(x / size, y / size, scale, 5);
  }
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
    const u = h[((y - 1 + size) % size) * size + x], dn = h[((y + 1) % size) * size + x];
    const nx = (l - r) * strength, ny = (u - dn) * strength;
    const len = Math.sqrt(nx * nx + ny * ny + 1);
    const i = (y * size + x) * 4;
    d[i] = (nx / len * 0.5 + 0.5) * 255;
    d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
    d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c, { srgb: false });
  cache.set(key, t);
  return t;
}

/** Peacock tail feather texture with the characteristic eye. */
export function peacockFeatherTexture() {
  if (cache.has('feather')) return cache.get('feather');
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size * 2;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size * 2);
  // barbs
  for (let i = 0; i < 400; i++) {
    const y = (i / 400) * size * 2;
    const w = (size * 0.5) * Math.sin((i / 400) * Math.PI * 0.9 + 0.1);
    ctx.strokeStyle = `hsla(${120 + Math.sin(i * 0.3) * 20}, 70%, ${28 + (i % 7) * 4}%, 0.9)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(size / 2 - w, y + 6);
    ctx.lineTo(size / 2, y);
    ctx.lineTo(size / 2 + w, y + 6);
    ctx.stroke();
  }
  // eye
  const cx = size / 2, cy = size * 0.35;
  const grad = (r, colors) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    colors.forEach((col, i) => g.addColorStop(i / (colors.length - 1), col));
    return g;
  };
  ctx.fillStyle = grad(size * 0.36, ['#b48a1e', '#c99b23', 'rgba(201,155,35,0)']);
  ctx.beginPath(); ctx.ellipse(cx, cy, size * 0.36, size * 0.44, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = grad(size * 0.27, ['#0a7d5a', '#0f9a6e', '#1c5a3a']);
  ctx.beginPath(); ctx.ellipse(cx, cy, size * 0.27, size * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = grad(size * 0.17, ['#1e3fb5', '#10258f', '#0a1660']);
  ctx.beginPath(); ctx.ellipse(cx, cy + size * 0.02, size * 0.17, size * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(cx - size * 0.05, cy - size * 0.06, size * 0.05, size * 0.04, -0.6, 0, Math.PI * 2); ctx.fill();
  // stem
  ctx.strokeStyle = '#e6d18a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy + size * 0.2); ctx.lineTo(cx, size * 2); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set('feather', t);
  return t;
}

/** Soft radial glow sprite. */
export function glowSprite(color = '#ffd27a') {
  const key = `glow_${color}`;
  if (cache.has(key)) return cache.get(key);
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Star field for night skies. */
export function starTexture(size = 1024) {
  if (cache.has('stars')) return cache.get('stars');
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(99);
  for (let i = 0; i < 2500; i++) {
    const x = rnd() * size, y = rnd() * size, r = rnd() * 1.4 + 0.2;
    const a = 0.4 + rnd() * 0.6;
    ctx.fillStyle = `rgba(${220 + rnd() * 35},${220 + rnd() * 35},255,${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set('stars', t);
  return t;
}

export function lotusPetalTexture() {
  return pixelTexture('lotus', 128, (u, v) => {
    const t = clamp(v * 1.2, 0, 1);
    return [255, 150 + (1 - t) * 90, 180 + (1 - t) * 70];
  });
}

export function leafTexture() {
  return pixelTexture('leaf', 128, (u, v) => {
    const n = snoise(u * 10, v * 10) * 0.15;
    const vein = Math.abs(u - 0.5) < 0.02 ? 0.7 : 1;
    const t = clamp((0.7 + n) * vein, 0, 1);
    return [40 * t + 20, 120 * t + 30, 30 * t + 10];
  });
}
