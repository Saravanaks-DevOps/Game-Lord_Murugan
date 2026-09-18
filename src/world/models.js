// Optional real 3D characters. Drop a rigged GLB into assets/characters/
// (see assets/characters/README.md) and it replaces the procedural figure of
// the same name. Missing files fall back silently to the procedural rigs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const MODEL_NAMES = ['murugan', 'parvati', 'shiva', 'ganesha', 'valli', 'deivanai', 'surapadman', 'asura', 'brahma', 'peacock'];
const loaded = new Map();   // name -> gltf
const faceRefs = new Map(); // name -> THREE.Texture (assets/refs/<name>.jpg)

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('./vendor/three/addons/libs/draco/gltf/');
loader.setDRACOLoader(draco);

/** Animation clip aliases: game state -> candidate clip names (case-insensitive substrings). */
const CLIP_ALIASES = {
  idle: ['idle', 'stand', 'breath'],
  walk: ['walk'],
  run: ['run', 'sprint', 'jog'],
  throw: ['throw', 'attack', 'punch', 'slash'],
  attack: ['attack', 'slash', 'punch', 'throw'],
  fly: ['fly', 'fall', 'jump', 'idle'],
  meditate: ['meditat', 'sit', 'pray', 'idle'],
  bless: ['bless', 'wave', 'greet', 'idle'],
};

/** Try to load every known model and face reference once, at boot. */
export async function preloadModels(onProgress = () => {}) {
  // Optional assets/manifest.json: { "characters": ["murugan", ...], "refs": ["brahma.jpg", ...] }
  // avoids probing for every possible file (and the 404 lines that leaves in the console).
  let manifest = null;
  try { const r = await fetch('assets/manifest.json'); if (r.ok) manifest = await r.json(); } catch (_) { /* none */ }
  const wanted = manifest?.characters ?? MODEL_NAMES;
  const refList = manifest?.refs ?? null;
  const tasks = wanted.map(async (name) => {
    const url = `assets/characters/${name}.glb`;
    try {
      if (!manifest) { const head = await fetch(url, { method: 'HEAD' }); if (!head.ok) return; }
      const gltf = await loader.loadAsync(url);
      prepareMaterials(gltf.scene);
      loaded.set(name, gltf);
      onProgress(name);
    } catch (e) { console.warn(`model ${name} not loaded:`, e.message); }
  });
  const refCandidates = refList ? refList.map((f) => [f.replace(/\.[^.]+$/, ''), [f.split('.').pop()]]) : MODEL_NAMES.map((n) => [n, ['jpg', 'png', 'jpeg', 'webp']]);
  const refs = refCandidates.map(async ([name, exts]) => {
    for (const ext of exts) {
      const url = `assets/refs/${name}.${ext}`;
      try {
        if (!manifest) { const head = await fetch(url, { method: 'HEAD' }); if (!head.ok) continue; }
        const tex = await new THREE.TextureLoader().loadAsync(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        faceRefs.set(name, tex);
        return;
      } catch (_) { /* try next extension */ }
    }
  });
  await Promise.all([...tasks, ...refs]);
  return { models: [...loaded.keys()], faces: [...faceRefs.keys()] };
}

export function hasModel(name) { return loaded.has(name); }
export function faceRef(name) { return faceRefs.get(name) || null; }

function prepareMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    o.frustumCulled = false; // skinned meshes move away from their bind-pose bounds
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      if (m.map) m.map.anisotropy = 8;
      m.envMapIntensity = 0.8;
      const n = `${m.name} ${o.name}`.toLowerCase();
      if (m.isMeshStandardMaterial && /skin|face|body|head/.test(n)) {
        // realistic skin: soft specular, slight sheen
        m.roughness = Math.min(m.roughness, 0.55);
        if (m.isMeshPhysicalMaterial) { m.sheen = 0.25; m.sheenColor = new THREE.Color(0xffd0a0); m.clearcoat = 0.1; }
      }
      if (m.isMeshStandardMaterial && /gold|metal|crown|jewel|ornament/.test(n)) { m.metalness = 1; m.roughness = Math.min(m.roughness, 0.3); }
    });
  });
}

/**
 * Builds a rig from a loaded GLB with the same interface as createHumanoid():
 * { group, joints: { socket, head }, animate(t, mode, speed, extra), height, opts }.
 * `height` is the target standing height in metres; the model is rescaled to it.
 */
export function createModelRig(name, { height = 2.0, size = 1, opts = {} } = {}) {
  const gltf = loaded.get(name);
  if (!gltf) return null;
  const group = new THREE.Group();
  const model = SkeletonUtils.clone(gltf.scene);
  group.add(model);
  // normalise scale and stand on y = 0
  const box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  const s = (height * size) / h;
  model.scale.setScalar(s);
  model.position.y = -box.min.y * s;
  // Sockets: right hand for the Vel/mace, head for effects
  const joints = { socket: new THREE.Group(), head: new THREE.Group() };
  let hand = null, head = null;
  model.traverse((o) => {
    if (!o.isBone && !o.isObject3D) return;
    const n = o.name.toLowerCase();
    if (!hand && /(right|r_|_r\b|\.r$).*hand|hand.*(right|_r\b|\.r$)|righthand/.test(n)) hand = o;
    if (!head && /\bhead\b|head$|_head|mixamorighead/.test(n) && !/headtop/.test(n)) head = o;
  });
  if (hand) { hand.add(joints.socket); joints.socket.scale.setScalar(1 / s); joints.socket.rotation.set(0, 0, -Math.PI / 2); }
  else { group.add(joints.socket); joints.socket.position.set(0.35 * size, 0.9 * height * size / 2, 0.1); }
  if (head) head.add(joints.head); else { group.add(joints.head); joints.head.position.y = 0.9 * height * size; }

  // animation
  const mixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations || [];
  const actions = new Map();
  const findClip = (mode) => {
    const cands = CLIP_ALIASES[mode] || [mode];
    for (const c of cands) { const clip = clips.find((k) => k.name.toLowerCase().includes(c)); if (clip) return clip; }
    return clips[0] || null;
  };
  let current = null, lastT = null;
  const play = (mode, speed) => {
    const clip = findClip(mode);
    if (!clip) return;
    let a = actions.get(clip.name);
    if (!a) { a = mixer.clipAction(clip); actions.set(clip.name, a); }
    a.timeScale = speed;
    if (mode === 'throw' || mode === 'attack') a.setLoop(THREE.LoopRepeat, Infinity);
    if (current !== a) { a.reset().fadeIn(0.2).play(); if (current) current.fadeOut(0.2); current = a; }
  };
  const rig = {
    group, joints, height: height * size, opts: { size, ...opts }, model, mixer, isModel: true,
    animate(t, mode = 'idle', speed = 1, extra = {}) {
      play(mode, speed);
      const dt = extra.dt ?? (lastT == null ? 0.016 : Math.min(0.1, t - lastT));
      lastT = t;
      mixer.update(dt);
      if (head && extra.lookYaw != null) head.rotation.y = extra.lookYaw;
    },
  };
  return rig;
}
