// World builders: physically-based sky, sun/moon lighting, fog, terrain from
// simplex noise with slope-based texturing, reflective water, vegetation.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { fbm, ridged, smoothstep, clamp, mulberry32, lerp } from '../engine/noise.js';
import * as TX from '../engine/textures.js';

/* ------------------------------------------------------------------ sky */
export function createSky(scene, renderer, { elevation = 25, azimuth = 160, turbidity = 6, rayleigh = 2, mie = 0.005, mieG = 0.8, exposure = 1.0, night = false } = {}) {
  const sky = new Sky();
  sky.scale.setScalar(4500);
  scene.add(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = turbidity;
  u.rayleigh.value = night ? 0.2 : rayleigh;
  u.mieCoefficient.value = mie;
  u.mieDirectionalG.value = mieG;
  const sun = new THREE.Vector3();
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sun);
  renderer.toneMappingExposure = exposure;
  // image-based lighting: prefilter the sky itself so gold, silk and water reflect it
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene(); envScene.add(sky);
    const rt = pmrem.fromScene(envScene, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = night ? 0.35 : 0.6;
    envScene.remove(sky); scene.add(sky);
    pmrem.dispose();
  } catch (e) { console.warn('env map failed', e); }

  let stars = null;
  if (night) {
    const geo = new THREE.SphereGeometry(4000, 32, 16);
    const mat = new THREE.MeshBasicMaterial({ map: TX.starTexture(), side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    mat.map.repeat.set(4, 2);
    stars = new THREE.Mesh(geo, mat);
    stars.renderOrder = -1;
    scene.add(stars);
  }
  return { sky, sun, stars };
}

/* ------------------------------------------------------------- lighting */
export function createLighting(scene, sunDir, { intensity = 3.2, color = 0xfff1d6, ambient = 0.35, skyColor = 0x9ec5ff, groundColor = 0x5a4a2a, shadowSize = 4096, shadowExtent = 120 } = {}) {
  const hemi = new THREE.HemisphereLight(skyColor, groundColor, ambient);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(color, intensity);
  dir.position.copy(sunDir).multiplyScalar(300);
  dir.castShadow = true;
  dir.shadow.mapSize.set(shadowSize, shadowSize);
  dir.shadow.camera.near = 10; dir.shadow.camera.far = 900;
  dir.shadow.camera.left = -shadowExtent; dir.shadow.camera.right = shadowExtent;
  dir.shadow.camera.top = shadowExtent; dir.shadow.camera.bottom = -shadowExtent;
  dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.03;
  dir.shadow.radius = 3;
  scene.add(dir); scene.add(dir.target);
  return { hemi, dir, follow(target) { dir.position.copy(target).add(sunDir.clone().multiplyScalar(300)); dir.target.position.copy(target); } };
}

/* -------------------------------------------------------------- terrain */
/**
 * Height field terrain. `profile` returns height for world x,z. Returns mesh and
 * a heightAt(x,z) sampler used by the player controller and object placement.
 */
export function createTerrain({ size = 400, segments = 256, profile, colorFn, textures, uvRepeat = 40 }) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = profile(x, z);
    pos.setY(i, h);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const slope = 1 - nrm.getY(i);
    const c = colorFn(x, z, y, slope);
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 });
  if (textures?.map) { mat.map = textures.map; mat.map.repeat.set(uvRepeat, uvRepeat); }
  if (textures?.normalMap) { mat.normalMap = textures.normalMap; mat.normalMap.repeat.set(uvRepeat, uvRepeat); mat.normalScale.set(0.3, 0.3); }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.castShadow = false;
  const heightAt = (x, z) => profile(x, z);
  const normalAt = (x, z) => {
    const e = 0.5;
    const hl = profile(x - e, z), hr = profile(x + e, z), hd = profile(x, z - e), hu = profile(x, z + e);
    return new THREE.Vector3(hl - hr, 2 * e, hd - hu).normalize();
  };
  return { mesh, heightAt, normalAt, size };
}

/** Standard colouring by height/slope: grass, dirt, rock, snow. */
export function biomeColor(palette) {
  const P = Object.assign({
    grass: [0.24, 0.42, 0.13], grass2: [0.42, 0.52, 0.18], dirt: [0.42, 0.32, 0.18], rock: [0.42, 0.4, 0.38],
    snow: [0.92, 0.94, 0.98], sand: [0.78, 0.7, 0.5], snowLine: 1e9, sandLine: -1e9,
  }, palette);
  const c = new THREE.Color();
  return (x, z, y, slope) => {
    const n = fbm(x * 0.05, z * 0.05, 3) * 0.5 + 0.5;
    let r, g, b;
    [r, g, b] = P.grass.map((v, i) => lerp(v, P.grass2[i], n));
    const dirtT = smoothstep(0.12, 0.3, slope);
    [r, g, b] = [lerp(r, P.dirt[0], dirtT), lerp(g, P.dirt[1], dirtT), lerp(b, P.dirt[2], dirtT)];
    const rockT = smoothstep(0.3, 0.55, slope);
    [r, g, b] = [lerp(r, P.rock[0], rockT), lerp(g, P.rock[1], rockT), lerp(b, P.rock[2], rockT)];
    const sandT = smoothstep(P.sandLine + 1.5, P.sandLine - 1, y);
    [r, g, b] = [lerp(r, P.sand[0], sandT), lerp(g, P.sand[1], sandT), lerp(b, P.sand[2], sandT)];
    const snowT = smoothstep(P.snowLine, P.snowLine + 6, y) * (1 - smoothstep(0.5, 0.8, slope));
    [r, g, b] = [lerp(r, P.snow[0], snowT), lerp(g, P.snow[1], snowT), lerp(b, P.snow[2], snowT)];
    c.setRGB(r, g, b);
    return [c.r, c.g, c.b];
  };
}

/* ---------------------------------------------------------------- water */
export function createWater(scene, sunDir, { size = 2000, level = 0, color = 0x0b3d5c, distortion = 3.0, resolution = 512, fog = true } = {}) {
  const geo = new THREE.PlaneGeometry(size, size);
  const water = new Water(geo, {
    textureWidth: resolution, textureHeight: resolution,
    waterNormals: TX.normalMapTexture('water', 512, 20, 3.5),
    sunDirection: sunDir.clone().normalize(),
    sunColor: 0xffffff, waterColor: color,
    distortionScale: distortion, fog,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = level;
  scene.add(water);
  return { mesh: water, update(dt) { water.material.uniforms.time.value += dt * 0.6; } };
}

/* ----------------------------------------------------------- vegetation */
function canopyGeometry(kind, rnd) {
  if (kind === 'palm') return null;
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + fbm(x * 2 + rnd * 10, z * 2 + y, 3) * 0.35;
    p.setXYZ(i, x * n, y * n * 0.85, z * n);
  }
  g.computeVertexNormals();
  return g;
}

/** Instanced forest. kinds: 'broadleaf' | 'palm' | 'pine' | 'mango' */
export function createForest(scene, heightAt, { count = 300, area = 180, kind = 'broadleaf', seed = 7, exclude = () => false, minH = -1e9, maxH = 1e9, scale = 1, center = [0, 0] } = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({ map: TX.barkTexture(), roughness: 0.9, color: kind === 'palm' ? 0xa08a60 : 0xffffff });
  const leafColor = { broadleaf: 0x2f6b1f, mango: 0x1f5a1a, pine: 0x1f4a2a, palm: 0x3a8a2a }[kind];
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.85, flatShading: kind !== 'palm' });

  const placements = [];
  let tries = 0;
  while (placements.length < count && tries++ < count * 20) {
    const x = center[0] + (rnd() - 0.5) * area * 2, z = center[1] + (rnd() - 0.5) * area * 2;
    const y = heightAt(x, z);
    if (y < minH || y > maxH || exclude(x, z, y)) continue;
    placements.push({ x, y, z, s: (0.7 + rnd() * 0.6) * scale, r: rnd() * Math.PI * 2 });
  }
  if (!placements.length) return group;

  const dummy = new THREE.Object3D();
  if (kind === 'palm') {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 7, 8, 6);
    // bend the trunk
    const p = trunkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 3.5) / 7; p.setX(i, p.getX(i) + t * t * 1.4); }
    trunkGeo.translate(0, 3.5, 0);
    const trunk = new THREE.InstancedMesh(trunkGeo, barkMat, placements.length);
    const frondGeo = new THREE.PlaneGeometry(0.9, 4.5, 1, 6);
    const fp = frondGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) { const t = (fp.getY(i) + 2.25) / 4.5; fp.setZ(i, -t * t * 2.2); fp.setX(i, fp.getX(i) * (1 - t * 0.7)); }
    frondGeo.translate(0, 2.25, 0);
    const frondMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8, side: THREE.DoubleSide, map: TX.leafTexture() });
    const frondsPer = 9;
    const fronds = new THREE.InstancedMesh(frondGeo, frondMat, placements.length * frondsPer);
    placements.forEach((pl, i) => {
      dummy.position.set(pl.x, pl.y, pl.z); dummy.rotation.set(0, pl.r, 0); dummy.scale.setScalar(pl.s);
      dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
      for (let f = 0; f < frondsPer; f++) {
        const top = new THREE.Object3D();
        top.position.set(pl.x + Math.cos(pl.r) * 1.4 * pl.s * 0, pl.y + 7 * pl.s, pl.z);
        // trunk top offset from bend
        const off = new THREE.Vector3(1.4 * pl.s, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), pl.r);
        top.position.add(off);
        top.rotation.set(0.9 + (f % 3) * 0.25, (f / frondsPer) * Math.PI * 2 + pl.r, 0, 'YXZ');
        top.scale.setScalar(pl.s);
        top.updateMatrix(); fronds.setMatrixAt(i * frondsPer + f, top.matrix);
      }
    });
    trunk.castShadow = true; trunk.receiveShadow = true; fronds.castShadow = true;
    group.add(trunk, fronds);
  } else if (kind === 'pine') {
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.35, 5, 7); trunkGeo.translate(0, 2.5, 0);
    const trunk = new THREE.InstancedMesh(trunkGeo, barkMat, placements.length);
    const coneGeo = new THREE.ConeGeometry(1.6, 4, 8); coneGeo.translate(0, 4.5, 0);
    const cone2 = new THREE.ConeGeometry(1.2, 3.2, 8); cone2.translate(0, 6.6, 0);
    const cone3 = new THREE.ConeGeometry(0.8, 2.4, 8); cone3.translate(0, 8.4, 0);
    const c1 = new THREE.InstancedMesh(coneGeo, leafMat, placements.length);
    const c2 = new THREE.InstancedMesh(cone2, leafMat, placements.length);
    const c3 = new THREE.InstancedMesh(cone3, leafMat, placements.length);
    placements.forEach((pl, i) => {
      dummy.position.set(pl.x, pl.y - 0.2, pl.z); dummy.rotation.set(0, pl.r, 0); dummy.scale.setScalar(pl.s);
      dummy.updateMatrix(); [trunk, c1, c2, c3].forEach((m) => m.setMatrixAt(i, dummy.matrix));
    });
    [trunk, c1, c2, c3].forEach((m) => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
  } else {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.45, 4.5, 8); trunkGeo.translate(0, 2.2, 0);
    const trunk = new THREE.InstancedMesh(trunkGeo, barkMat, placements.length);
    const canopies = [canopyGeometry(kind, 0.1), canopyGeometry(kind, 0.5), canopyGeometry(kind, 0.9)];
    const meshes = canopies.map(() => new THREE.InstancedMesh(canopies[0], leafMat, placements.length));
    canopies.forEach((g, k) => { meshes[k].geometry = g; });
    placements.forEach((pl, i) => {
      dummy.position.set(pl.x, pl.y - 0.2, pl.z); dummy.rotation.set(0, pl.r, 0); dummy.scale.setScalar(pl.s);
      dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
      canopies.forEach((g, k) => {
        const off = [[0, 5.2, 0, 2.6], [1.3, 4.4, 0.6, 1.9], [-1.1, 4.6, -0.8, 1.8]][k];
        dummy.position.set(pl.x + off[0] * pl.s, pl.y + off[1] * pl.s, pl.z + off[2] * pl.s);
        dummy.scale.setScalar(off[3] * pl.s * (kind === 'mango' ? 1.25 : 1));
        dummy.updateMatrix(); meshes[k].setMatrixAt(i, dummy.matrix);
      });
    });
    trunk.castShadow = true; trunk.receiveShadow = true; group.add(trunk);
    meshes.forEach((m) => { m.castShadow = true; m.receiveShadow = true; group.add(m); });
  }
  scene.add(group);
  return group;
}

/** Wind-swaying grass blades via instanced planes + vertex shader offset. */
export function createGrass(scene, heightAt, { count = 30000, area = 120, seed = 3, exclude = () => false, minH = -1e9, maxH = 1e9, color = 0x4e8a2a, center = [0, 0] } = {}) {
  const rnd = mulberry32(seed);
  const geo = new THREE.PlaneGeometry(0.12, 0.9, 1, 3);
  geo.translate(0, 0.45, 0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        float sway = sin(uTime * 1.6 + wp.x * 0.35 + wp.z * 0.27) * 0.18 * position.y;
        transformed.x += sway; transformed.z += sway * 0.5;`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  let n = 0, tries = 0;
  while (n < count && tries++ < count * 4) {
    const x = center[0] + (rnd() - 0.5) * area * 2, z = center[1] + (rnd() - 0.5) * area * 2;
    const y = heightAt(x, z);
    if (y < minH || y > maxH || exclude(x, z, y)) continue;
    dummy.position.set(x, y - 0.05, z); dummy.rotation.set(0, rnd() * Math.PI, 0);
    dummy.scale.set(1, 0.6 + rnd() * 0.9, 1); dummy.updateMatrix(); mesh.setMatrixAt(n++, dummy.matrix);
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { mesh, update(t) { if (mat.userData.shader) mat.userData.shader.uniforms.uTime.value = t; } };
}

export function createRocks(scene, heightAt, { count = 60, area = 150, seed = 11, exclude = () => false, minH = -1e9, maxH = 1e9, scale = 1, center = [0, 0] } = {}) {
  const rnd = mulberry32(seed);
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const s = 1 + (rnd() - 0.5) * 0.5; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.7, p.getZ(i) * s); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: TX.rockTexture(), roughness: 0.95, color: 0xbbb5a8, normalMap: TX.normalMapTexture('rock', 256, 8, 2), flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  let n = 0, tries = 0;
  while (n < count && tries++ < count * 10) {
    const x = center[0] + (rnd() - 0.5) * area * 2, z = center[1] + (rnd() - 0.5) * area * 2;
    const y = heightAt(x, z);
    if (y < minH || y > maxH || exclude(x, z, y)) continue;
    const s = (0.5 + rnd() * 2.2) * scale;
    dummy.position.set(x, y - s * 0.25, z); dummy.rotation.set(rnd(), rnd() * 6, rnd()); dummy.scale.setScalar(s);
    dummy.updateMatrix(); mesh.setMatrixAt(n++, dummy.matrix);
  }
  mesh.count = n; mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function createFlowers(scene, heightAt, { count = 800, area = 60, seed = 5, exclude = () => false, minH = -1e9, maxH = 1e9, center = [0, 0], colors = [0xff3b6b, 0xffb020, 0xffffff, 0xff6a00] } = {}) {
  const rnd = mulberry32(seed);
  const geo = new THREE.SphereGeometry(0.12, 6, 5);
  const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4); stemGeo.translate(0, 0.25, 0);
  const stem = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: 0x3f7a22 }), count);
  const heads = colors.map(() => new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x000000 }), count));
  heads.forEach((h, i) => { h.material.color.set(colors[i]); h.material.emissive.set(colors[i]); h.material.emissiveIntensity = 0.15; });
  const counts = colors.map(() => 0);
  const dummy = new THREE.Object3D();
  let n = 0, tries = 0;
  while (n < count && tries++ < count * 4) {
    const x = center[0] + (rnd() - 0.5) * area * 2, z = center[1] + (rnd() - 0.5) * area * 2;
    const y = heightAt(x, z);
    if (y < minH || y > maxH || exclude(x, z, y)) continue;
    dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); stem.setMatrixAt(n, dummy.matrix);
    const k = Math.floor(rnd() * colors.length);
    dummy.position.y = y + 0.5; dummy.updateMatrix(); heads[k].setMatrixAt(counts[k]++, dummy.matrix);
    n++;
  }
  stem.count = n; heads.forEach((h, i) => { h.count = counts[i]; });
  const g = new THREE.Group(); g.add(stem, ...heads); scene.add(g);
  return g;
}

/* ------------------------------------------------------------ particles */
/** Floating glowing motes (fireflies, embers, pollen). */
export function createMotes(scene, { count = 300, area = 80, height = [0.5, 8], color = '#ffd27a', size = 1.2, center = [0, 0, 0], speed = 0.4 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (Math.random() - 0.5) * area * 2;
    pos[i * 3 + 1] = center[1] + height[0] + Math.random() * (height[1] - height[0]);
    pos[i * 3 + 2] = center[2] + (Math.random() - 0.5) * area * 2;
    seeds[i] = Math.random() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.PointsMaterial({ map: TX.glowSprite(color), size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, color: 0xffffff, opacity: 0.9 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  const base = pos.slice();
  return {
    points: pts,
    update(t) {
      const p = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        p[i * 3] = base[i * 3] + Math.sin(t * speed + s) * 1.5;
        p[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * speed * 0.7 + s * 1.3) * 0.8;
        p[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * speed * 0.9 + s * 0.7) * 1.5;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 0.6 + Math.sin(t * 2) * 0.25;
    },
  };
}

/** Burst of sparks, used for hits and divine events. */
export class Bursts {
  constructor(scene, max = 2000) {
    this.max = max;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ map: TX.glowSprite('#ffe9a0'), size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.head = 0;
    this.geo = geo;
  }
  emit(p, n = 40, speed = 6, color = null) {
    if (color) this.mat.map = TX.glowSprite(color);
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % this.max;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1), s = speed * (0.3 + Math.random());
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * s; this.vel[i * 3 + 1] = Math.cos(ph) * s + speed * 0.4; this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      this.life[i] = 0.8 + Math.random() * 0.8;
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -9999; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

/* ------------------------------------------------------------ structures */
/** South-Indian temple: sanctum, mandapa pillars and a tiered gopuram. */
export function createTemple({ tiers = 5, width = 10, depth = 12, gold = true } = {}) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ map: TX.templeStoneTexture(), roughness: 0.85, color: 0xd9c9a8 });
  const goldMat = new THREE.MeshPhysicalMaterial({ map: TX.goldTexture(), color: 0xffd36b, metalness: 1, roughness: 0.25, clearcoat: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb0341c, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2ede0, roughness: 0.8 });
  // base platform
  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 6, 1.2, depth + 6), stone); base.position.y = 0.6; g.add(base);
  const steps = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 3), stone); steps.position.set(0, 0.3, depth / 2 + 4); g.add(steps);
  // sanctum
  const sanctum = new THREE.Mesh(new THREE.BoxGeometry(width, 6, depth), stone); sanctum.position.y = 4.2; g.add(sanctum);
  // red/white stripes on plinth
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(width + 6.05, 0.2, depth + 6.05), i % 2 ? red : white);
    s.position.y = 0.1 + i * 0.2; g.add(s);
  }
  // pillared hall
  for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 3; j++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 5, 10), stone);
    p.position.set(i * (width / 2 - 0.8), 3.7, depth / 2 + 1 + j * 0); p.position.z = depth / 2 - 1 + j * -3.5;
    g.add(p);
  }
  // gopuram tiers
  let w = width * 1.1, d = depth * 0.9, y = 7.2;
  for (let t = 0; t < tiers; t++) {
    const th = 2.2 - t * 0.15;
    const tier = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), t % 2 ? red : stone);
    tier.position.y = y + th / 2; g.add(tier);
    // little shrines on tier edges
    for (let k = -1; k <= 1; k++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 6), goldMat);
      s.position.set(k * w * 0.3, y + th + 0.45, d / 2 + 0.1); g.add(s);
    }
    y += th; w *= 0.8; d *= 0.8;
  }
  // barrel vault crown + kalasams
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.5, d, 16, 1, false, 0, Math.PI), gold ? goldMat : stone);
  crown.rotation.set(-Math.PI / 2, 0, Math.PI / 2); crown.rotation.set(0, 0, 0); crown.rotation.z = Math.PI / 2; crown.rotation.x = Math.PI / 2;
  crown.position.y = y; g.add(crown);
  for (let k = -2; k <= 2; k++) {
    const kal = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), goldMat); kal.position.set(0, y + w * 0.5 + 0.3, k * d * 0.2); g.add(kal);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 8), goldMat); tip.position.set(0, y + w * 0.5 + 0.9, k * d * 0.2); g.add(tip);
  }
  // door + lamp glow
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a0d05 }));
  door.position.set(0, 3.2, depth / 2 + 0.1); g.add(door);
  const lamp = new THREE.PointLight(0xffa040, 30, 25, 2); lamp.position.set(0, 3, depth / 2 + 2); g.add(lamp);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Oil lamp (vilakku) with animated flame; interactable. */
export function createLamp() {
  const g = new THREE.Group();
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd8a640, metalness: 1, roughness: 0.3, clearcoat: 0.5 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.35, 1.6, 12), brass); stand.position.y = 0.8; g.add(stand);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.25, 16), brass); bowl.position.y = 1.7; g.add(bowl);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.0 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), flameMat); flame.position.y = 2.05; g.add(flame);
  const light = new THREE.PointLight(0xff9a30, 0, 14, 2); light.position.y = 2.2; g.add(light);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#ffb347'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  spr.scale.setScalar(1.6); spr.position.y = 2.1; g.add(spr);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  let lit = false;
  return {
    group: g,
    get lit() { return lit; },
    light() { lit = true; flameMat.opacity = 1; light.intensity = 25; spr.material.opacity = 0.9; },
    update(t) { if (lit) { flame.scale.set(1 + Math.sin(t * 20) * 0.1, 1 + Math.sin(t * 13) * 0.2, 1); light.intensity = 22 + Math.sin(t * 17) * 4; } },
  };
}

/** A lotus flower floating on water. */
export function createLotus(scale = 1, open = 1) {
  const g = new THREE.Group();
  const petalMat = new THREE.MeshStandardMaterial({ map: TX.lotusPetalTexture(), side: THREE.DoubleSide, roughness: 0.6, color: 0xffc8d8 });
  const petalGeo = new THREE.PlaneGeometry(0.45, 1.2, 1, 4);
  const pp = petalGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const t = (pp.getY(i) + 0.6) / 1.2; pp.setZ(i, Math.sin(t * Math.PI) * 0.25); pp.setX(i, pp.getX(i) * Math.sin(t * Math.PI * 0.9 + 0.2)); }
  petalGeo.translate(0, 0.6, 0);
  for (let ring = 0; ring < 3; ring++) {
    const n = 6 + ring * 3;
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(petalGeo, petalMat);
      p.rotation.y = (i / n) * Math.PI * 2 + ring * 0.3;
      p.rotation.x = -0.35 - ring * 0.35 * open;
      p.rotation.order = 'YXZ';
      p.scale.setScalar(1 - ring * 0.15);
      g.add(p);
    }
  }
  const pod = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa000, emissiveIntensity: 0.5 }));
  pod.position.y = 0.35; g.add(pod);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24, 0.3, Math.PI * 1.85), new THREE.MeshStandardMaterial({ color: 0x1f6b2a, roughness: 0.7, side: THREE.DoubleSide }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; g.add(pad);
  g.scale.setScalar(scale);
  return g;
}

/** Radial "divine light" beam. */
export function createBeam(color = 0xffe9a0, radius = 3, height = 60) {
  const geo = new THREE.CylinderGeometry(radius * 0.4, radius, height, 24, 1, true);
  geo.translate(0, height / 2, 0);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const m = new THREE.Mesh(geo, mat);
  m.userData.setOpacity = (o) => { mat.opacity = o; };
  return m;
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.dispose(); });
    }
  });
}
