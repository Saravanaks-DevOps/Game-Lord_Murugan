// Sculpted procedural heads with facial anatomy: skull shaping, brow ridge,
// cheekbones, jaw and chin, eye sockets with eyeballs/iris/eyelids/brows,
// nose with nostrils, lips, ears, hair. Skin uses a pore texture and a
// subsurface-style physical material.
import * as THREE from 'three';
import { fbm, clamp, smoothstep, lerp, mulberry32 } from '../engine/noise.js';

const texCache = new Map();

/** Skin texture on sphere UVs: pores, tone variation, blush on cheeks and lips. */
export function faceSkinTexture(rgb, { blush = 0.25, size = 512 } = {}) {
  const key = `face_${rgb.join('_')}_${blush}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const pores = fbm(u * 180, v * 180, 2) * 0.05;
    const tone = fbm(u * 9 + 3, v * 9, 3) * 0.06;
    // cheeks sit at u ≈ 0.25 ± 0.1 (front of the sphere), v ≈ 0.55
    const cheek = Math.exp(-(((u - 0.19) ** 2) / 0.004 + ((v - 0.56) ** 2) / 0.006)) + Math.exp(-(((u - 0.31) ** 2) / 0.004 + ((v - 0.56) ** 2) / 0.006));
    const lips = Math.exp(-(((u - 0.25) ** 2) / 0.0012 + ((v - 0.7) ** 2) / 0.0006));
    const t = 1 + pores + tone;
    const r = clamp(rgb[0] * t + cheek * blush * 55 + lips * 60, 0, 255);
    const g = clamp(rgb[1] * t - cheek * blush * 15 - lips * 35, 0, 255);
    const b = clamp(rgb[2] * t - cheek * blush * 10 - lips * 30, 0, 255);
    const i = (y * size + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  texCache.set(key, tex); return tex;
}

export function irisTexture(color = '#4a2a12') {
  const key = `iris_${color}`;
  if (texCache.has(key)) return texCache.get(key);
  const size = 256; const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6f3ee'; ctx.fillRect(0, 0, size, size);
  // faint veins
  ctx.strokeStyle = 'rgba(200,60,60,0.12)'; ctx.lineWidth = 1;
  const rnd = mulberry32(5);
  for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.moveTo(rnd() * size, rnd() * size); ctx.lineTo(rnd() * size, rnd() * size); ctx.stroke(); }
  // iris centred at the front UV (u=0.25, v=0.5) → x = 64, y = 128
  // sphere UVs stretch u 2:1 relative to v, so draw the iris as a 1:2 ellipse
  const cx = size * 0.25, cy = size * 0.5, R = size * 0.23;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(0.5, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, '#050302'); g.addColorStop(0.3, '#050302'); g.addColorStop(0.34, color); g.addColorStop(0.78, color); g.addColorStop(0.95, '#1a0e06'); g.addColorStop(1, 'rgba(26,14,6,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,160,0.2)';
  for (let i = 0; i < 70; i++) { const a = (i / 70) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42); ctx.lineTo(Math.cos(a + 0.05) * R * 0.92, Math.sin(a + 0.05) * R * 0.92); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.32, R * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex); return tex;
}

export function skinMaterial(rgb, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    map: faceSkinTexture(rgb, opts), roughness: 0.58, metalness: 0,
    sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffc9a0),
    clearcoat: 0.03, clearcoatRoughness: 0.7, specularIntensity: 0.45,
  });
}

/** Deform a unit sphere into a head. All factors in "head units" (radius 1). */
function sculptSkull(geo, o) {
  const p = geo.attributes.position;
  const f = o.female ? 1 : 0, a = o.asura ? 1 : 0;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const front = smoothstep(0, 0.6, z);
    // skull proportions: taller, slightly narrower, cranium back
    x *= 0.94 + a * 0.08; y *= 1.0; z *= z < 0 ? 1.06 : 1.0;
    // jaw narrows toward the chin, more for female
    const jaw = smoothstep(-0.15, -0.95, y);
    x *= 1 - jaw * (0.24 + f * 0.06 - a * 0.1);
    z *= 1 - jaw * 0.08;
    // chin forward
    z += smoothstep(-0.55, -0.95, y) * front * 0.06;
    // forehead slopes back
    z -= smoothstep(0.45, 0.95, y) * front * 0.12;
    // brow ridge
    const brow = Math.exp(-((y - 0.33) ** 2) / 0.012) * front;
    z += brow * (0.05 + a * 0.06) * (1 - f * 0.5);
    // eye sockets
    for (const s of [-1, 1]) {
      const dx = x - s * 0.40, dy = y - 0.20, dz = z - 0.86;
      const e = Math.exp(-(dx * dx / 0.05 + dy * dy / 0.02 + dz * dz / 0.1));
      z -= e * 0.13; y -= e * 0.01;
    }
    // cheekbones
    for (const s of [-1, 1]) {
      const dx = x - s * 0.66, dy = y - 0.0, dz = z - 0.55;
      const e = Math.exp(-(dx * dx / 0.06 + dy * dy / 0.05 + dz * dz / 0.12));
      x += s * e * (0.05 + a * 0.05); z += e * 0.05;
    }
    // temples slightly in
    for (const s of [-1, 1]) { const e = Math.exp(-(((x - s * 0.9) ** 2) / 0.08 + ((y - 0.35) ** 2) / 0.08 + ((z - 0.3) ** 2) / 0.2)); x -= s * e * 0.05; }
    // philtrum / mouth region flatter, lips region slightly forward
    const mouth = Math.exp(-((y + 0.42) ** 2) / 0.01) * front * (1 - smoothstep(0.35, 0.6, Math.abs(x)));
    z += mouth * 0.02;
    // nose bridge (nose itself is a separate mesh)
    const bridge = Math.exp(-(x * x / 0.012 + (y - 0.05) ** 2 / 0.08)) * front;
    z += bridge * 0.06;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
}

function noseGeometry(o) {
  // lathe-ish nose: profile from bridge to tip, then scaled asymmetrically
  const g = new THREE.SphereGeometry(1, 16, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + 1) / 2; // 0 bottom, 1 top
    x *= lerp(0.55, 0.22, t) * (o.female ? 0.9 : 1) * (o.asura ? 1.4 : 1);
    z *= lerp(0.55, 0.28, t);
    if (z > 0) z *= 1.15;
    y *= 1.0;
    // nostril flare at the bottom sides
    if (t < 0.3 && Math.abs(x) > 0.2) { x *= 1.25; y -= 0.05; }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function lipGeometry(upper, o) {
  const g = new THREE.TorusGeometry(0.19, upper ? 0.045 : 0.06, 10, 24, Math.PI);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // flatten into a curved lip following the face
    z += Math.abs(x) * -0.35; // wrap around the face curvature
    y *= 0.55; if (upper) { y += Math.exp(-(x * x) / 0.006) * -0.02; } // cupid's bow
    if (o.female) { y *= 1.15; }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function earGeometry() {
  const g = new THREE.SphereGeometry(1, 12, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 0.25; y *= 1.0; z *= 0.6;
    if (y < -0.4) { z *= 0.6; } // lobe
    if (x > 0) { x *= 0.5; } // inner side flat
    // concha depression on the outer face
    const e = Math.exp(-((y + 0.1) ** 2) / 0.15 - (z ** 2) / 0.1);
    if (x < 0) x += e * 0.1;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Builds a head. R = head radius in scene units. Returns { group, eyes: [L,R] }.
 * opts: skin rgb, female, asura, beard, moustache, tilak ('vibhuti'|'kumkum'|'none'),
 * thirdEye, tusks, horns, hair ('tied'|'long'|'jata'|'wild'|'none'), irisColor.
 */
export function createHead(R, o = {}) {
  const O = Object.assign({ skin: [232, 182, 106], female: false, asura: false, beard: false, moustache: false, tilak: 'none', thirdEye: false, tusks: false, horns: false, hair: 'tied', irisColor: '#4a2a12', eyeGold: false, smooth: false }, o);
  const g = new THREE.Group();
  const skin = skinMaterial(O.skin, { blush: O.female ? 0.35 : 0.2 });
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x0f0906, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0x5a4030), sheenRoughness: 0.35, clearcoat: 0.3 });
  const add = (geo, mat, pos = [0, 0, 0], scale = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  // skull
  const hairFor = () => {
  // hair
    const hairShell = () => {
      const geo = new THREE.SphereGeometry(1, 72, 54); sculptSkull(geo, O);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        // hairline: high on the forehead, lower at the temples, down to the nape at the back
        const front = smoothstep(-0.2, 0.75, z);
        let line = lerp(-0.25, 0.62, front) + (O.female ? 0.02 : 0);
        line += Math.exp(-((Math.abs(x) - 0.75) ** 2) / 0.03) * smoothstep(0.2, 0.6, z) * -0.3; // sideburns
        if (y > line) { p.setXYZ(i, x * 1.045, y * 1.045 + 0.015, z * 1.045); }
        else { const k = 0.985; p.setXYZ(i, x * k, y * k, z * k); }
      }
      geo.computeVertexNormals();
      return add(geo, hairMat, [0, 0, 0], R);
    };
    if (O.hair === 'tied' || O.hair === 'jata') {
      hairShell();
      if (O.hair === 'jata') { add(new THREE.ConeGeometry(0.55 * R, 1.3 * R, 12), hairMat, [0, 1.35 * R, -0.05 * R]); for (let i = 0; i < 5; i++) add(new THREE.TorusGeometry(0.3 * R, 0.05 * R, 6, 16), hairMat, [0, (0.95 + i * 0.22) * R, -0.05 * R]).rotation.x = Math.PI / 2; }
      else { add(new THREE.SphereGeometry(0.34 * R, 16, 12), hairMat, [0, 1.05 * R, -0.25 * R]); add(new THREE.TorusGeometry(0.34 * R, 0.04 * R, 6, 20), new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 1, roughness: 0.3 }), [0, 1.0 * R, -0.25 * R]).rotation.x = 0.3; }
    } else if (O.hair === 'long') {
      hairShell();
      const fall = add(new THREE.CapsuleGeometry(0.42 * R, 1.6 * R, 6, 16), hairMat, [0, -0.9 * R, -0.6 * R]); fall.scale.set(0.8, 1, 0.5);
      // centre parting + hairline
      add(new THREE.SphereGeometry(0.34 * R, 16, 12), hairMat, [0, 0.95 * R, -0.35 * R]);
    } else if (O.hair === 'wild') {
      hairShell();
      const rnd = mulberry32(3);
      for (let i = 0; i < 12; i++) { const a = rnd() * Math.PI * 2; const sp = add(new THREE.ConeGeometry(0.16 * R, 1.0 * R, 6), hairMat, [Math.cos(a) * 0.45 * R, 0.85 * R, Math.sin(a) * 0.45 * R - 0.1 * R]); sp.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
    }
  };
  const skull = new THREE.SphereGeometry(1, 64, 48);
  sculptSkull(skull, O);
  add(skull, skin, [0, 0, 0], R);

  // neck blend
  add(new THREE.CylinderGeometry(0.5 * R, 0.56 * R, 0.4 * R, 18), skin, [0, -0.88 * R, -0.05 * R]);

  const eyes = [];
  if (O.smooth) { hairFor(); return { group: g, eyes, skin }; }
  // nose
  add(noseGeometry(O), skin, [0, -0.1 * R, 0.84 * R], [0.34 * R, 0.4 * R, 0.42 * R]);

  // eyes
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: irisTexture(O.eyeGold ? '#b8862a' : O.irisColor), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  for (const s of [-1, 1]) {
    const socket = new THREE.Group(); socket.position.set(s * 0.40 * R, 0.19 * R, 0.78 * R); g.add(socket);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14 * R, 24, 18), eyeMat); eye.rotation.y = -Math.PI / 2 + Math.PI / 2; socket.add(eye);
    eye.rotation.y = 0; // iris texture sits at u=0.25 → +z, facing forward
    eyes.push(eye);
    // eyelids: skin caps over the eyeball, upper thicker
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.152 * R, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), skin); upper.rotation.x = -0.2; socket.add(upper);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.15 * R, 24, 12, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.32), skin); lower.rotation.x = 0.15; socket.add(lower);
    // lash line
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.15 * R, 0.008 * R, 6, 24, Math.PI * 0.9), hairMat); lash.rotation.set(-0.5, 0, 0.16); lash.position.z = 0.01 * R; socket.add(lash);
    // kohl / liner for female
    if (O.female) { const liner = new THREE.Mesh(new THREE.TorusGeometry(0.152 * R, 0.012 * R, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x050303 })); liner.rotation.set(-0.35, 0, 0.16); socket.add(liner); }
    // eyebrow
    const browCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.17 * R, 0.33 * R, 0.88 * R), new THREE.Vector3(s * 0.4 * R, 0.39 * R, 0.85 * R), new THREE.Vector3(s * 0.62 * R, 0.34 * R, 0.68 * R)]);
    const brow = new THREE.Mesh(new THREE.TubeGeometry(browCurve, 12, (O.asura ? 0.055 : O.female ? 0.03 : 0.04) * R, 8), hairMat); brow.scale.y = 0.55; g.add(brow);
  }

  // lips
  const lipMat = skinMaterial([O.skin[0] * 0.85, O.skin[1] * 0.55, O.skin[2] * 0.55], { blush: 0 });
  add(lipGeometry(true, O), lipMat, [0, -0.40 * R, 0.86 * R], R).rotation.set(Math.PI, 0, 0);
  add(lipGeometry(false, O), lipMat, [0, -0.47 * R, 0.85 * R], R).rotation.set(0, 0, 0);

  // ears
  for (const s of [-1, 1]) { const ear = add(earGeometry(), skin, [s * 0.92 * R, 0.05 * R, -0.05 * R], [0.28 * R, 0.3 * R, 0.28 * R]); ear.rotation.y = s * 0.25; if (s > 0) ear.rotation.y += Math.PI; }

  // facial hair
  if (O.beard) { const b = add(new THREE.SphereGeometry(0.62 * R, 20, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.45), new THREE.MeshStandardMaterial({ color: O.asura ? 0x120a06 : 0xe6e0d4, roughness: 0.9 }), [0, -0.28 * R, 0.25 * R]); b.scale.set(0.95, 1.1, 0.9); }
  if (O.moustache) { const m = add(new THREE.TorusGeometry(0.2 * R, 0.035 * R, 8, 20, Math.PI), hairMat, [0, -0.33 * R, 0.9 * R]); m.rotation.set(Math.PI, 0, 0); m.scale.set(1, 0.6, 0.7); }

  // forehead marks
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.9 });
  if (O.tilak === 'vibhuti') for (let i = 0; i < 3; i++) { const l = add(new THREE.BoxGeometry(0.42 * R, 0.035 * R, 0.02 * R), white, [0, (0.5 + i * 0.075) * R, 0.86 * R]); l.rotation.x = -0.25; }
  if (O.tilak !== 'none') add(new THREE.SphereGeometry(0.04 * R, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd11f1f, emissive: 0x400000 }), [0, 0.48 * R, 0.9 * R], [1, 1.3, 0.5]);
  if (O.thirdEye) add(new THREE.SphereGeometry(0.06 * R, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff1a0, emissive: 0xff8000, emissiveIntensity: 1.5 }), [0, 0.55 * R, 0.85 * R], [1, 1.8, 0.4]);
  if (O.tusks) for (const s of [-1, 1]) { const t = add(new THREE.ConeGeometry(0.05 * R, 0.25 * R, 8), white, [s * 0.16 * R, -0.36 * R, 0.86 * R]); t.rotation.x = -0.3; }
  if (O.horns) for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.09 * R, 0.7 * R, 8), new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.5 }), [s * 0.5 * R, 0.85 * R, 0]); h.rotation.z = s * -0.55; }

  hairFor();
  // ear jewels
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffd36b, metalness: 1, roughness: 0.25, clearcoat: 0.6 });
  for (const s of [-1, 1]) { add(new THREE.TorusGeometry(0.09 * R, 0.02 * R, 8, 16), gold, [s * 0.88 * R, -0.22 * R, -0.05 * R]); if (O.female) add(new THREE.SphereGeometry(0.05 * R, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xff2050, emissive: 0x500010, roughness: 0.1 }), [s * 0.88 * R, -0.36 * R, -0.05 * R]); }

  return { group: g, eyes, skin };
}
