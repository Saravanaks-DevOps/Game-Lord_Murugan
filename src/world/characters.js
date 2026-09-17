// Procedural rigged characters: deities, asuras, the peacock Paravani and
// the Vel. Every figure is built from primitives with PBR materials and a
// simple joint hierarchy so it can be animated procedurally.
import * as THREE from 'three';
import * as TX from '../engine/textures.js';

const MAT = {
  gold: () => new THREE.MeshPhysicalMaterial({ map: TX.goldTexture(), color: 0xffd76a, metalness: 1, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  gem: (c = 0xff2050) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.1, roughness: 0.05, transmission: 0.4, thickness: 0.5, emissive: c, emissiveIntensity: 0.4 }),
  skin: (rgb) => new THREE.MeshPhysicalMaterial({ map: TX.skinTexture(256, rgb), roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xffd9a0) }),
  silk: (rgb) => new THREE.MeshPhysicalMaterial({ map: TX.silkTexture(256, rgb), roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xffe0a0), sheenRoughness: 0.4 }),
  hair: () => new THREE.MeshStandardMaterial({ color: 0x120a06, roughness: 0.6 }),
  eye: () => new THREE.MeshStandardMaterial({ color: 0xfefefe, roughness: 0.2 }),
  pupil: () => new THREE.MeshStandardMaterial({ color: 0x140b08, roughness: 0.1 }),
};

function mesh(geo, mat, parent, pos = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m);
  return m;
}

/** The Vel: a leaf-shaped lance of divine power. */
export function createVel({ length = 2.6, glow = true } = {}) {
  const g = new THREE.Group();
  const gold = MAT.gold();
  const shaft = mesh(new THREE.CylinderGeometry(0.035, 0.045, length, 10), gold, g, [0, length / 2, 0]);
  // leaf-shaped blade built from a lathe of a leaf profile
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = Math.sin(t * Math.PI) * 0.18 * (1 - t * 0.35) + 0.005;
    pts.push(new THREE.Vector2(r, t * 0.9));
  }
  const bladeGeo = new THREE.LatheGeometry(pts, 6);
  bladeGeo.scale(1, 1, 0.28);
  const bladeMat = new THREE.MeshPhysicalMaterial({ color: 0xfff2c0, metalness: 1, roughness: 0.12, emissive: 0xffb030, emissiveIntensity: glow ? 0.35 : 0, clearcoat: 1 });
  const blade = mesh(bladeGeo, bladeMat, g, [0, length, 0]);
  const collar = mesh(new THREE.SphereGeometry(0.075, 12, 10), gold, g, [0, length, 0]);
  const butt = mesh(new THREE.SphereGeometry(0.06, 10, 8), gold, g, [0, 0, 0]);
  if (glow) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#ffcf70'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    spr.scale.setScalar(1.1); spr.position.y = length + 0.45; g.add(spr);
    g.userData.glow = spr;
  }
  g.userData = { ...g.userData, blade, shaft, length };
  return g;
}

/**
 * Humanoid rig. Returns { group, joints, animate(t, state), height }.
 * `look` options: skin rgb, garment rgb, crown, hair, size, asura, arms count.
 */
export function createHumanoid(opts = {}) {
  const o = Object.assign({
    skin: [232, 182, 106], garment: [200, 24, 24], crown: 'gold', hair: 'tied', size: 1, asura: false,
    tusks: false, horns: false, female: false, jewelry: true, beard: false, tilak: 'vibhuti', muscles: 1,
    upperGarment: null, thirdEye: false, blueThroat: false, moon: false, elephantHead: false, fourFaces: false,
  }, opts);
  const g = new THREE.Group();
  const skin = MAT.skin(o.skin), silk = MAT.silk(o.garment), gold = MAT.gold(), hair = MAT.hair();
  const S = o.size;
  const joints = {};

  const hips = new THREE.Group(); hips.position.y = 1.0 * S; g.add(hips); joints.hips = hips;
  // torso
  const torsoW = (o.female ? 0.19 : 0.24) * o.muscles;
  const torso = mesh(new THREE.CapsuleGeometry(torsoW * S, 0.42 * S, 6, 14), skin, hips, [0, 0.42 * S, 0]);
  torso.scale.set(1.15, 1, 0.75);
  // chest plate / upper garment
  if (o.upperGarment) {
    const ug = mesh(new THREE.CapsuleGeometry(torsoW * 1.06 * S, 0.3 * S, 6, 14), MAT.silk(o.upperGarment), hips, [0, 0.5 * S, 0]);
    ug.scale.set(1.16, 1, 0.78);
  }
  // dhoti / sari
  const dhoti = mesh(new THREE.CylinderGeometry(0.26 * S, 0.34 * S, 0.95 * S, 18, 1, true), silk, hips, [0, -0.4 * S, 0]);
  dhoti.material.side = THREE.DoubleSide;
  const belt = mesh(new THREE.TorusGeometry(0.27 * S, 0.035 * S, 8, 24), gold, hips, [0, 0.06 * S, 0]); belt.rotation.x = Math.PI / 2;
  // neck & head
  const neck = new THREE.Group(); neck.position.y = 0.9 * S; hips.add(neck); joints.neck = neck;
  mesh(new THREE.CylinderGeometry(0.07 * S, 0.09 * S, 0.14 * S, 10), skin, neck, [0, 0.03 * S, 0]);
  const head = new THREE.Group(); head.position.y = 0.12 * S; neck.add(head); joints.head = head;

  const buildFace = (parent, yaw = 0) => {
    const f = new THREE.Group(); f.rotation.y = yaw; parent.add(f);
    if (o.elephantHead) {
      const h = mesh(new THREE.SphereGeometry(0.27 * S, 20, 16), skin, f, [0, 0.2 * S, 0]);
      h.scale.set(1.1, 1, 1.05);
      for (const s of [-1, 1]) { const ear = mesh(new THREE.CircleGeometry(0.22 * S, 18), skin, f, [s * 0.3 * S, 0.25 * S, -0.02 * S]); ear.material.side = THREE.DoubleSide; ear.rotation.y = s * 0.5; }
      const trunkCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.12 * S, 0.24 * S), new THREE.Vector3(0, -0.1 * S, 0.34 * S), new THREE.Vector3(0.06 * S, -0.4 * S, 0.3 * S), new THREE.Vector3(0.14 * S, -0.55 * S, 0.2 * S)]);
      mesh(new THREE.TubeGeometry(trunkCurve, 12, 0.07 * S, 10), skin, f);
      mesh(new THREE.ConeGeometry(0.03 * S, 0.25 * S, 8), MAT.eye(), f, [-0.12 * S, 0.02 * S, 0.3 * S]).rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.035 * S, 8, 8), MAT.pupil(), f, [s * 0.11 * S, 0.24 * S, 0.24 * S]); }
      return f;
    }
    const h = mesh(new THREE.SphereGeometry(0.17 * S, 20, 16), skin, f, [0, 0.14 * S, 0]);
    h.scale.set(0.92, 1.08, 0.95);
    // eyes
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.03 * S, 10, 8), MAT.eye(), f, [s * 0.06 * S, 0.16 * S, 0.145 * S], false); e.scale.set(1.4, 0.9, 0.6);
      mesh(new THREE.SphereGeometry(0.014 * S, 8, 8), MAT.pupil(), f, [s * 0.06 * S, 0.16 * S, 0.165 * S], false);
      const brow = mesh(new THREE.BoxGeometry(0.07 * S, 0.012 * S, 0.02 * S), hair, f, [s * 0.06 * S, 0.2 * S, 0.15 * S], false); brow.rotation.z = s * -0.25;
    }
    // nose & lips
    mesh(new THREE.ConeGeometry(0.02 * S, 0.06 * S, 6), skin, f, [0, 0.13 * S, 0.17 * S], false).rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.03 * S, 0.008 * S, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8c3a2e }), f, [0, 0.085 * S, 0.155 * S], false).rotation.set(Math.PI, 0, 0);
    // forehead marks
    if (o.tilak === 'vibhuti') for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.11 * S, 0.008 * S, 0.01 * S), new THREE.MeshStandardMaterial({ color: 0xf5f0e0 }), f, [0, (0.21 + i * 0.018) * S, 0.163 * S], false);
    if (o.tilak === 'kumkum' || o.tilak === 'vibhuti') mesh(new THREE.SphereGeometry(0.012 * S, 6, 6), new THREE.MeshStandardMaterial({ color: 0xd11f1f, emissive: 0x500000 }), f, [0, 0.205 * S, 0.165 * S], false);
    if (o.thirdEye) { const te = mesh(new THREE.SphereGeometry(0.02 * S, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfff1a0, emissive: 0xff8000, emissiveIntensity: 1.5 }), f, [0, 0.235 * S, 0.15 * S], false); te.scale.set(1, 1.5, 0.5); }
    if (o.tusks) for (const s of [-1, 1]) { const t = mesh(new THREE.ConeGeometry(0.014 * S, 0.06 * S, 6), MAT.eye(), f, [s * 0.05 * S, 0.06 * S, 0.14 * S], false); }
    if (o.horns) for (const s of [-1, 1]) { const hn = mesh(new THREE.ConeGeometry(0.03 * S, 0.22 * S, 8), new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.5 }), f, [s * 0.11 * S, 0.3 * S, 0], false); hn.rotation.z = s * -0.5; }
    if (o.beard) { const b = mesh(new THREE.SphereGeometry(0.1 * S, 10, 8), MAT.eye(), f, [0, 0.03 * S, 0.1 * S], false); b.scale.set(1, 1.3, 0.6); b.material = new THREE.MeshStandardMaterial({ color: 0xe8e2d8 }); }
    // ear jewels
    for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.025 * S, 0.006 * S, 6, 12), gold, f, [s * 0.16 * S, 0.12 * S, 0], false);
    return f;
  };

  if (o.fourFaces) { for (let i = 0; i < 4; i++) buildFace(head, i * Math.PI / 2); }
  else buildFace(head, 0);

  // hair / crown
  if (o.hair === 'tied' || o.hair === 'jata') {
    const bun = mesh(new THREE.SphereGeometry(0.19 * S, 16, 12), hair, head, [0, 0.19 * S, -0.03 * S]); bun.scale.set(0.95, 0.9, 0.95);
    if (o.hair === 'jata') { const jata = mesh(new THREE.ConeGeometry(0.16 * S, 0.4 * S, 10), hair, head, [0, 0.45 * S, -0.02 * S]); if (o.moon) { const mo = mesh(new THREE.TorusGeometry(0.06 * S, 0.015 * S, 6, 16, Math.PI), MAT.eye(), head, [0.12 * S, 0.5 * S, 0.05 * S], false); mo.material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaaccff, emissiveIntensity: 1 }); mo.rotation.z = -0.6; } }
    else { const bun2 = mesh(new THREE.SphereGeometry(0.1 * S, 12, 10), hair, head, [0, 0.35 * S, -0.06 * S]); }
  } else if (o.hair === 'long') {
    const bun = mesh(new THREE.SphereGeometry(0.19 * S, 16, 12), hair, head, [0, 0.19 * S, -0.03 * S]);
    const fall = mesh(new THREE.CapsuleGeometry(0.1 * S, 0.5 * S, 4, 10), hair, head, [0, -0.15 * S, -0.16 * S]);
  } else if (o.hair === 'wild') {
    for (let i = 0; i < 7; i++) { const sp = mesh(new THREE.ConeGeometry(0.05 * S, 0.3 * S, 6), hair, head, [Math.cos(i) * 0.12 * S, 0.3 * S, Math.sin(i) * 0.1 * S - 0.03 * S]); sp.rotation.set(Math.sin(i) * 0.6, 0, Math.cos(i) * 0.6); }
    mesh(new THREE.SphereGeometry(0.18 * S, 12, 10), hair, head, [0, 0.2 * S, -0.03 * S]);
  }
  if (o.crown === 'gold' || o.crown === 'tall') {
    const cr = mesh(new THREE.CylinderGeometry(0.12 * S, 0.17 * S, (o.crown === 'tall' ? 0.42 : 0.26) * S, 12), gold, head, [0, (o.crown === 'tall' ? 0.48 : 0.4) * S, 0]);
    const tip = mesh(new THREE.ConeGeometry(0.12 * S, 0.22 * S, 12), gold, head, [0, (o.crown === 'tall' ? 0.8 : 0.64) * S, 0]);
    for (let i = 0; i < 8; i++) { const gem = mesh(new THREE.SphereGeometry(0.02 * S, 8, 8), MAT.gem(i % 2 ? 0xff2050 : 0x20b070), head, [Math.cos(i / 8 * Math.PI * 2) * 0.16 * S, 0.32 * S, Math.sin(i / 8 * Math.PI * 2) * 0.16 * S], false); }
    const band = mesh(new THREE.TorusGeometry(0.17 * S, 0.02 * S, 8, 24), gold, head, [0, 0.28 * S, 0]); band.rotation.x = Math.PI / 2;
  } else if (o.crown === 'dark') {
    const cr = mesh(new THREE.CylinderGeometry(0.14 * S, 0.18 * S, 0.3 * S, 6), new THREE.MeshStandardMaterial({ color: 0x3b2a1e, metalness: 0.7, roughness: 0.5 }), head, [0, 0.4 * S, 0]);
    for (let i = 0; i < 6; i++) { const sp = mesh(new THREE.ConeGeometry(0.03 * S, 0.18 * S, 5), cr.material, head, [Math.cos(i / 6 * Math.PI * 2) * 0.15 * S, 0.6 * S, Math.sin(i / 6 * Math.PI * 2) * 0.15 * S]); }
  }
  if (o.blueThroat) mesh(new THREE.CylinderGeometry(0.075 * S, 0.095 * S, 0.1 * S, 10), new THREE.MeshStandardMaterial({ color: 0x2244aa }), neck, [0, 0.03 * S, 0], false);

  // jewelry
  if (o.jewelry) {
    const neck1 = mesh(new THREE.TorusGeometry(0.2 * S, 0.02 * S, 8, 24), gold, hips, [0, 0.76 * S, 0.02 * S]); neck1.rotation.x = Math.PI / 2 + 0.3;
    const neck2 = mesh(new THREE.TorusGeometry(0.26 * S, 0.018 * S, 8, 24), gold, hips, [0, 0.66 * S, 0.02 * S]); neck2.rotation.x = Math.PI / 2 + 0.35;
    const pendant = mesh(new THREE.SphereGeometry(0.035 * S, 10, 8), MAT.gem(0xff2050), hips, [0, 0.5 * S, 0.2 * S], false);
    // sacred thread (poonool)
    const thread = mesh(new THREE.TorusGeometry(0.3 * S, 0.008 * S, 6, 32), new THREE.MeshStandardMaterial({ color: 0xf2ecd8 }), hips, [0, 0.42 * S, 0]); thread.rotation.set(Math.PI / 2, 0, 0); thread.rotation.y = 0.8; thread.rotation.x = 1.2;
  }

  // limbs
  const armPairs = o.arms || 1;
  const makeArm = (side, pairIndex) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * torsoW * 1.25 * S, (0.78 - pairIndex * 0.12) * S, -pairIndex * 0.1 * S);
    hips.add(shoulder);
    const upper = mesh(new THREE.CapsuleGeometry(0.06 * o.muscles * S, 0.32 * S, 4, 10), skin, shoulder, [0, -0.2 * S, 0]);
    mesh(new THREE.TorusGeometry(0.075 * S, 0.018 * S, 8, 16), gold, shoulder, [0, -0.02 * S, 0]).rotation.x = Math.PI / 2;
    const elbow = new THREE.Group(); elbow.position.y = -0.38 * S; shoulder.add(elbow);
    const fore = mesh(new THREE.CapsuleGeometry(0.05 * o.muscles * S, 0.3 * S, 4, 10), skin, elbow, [0, -0.18 * S, 0]);
    mesh(new THREE.TorusGeometry(0.065 * S, 0.014 * S, 8, 16), gold, elbow, [0, -0.32 * S, 0]).rotation.x = Math.PI / 2;
    const hand = new THREE.Group(); hand.position.y = -0.36 * S; elbow.add(hand);
    mesh(new THREE.SphereGeometry(0.055 * S, 10, 8), skin, hand, [0, -0.03 * S, 0]).scale.set(0.8, 1.2, 0.5);
    return { shoulder, elbow, hand };
  };
  joints.arms = [];
  for (let p = 0; p < armPairs; p++) { joints.arms.push({ L: makeArm(-1, p), R: makeArm(1, p) }); }
  joints.armL = joints.arms[0].L; joints.armR = joints.arms[0].R;

  const makeLeg = (side) => {
    const hip = new THREE.Group(); hip.position.set(side * 0.12 * S, -0.02 * S, 0); hips.add(hip);
    const thigh = mesh(new THREE.CapsuleGeometry(0.085 * S, 0.36 * S, 4, 10), skin, hip, [0, -0.24 * S, 0]);
    const knee = new THREE.Group(); knee.position.y = -0.48 * S; hip.add(knee);
    const shin = mesh(new THREE.CapsuleGeometry(0.065 * S, 0.34 * S, 4, 10), skin, knee, [0, -0.22 * S, 0]);
    mesh(new THREE.TorusGeometry(0.08 * S, 0.014 * S, 8, 16), gold, knee, [0, -0.42 * S, 0]).rotation.x = Math.PI / 2;
    const foot = mesh(new THREE.BoxGeometry(0.1 * S, 0.06 * S, 0.22 * S), skin, knee, [0, -0.49 * S, 0.05 * S]);
    return { hip, knee };
  };
  joints.legL = makeLeg(-1); joints.legR = makeLeg(1);

  // held item socket (right hand)
  const socket = new THREE.Group(); joints.armR.hand.add(socket); joints.socket = socket;

  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  const state = { phase: 0 };
  const rig = {
    group: g, joints, height: 2.0 * S, opts: o,
    /**
     * Procedural animation. mode: 'idle' | 'walk' | 'run' | 'throw' | 'fly' | 'meditate' | 'attack'
     */
    animate(t, mode = 'idle', speed = 1, extra = {}) {
      const j = joints;
      const bob = Math.sin(t * 2) * 0.01;
      if (mode === 'walk' || mode === 'run') {
        state.phase += (mode === 'run' ? 11 : 7) * speed * (extra.dt ?? 0.016);
        const p = state.phase, a = mode === 'run' ? 0.9 : 0.55;
        j.legL.hip.rotation.x = Math.sin(p) * a; j.legR.hip.rotation.x = Math.sin(p + Math.PI) * a;
        j.legL.knee.rotation.x = Math.max(0, -Math.sin(p - 0.5)) * a * 1.4; j.legR.knee.rotation.x = Math.max(0, -Math.sin(p + Math.PI - 0.5)) * a * 1.4;
        j.armL.shoulder.rotation.x = Math.sin(p + Math.PI) * a * 0.7; j.armR.shoulder.rotation.x = extra.holding ? -0.3 : Math.sin(p) * a * 0.7;
        j.armL.elbow.rotation.x = -0.3; j.armR.elbow.rotation.x = extra.holding ? -0.8 : -0.3;
        hips.position.y = 1.0 * S + Math.abs(Math.sin(p)) * 0.04 * S;
        hips.rotation.x = mode === 'run' ? 0.15 : 0.05;
      } else if (mode === 'fly') {
        j.legL.hip.rotation.x = 0.9; j.legR.hip.rotation.x = 1.1; j.legL.knee.rotation.x = 1.4; j.legR.knee.rotation.x = 1.3;
        j.armL.shoulder.rotation.x = -0.4; j.armR.shoulder.rotation.x = -0.6; j.armL.elbow.rotation.x = -0.9; j.armR.elbow.rotation.x = -1.0;
        hips.rotation.x = 0.1; hips.position.y = 1.0 * S;
      } else if (mode === 'meditate') {
        j.legL.hip.rotation.set(1.5, -1.1, 0); j.legR.hip.rotation.set(1.5, 1.1, 0); j.legL.knee.rotation.x = 2.4; j.legR.knee.rotation.x = 2.4;
        j.armL.shoulder.rotation.set(-0.2, 0, 0.3); j.armR.shoulder.rotation.set(-0.2, 0, -0.3); j.armL.elbow.rotation.x = -1.2; j.armR.elbow.rotation.x = -1.2;
        hips.position.y = 0.55 * S + bob; hips.rotation.x = 0;
      } else if (mode === 'throw') {
        const k = extra.k ?? 0; // 0..1 throw progress
        j.armR.shoulder.rotation.x = k < 0.4 ? -2.4 * (k / 0.4) : -2.4 + (k - 0.4) / 0.6 * 3.6;
        j.armR.elbow.rotation.x = k < 0.4 ? -1.2 : -0.2;
        j.armL.shoulder.rotation.x = -0.4; hips.rotation.y = k < 0.4 ? 0.4 * (k / 0.4) : 0.4 - (k - 0.4) / 0.6 * 0.9;
        j.legL.hip.rotation.x = 0.3; j.legR.hip.rotation.x = -0.3;
      } else if (mode === 'attack') {
        const p = t * 4;
        j.armR.shoulder.rotation.x = -1.6 + Math.sin(p) * 1.2; j.armR.elbow.rotation.x = -0.6;
        j.armL.shoulder.rotation.x = -0.5 + Math.cos(p) * 0.4;
        j.legL.hip.rotation.x = Math.sin(p * 0.5) * 0.4; j.legR.hip.rotation.x = -Math.sin(p * 0.5) * 0.4;
        hips.position.y = 1.0 * S; hips.rotation.x = 0.1;
      } else if (mode === 'bless') {
        j.armR.shoulder.rotation.set(-1.4, 0, -0.5); j.armR.elbow.rotation.x = -1.2; j.armL.shoulder.rotation.set(-0.2, 0, 0.4); j.armL.elbow.rotation.x = -0.5;
        j.legL.hip.rotation.x = 0; j.legR.hip.rotation.x = 0; j.legL.knee.rotation.x = 0; j.legR.knee.rotation.x = 0;
        hips.position.y = 1.0 * S + bob; hips.rotation.x = 0;
      } else { // idle
        j.legL.hip.rotation.x = 0; j.legR.hip.rotation.x = 0; j.legL.knee.rotation.x = 0; j.legR.knee.rotation.x = 0;
        j.legL.hip.rotation.y = 0; j.legR.hip.rotation.y = 0;
        j.armL.shoulder.rotation.set(0, 0, 0.18 + Math.sin(t * 1.3) * 0.03); j.armR.shoulder.rotation.set(extra.holding ? -0.35 : 0, 0, -0.18);
        j.armL.elbow.rotation.x = -0.2; j.armR.elbow.rotation.x = extra.holding ? -0.9 : -0.2;
        hips.position.y = 1.0 * S + bob; hips.rotation.x = 0; hips.rotation.y = 0;
      }
      // secondary arms gently held in mudra
      for (let p = 1; p < joints.arms.length; p++) {
        const pr = joints.arms[p];
        pr.L.shoulder.rotation.set(-0.6 - p * 0.3, 0, 0.6 + p * 0.25 + Math.sin(t + p) * 0.03); pr.L.elbow.rotation.x = -1.2;
        pr.R.shoulder.rotation.set(-0.6 - p * 0.3, 0, -0.6 - p * 0.25 + Math.sin(t + p) * 0.03); pr.R.elbow.rotation.x = -1.2;
      }
      neck.rotation.y = extra.lookYaw ?? Math.sin(t * 0.5) * 0.08;
      neck.rotation.x = extra.lookPitch ?? 0;
    },
  };
  return rig;
}

/* -------------------------------------------------------------- presets */
export const Characters = {
  murugan: (extra = {}) => createHumanoid({ skin: [236, 186, 110], garment: [190, 22, 22], crown: 'tall', hair: 'tied', tilak: 'vibhuti', muscles: 1.05, ...extra }),
  muruganChild: () => createHumanoid({ skin: [240, 195, 120], garment: [200, 40, 40], crown: 'gold', hair: 'tied', size: 0.62, muscles: 0.9 }),
  shanmukha: () => createHumanoid({ skin: [236, 186, 110], garment: [190, 22, 22], crown: 'tall', hair: 'tied', arms: 6, muscles: 1.05 }),
  parvati: () => createHumanoid({ skin: [225, 165, 110], garment: [30, 140, 60], upperGarment: [200, 30, 60], crown: 'gold', hair: 'long', female: true, tilak: 'kumkum' }),
  shiva: () => createHumanoid({ skin: [200, 205, 215], garment: [190, 120, 50], crown: 'none', hair: 'jata', thirdEye: true, blueThroat: true, moon: true, muscles: 1.15, tilak: 'vibhuti' }),
  brahma: () => createHumanoid({ skin: [230, 190, 140], garment: [240, 220, 190], crown: 'gold', hair: 'tied', beard: true, fourFaces: true, arms: 2 }),
  ganesha: () => createHumanoid({ skin: [225, 170, 110], garment: [220, 160, 30], crown: 'gold', hair: 'none', elephantHead: true, muscles: 1.45, size: 0.95, tilak: 'none' }),
  narada: () => createHumanoid({ skin: [230, 200, 150], garment: [250, 245, 230], crown: 'none', hair: 'tied', beard: true, tilak: 'vibhuti' }),
  indra: () => createHumanoid({ skin: [235, 200, 150], garment: [230, 230, 240], crown: 'tall', hair: 'tied', tilak: 'kumkum' }),
  deivanai: () => createHumanoid({ skin: [228, 175, 120], garment: [200, 30, 90], upperGarment: [240, 190, 40], crown: 'gold', hair: 'long', female: true, tilak: 'kumkum' }),
  valli: () => createHumanoid({ skin: [170, 110, 70], garment: [60, 130, 60], upperGarment: [230, 120, 30], crown: 'none', hair: 'long', female: true, tilak: 'kumkum' }),
  maiden: (i) => createHumanoid({ skin: [226, 172, 116], garment: [[220, 60, 60], [60, 120, 200], [230, 170, 30], [140, 60, 180], [40, 150, 90], [230, 100, 40]][i % 6], crown: 'none', hair: 'long', female: true, tilak: 'kumkum', jewelry: true }),
  asura: (variant = 0) => createHumanoid({ skin: [[90, 40, 40], [50, 60, 70], [70, 30, 60]][variant % 3], garment: [40, 25, 20], crown: 'dark', hair: 'wild', tusks: true, horns: true, size: 1.25, muscles: 1.35, tilak: 'none', jewelry: false }),
  surapadman: () => createHumanoid({ skin: [110, 30, 30], garment: [30, 10, 10], crown: 'dark', hair: 'wild', tusks: true, horns: true, size: 2.6, muscles: 1.5, tilak: 'none', arms: 3, jewelry: false }),
  simhamukha: () => createHumanoid({ skin: [180, 120, 40], garment: [60, 20, 10], crown: 'dark', hair: 'wild', tusks: true, size: 1.9, muscles: 1.5, tilak: 'none', jewelry: false }),
  tarakasura: () => createHumanoid({ skin: [40, 50, 90], garment: [20, 20, 40], crown: 'dark', hair: 'wild', horns: true, size: 1.9, muscles: 1.5, tilak: 'none', jewelry: false }),
};

/** A war mace for asuras. */
export function createMace(scale = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x3a2a20, metalness: 0.6, roughness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.04 * scale, 0.05 * scale, 1.4 * scale, 8), m, g, [0, 0.7 * scale, 0]);
  const head = mesh(new THREE.SphereGeometry(0.22 * scale, 10, 8), m, g, [0, 1.5 * scale, 0]);
  for (let i = 0; i < 10; i++) { const sp = mesh(new THREE.ConeGeometry(0.04 * scale, 0.15 * scale, 5), m, g); const v = new THREE.Vector3().setFromSphericalCoords(0.28 * scale, Math.acos(1 - 2 * ((i + 0.5) / 10)), i * 2.4); sp.position.copy(v).add(head.position); sp.lookAt(head.position); sp.rotateX(-Math.PI / 2); }
  return g;
}

/* -------------------------------------------------------------- peacock */
export function createPeacock({ size = 1 } = {}) {
  const g = new THREE.Group();
  const S = size;
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x0f2f9a, metalness: 0.6, roughness: 0.35, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 500], sheen: 1, sheenColor: new THREE.Color(0x00c8ff) });
  const neckMat = new THREE.MeshPhysicalMaterial({ color: 0x1240c0, metalness: 0.5, roughness: 0.3, iridescence: 1, sheen: 1, sheenColor: new THREE.Color(0x40e0ff) });
  const greenMat = new THREE.MeshPhysicalMaterial({ color: 0x0f6d3a, metalness: 0.5, roughness: 0.4, iridescence: 0.8 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xd0c8b0, roughness: 0.4 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 0.7 });

  const root = new THREE.Group(); root.position.y = 1.0 * S; g.add(root);
  const body = mesh(new THREE.SphereGeometry(0.5 * S, 22, 16), bodyMat, root, [0, 0, 0]); body.scale.set(0.8, 0.75, 1.2);
  const back = mesh(new THREE.SphereGeometry(0.42 * S, 18, 14), greenMat, root, [0, 0.12 * S, -0.35 * S]); back.scale.set(0.9, 0.5, 1.1);
  // neck
  const neckCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.15 * S, 0.45 * S), new THREE.Vector3(0, 0.55 * S, 0.62 * S), new THREE.Vector3(0, 0.95 * S, 0.62 * S), new THREE.Vector3(0, 1.2 * S, 0.5 * S)]);
  const neck = mesh(new THREE.TubeGeometry(neckCurve, 16, 0.12 * S, 12), neckMat, root);
  const headG = new THREE.Group(); headG.position.set(0, 1.25 * S, 0.5 * S); root.add(headG);
  mesh(new THREE.SphereGeometry(0.15 * S, 16, 12), neckMat, headG).scale.set(0.9, 0.9, 1.15);
  mesh(new THREE.ConeGeometry(0.05 * S, 0.22 * S, 8), beakMat, headG, [0, -0.02 * S, 0.24 * S]).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(0.03 * S, 8, 8), MAT.pupil(), headG, [s * 0.09 * S, 0.03 * S, 0.1 * S], false); mesh(new THREE.SphereGeometry(0.045 * S, 8, 8), MAT.eye(), headG, [s * 0.1 * S, 0.03 * S, 0.06 * S], false); }
  // crest
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 1.1;
    const stem = mesh(new THREE.CylinderGeometry(0.006 * S, 0.006 * S, 0.22 * S, 4), beakMat, headG, [Math.sin(a) * 0.08 * S, 0.22 * S, -0.02 * S]); stem.rotation.z = -a;
    const tip = mesh(new THREE.SphereGeometry(0.03 * S, 8, 6), neckMat, headG, [Math.sin(a) * 0.17 * S, 0.33 * S, -0.02 * S]); tip.scale.set(1.4, 0.7, 1);
  }
  // wings
  const wingGeo = new THREE.PlaneGeometry(0.9 * S, 0.55 * S, 6, 2);
  const wp = wingGeo.attributes.position;
  for (let i = 0; i < wp.count; i++) { const x = wp.getX(i); wp.setZ(i, -Math.abs(x) * 0.1); wp.setY(i, wp.getY(i) - (x / (0.9 * S)) * 0.15 * S); }
  wingGeo.translate(0.45 * S, 0, 0);
  const wingMat = new THREE.MeshPhysicalMaterial({ color: 0x1d4c9a, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.4, iridescence: 0.8, map: TX.leafTexture() });
  wingMat.map = null; wingMat.color.set(0x25489a);
  const wings = {};
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.3 * S, 0.15 * S, 0); root.add(w);
    const m = mesh(wingGeo, wingMat, w); m.scale.x = s; m.rotation.x = -Math.PI / 2 + 0.3; m.rotation.y = s * 0.1;
    wings[s] = w;
  }
  // tail fan
  const tail = new THREE.Group(); tail.position.set(0, 0.2 * S, -0.5 * S); root.add(tail);
  const featherMat = new THREE.MeshStandardMaterial({ map: TX.peacockFeatherTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.2 });
  const featherGeo = new THREE.PlaneGeometry(0.55 * S, 2.6 * S); featherGeo.translate(0, 1.3 * S, 0);
  const feathers = [];
  const N = 27;
  for (let i = 0; i < N; i++) {
    const f = new THREE.Mesh(featherGeo, featherMat);
    f.castShadow = true;
    f.userData.angle = (i / (N - 1) - 0.5) * Math.PI * 1.15;
    f.userData.len = 0.85 + Math.abs(Math.sin(i * 1.7)) * 0.3;
    tail.add(f); feathers.push(f);
  }
  const trainGeo = new THREE.ConeGeometry(0.3 * S, 2.2 * S, 10); trainGeo.translate(0, -1.1 * S, 0);
  const train = mesh(trainGeo, greenMat, tail, [0, 0, 0]); train.rotation.x = -Math.PI / 2 - 0.25;
  // legs
  const legs = {};
  for (const s of [-1, 1]) {
    const l = new THREE.Group(); l.position.set(s * 0.18 * S, -0.35 * S, 0.05 * S); root.add(l);
    mesh(new THREE.CylinderGeometry(0.03 * S, 0.035 * S, 0.55 * S, 6), legMat, l, [0, -0.27 * S, 0]);
    for (let k = -1; k <= 1; k++) { const toe = mesh(new THREE.CylinderGeometry(0.012 * S, 0.02 * S, 0.22 * S, 5), legMat, l, [k * 0.06 * S, -0.55 * S, 0.1 * S]); toe.rotation.x = Math.PI / 2; toe.rotation.z = k * 0.4; }
    legs[s] = l;
  }
  // saddle socket for rider
  const saddle = new THREE.Group(); saddle.position.set(0, 0.35 * S, -0.05 * S); root.add(saddle);
  g.traverse((m) => { if (m.isMesh && !m.userData.angle) { m.castShadow = true; m.receiveShadow = true; } });

  let fan = 0; // 0 closed, 1 fully spread
  return {
    group: g, root, saddle, tail, headG,
    setFan(v) { fan = v; },
    /** mode: 'idle' | 'walk' | 'fly' | 'display' */
    animate(t, mode = 'idle', dt = 0.016) {
      const target = mode === 'display' ? 1 : mode === 'fly' ? 0.55 : 0.15;
      fan += (target - fan) * Math.min(1, dt * 2);
      feathers.forEach((f) => {
        const a = f.userData.angle;
        f.rotation.z = a * fan;
        f.rotation.x = -0.35 - (1 - fan) * 1.1 + Math.sin(t * 2 + a * 3) * 0.02;
        f.scale.y = f.userData.len;
      });
      train.visible = fan < 0.55; train.scale.setScalar(1 - fan * 0.6);
      tail.rotation.x = mode === 'fly' ? 0.35 : 0;
      if (mode === 'fly') {
        const flap = Math.sin(t * 9);
        wings[-1].rotation.z = -0.3 - flap * 0.9; wings[1].rotation.z = 0.3 + flap * 0.9;
        legs[-1].rotation.x = legs[1].rotation.x = 1.2;
        root.rotation.x = 0.15; root.position.y = 1.0 * S + Math.sin(t * 9) * 0.05;
      } else {
        wings[-1].rotation.z = -0.1 + Math.sin(t) * 0.02; wings[1].rotation.z = 0.1 - Math.sin(t) * 0.02;
        legs[-1].rotation.x = mode === 'walk' ? Math.sin(t * 8) * 0.6 : 0; legs[1].rotation.x = mode === 'walk' ? -Math.sin(t * 8) * 0.6 : 0;
        root.rotation.x = 0; root.position.y = 1.0 * S + (mode === 'walk' ? Math.abs(Math.sin(t * 8)) * 0.05 : Math.sin(t * 1.5) * 0.015);
      }
      headG.rotation.y = Math.sin(t * 0.7) * 0.4; headG.rotation.x = Math.sin(t * 1.3) * 0.15;
    },
  };
}

/** Rooster (seval), Murugan's banner bird. */
export function createRooster(size = 1) {
  const g = new THREE.Group(); const S = size;
  const body = new THREE.MeshPhysicalMaterial({ color: 0x8a2b12, roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color(0xffa040) });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x14301f, metalness: 0.4, roughness: 0.4, iridescence: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe0202a, roughness: 0.5 });
  const root = new THREE.Group(); root.position.y = 0.6 * S; g.add(root);
  mesh(new THREE.SphereGeometry(0.32 * S, 16, 12), body, root).scale.set(0.8, 0.8, 1.1);
  const neck = mesh(new THREE.CylinderGeometry(0.09 * S, 0.16 * S, 0.45 * S, 10), new THREE.MeshStandardMaterial({ color: 0xd88a20 }), root, [0, 0.35 * S, 0.25 * S]); neck.rotation.x = 0.3;
  const head = mesh(new THREE.SphereGeometry(0.12 * S, 12, 10), body, root, [0, 0.62 * S, 0.34 * S]);
  mesh(new THREE.ConeGeometry(0.035 * S, 0.14 * S, 6), new THREE.MeshStandardMaterial({ color: 0xe0c060 }), root, [0, 0.6 * S, 0.5 * S]).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.045 * S, 8, 6), red, root, [0, (0.74 + Math.sin(i) * 0.02) * S, (0.26 + i * 0.05) * S]);
  mesh(new THREE.SphereGeometry(0.05 * S, 8, 6), red, root, [0, 0.5 * S, 0.42 * S]).scale.set(0.5, 1.4, 0.8);
  for (let i = 0; i < 6; i++) { const f = mesh(new THREE.CapsuleGeometry(0.03 * S, 0.5 * S, 3, 6), dark, root, [(i - 2.5) * 0.04 * S, 0.3 * S, -0.5 * S]); f.rotation.x = -0.9 - i * 0.12; f.rotation.z = (i - 2.5) * 0.15; }
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.02 * S, 0.02 * S, 0.4 * S, 5), new THREE.MeshStandardMaterial({ color: 0xd0b060 }), root, [s * 0.12 * S, -0.4 * S, 0]);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, animate(t) { root.position.y = 0.6 * S + Math.abs(Math.sin(t * 6)) * 0.03; head.position.z = 0.34 * S + Math.sin(t * 6) * 0.04; } };
}
