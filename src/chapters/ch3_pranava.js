// Chapter III — Swamimalai. Gather the three sounds of Om on the hill path,
// then teach the Pranava to Shiva. A knowledge chapter with a quiz.
import * as THREE from 'three';
import { makeScene, makeGround, makePlayer, makeClock, dist2, makeMarker, makeLabel } from './base.js';
import { createForest, createRocks, createGrass, createFlowers, createTemple, createMotes, createBeam, createWater } from '../world/environment.js';
import { Characters } from '../world/characters.js';
import * as TX from '../engine/textures.js';
import { fbm, clamp, smoothstep } from '../engine/noise.js';

const QUESTIONS = [
  { q: 'Shiva asks: "Of what three sounds is the Pranava made?"', a: ['A, U and M — with the silence that follows them', 'Sa, Ri and Ga', 'Ka, Ta and Pa', 'Om, Namah and Shivaya'], c: 0 },
  { q: 'Shiva asks: "What do the three sounds signify?"', a: ['Earth, water and fire', 'Creation, preservation and dissolution', 'Past, present and future only', 'Sun, moon and stars'], c: 1 },
  { q: 'Shiva asks: "And what lies beyond the three sounds, in the silence after M?"', a: ['Nothing at all', 'Another syllable, spoken only by Brahma', 'The Self — the truth beyond creation, preservation and dissolution', 'The sound of the Vel'], c: 2 },
];

export async function create(ctx) {
  const { ui, input, audio } = ctx;
  const cam = ctx.renderer.camera;
  const S = makeScene(ctx, {
    fog: 0xf2dcb0, fogNear: 70, fogFar: 420,
    sky: { elevation: 28, azimuth: 235, turbidity: 6, rayleigh: 2.2, mie: 0.008, exposure: 0.95 },
    light: { intensity: 3.0, color: 0xffe6c0, ambient: 0.7, skyColor: 0xffe0b0, groundColor: 0x4a3a20, shadowExtent: 110 },
  });
  const { scene, bursts } = S;
  ctx.renderer.setBloom(0.5, 0.55, 0.85);

  // Swamimalai: a single sacred hill beside the river Kaveri, with a spiral path
  const hillH = 42;
  const profile = (x, z) => {
    const r = Math.hypot(x, z);
    const hill = Math.pow(Math.max(0, 1 - r / 70), 1.25) * hillH;
    const base = 2 + fbm(x * 0.02, z * 0.02, 4) * 2.5 - smoothstep(120, 180, z) * 8; // river to the south
    return base + hill + fbm(x * 0.1, z * 0.1, 2) * 0.4;
  };
  const terrain = makeGround(scene, { profile, palette: { grass: [0.3, 0.45, 0.14], grass2: [0.5, 0.55, 0.2], dirt: [0.5, 0.36, 0.2], rock: [0.42, 0.38, 0.34], sand: [0.7, 0.6, 0.4], sandLine: -3 }, size: 420, segments: 220 });
  const water = createWater(scene, S.sky.sun, { level: -3.5, color: 0x1f4a3a, distortion: 2.2, resolution: ctx.quality.water });
  // pilgrim steps spiral up the hill
  const steps = new THREE.Group(); scene.add(steps);
  const stepMat = new THREE.MeshStandardMaterial({ map: TX.templeStoneTexture(), roughness: 0.9, color: 0xc9b89a });
  const pathPts = [];
  for (let i = 0; i <= 160; i++) {
    const k = i / 160;
    const ang = Math.PI * 0.5 + k * Math.PI * 2.6;
    const r = 62 - k * 50;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    pathPts.push(new THREE.Vector3(x, profile(x, z), z));
    if (i % 2 === 0) { const s = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 1.6), stepMat); s.position.set(x, profile(x, z) + 0.05, z); s.rotation.y = -ang; s.receiveShadow = true; s.castShadow = true; steps.add(s); }
  }
  function onPath(x, z) { for (let i = 0; i < pathPts.length; i += 4) { const dx = pathPts[i].x - x, dz = pathPts[i].z - z; if (dx * dx + dz * dz < 30) return true; } return false; }

  createForest(scene, profile, { count: Math.floor(320 * ctx.quality.trees), area: 200, kind: 'broadleaf', minH: 0, maxH: 25, seed: 9, exclude: (x, z) => onPath(x, z) });
  createForest(scene, profile, { count: Math.floor(120 * ctx.quality.trees), area: 200, kind: 'palm', minH: -2, maxH: 8, seed: 19, exclude: (x, z) => onPath(x, z) || Math.hypot(x, z) < 60 });
  createRocks(scene, profile, { count: 70, area: 180, exclude: (x, z) => onPath(x, z) });
  const grass = createGrass(scene, profile, { count: Math.floor(40000 * ctx.quality.grass), area: 120, minH: -1, maxH: 40, exclude: (x, z) => onPath(x, z), color: 0x5a9a2e });
  createFlowers(scene, profile, { count: 1000, area: 90, exclude: (x, z) => onPath(x, z) });
  const pollen = createMotes(scene, { count: 300, area: 80, height: [0.5, 12], color: '#ffe9a0', size: 0.6 });

  // temple on the summit
  const temple = createTemple({ tiers: 4, width: 9, depth: 11 }); temple.position.set(0, profile(0, 0) - 0.3, 0); temple.rotation.y = Math.PI * 0.5; scene.add(temple);
  const shiva = Characters.shiva(); shiva.group.position.set(0, profile(0, 0) + 0.9, 0); shiva.group.position.x = 12; shiva.group.rotation.y = -Math.PI / 2; scene.add(shiva.group);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 20), new THREE.MeshStandardMaterial({ color: 0xd9c9a8 })); seat.position.set(12, profile(0, 0) + 0.2, 0); scene.add(seat);
  const shivaMarker = makeMarker(0xa0c8ff, 2.2); shivaMarker.position.set(15.5, profile(0, 0) + 0.1, 0); scene.add(shivaMarker); shivaMarker.visible = false;
  const shivaLight = new THREE.PointLight(0xa0c8ff, 20, 20, 2); shivaLight.position.set(12, profile(0, 0) + 3, 0); scene.add(shivaLight);

  // Brahma in a cage of light at the foot of the hill
  const bx = 0, bz = 72;
  const brahma = Characters.brahma(); brahma.group.position.set(bx, profile(bx, bz), bz); scene.add(brahma.group);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  cage.position.set(bx, profile(bx, bz) + 2.5, bz); scene.add(cage);
  const cageBars = new THREE.Group(); for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 6), new THREE.MeshBasicMaterial({ color: 0xffd080 })); b.position.set(Math.cos(i / 12 * Math.PI * 2) * 2.2, 0, Math.sin(i / 12 * Math.PI * 2) * 2.2); cageBars.add(b); } cageBars.position.copy(cage.position); scene.add(cageBars);

  // the three syllables on the path
  const SYL = [{ ch: 'அ · A', at: 0.28 }, { ch: 'உ · U', at: 0.58 }, { ch: 'ம் · M', at: 0.86 }];
  const syls = SYL.map((s, i) => {
    const p = pathPts[Math.floor(s.at * (pathPts.length - 1))];
    const g = new THREE.Group(); g.position.set(p.x, p.y + 1.6, p.z);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshPhysicalMaterial({ color: 0xffe8a0, emissive: 0xffa020, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.2 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#ffc860'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(4.5);
    const label = makeLabel(s.ch, { size: 56, scale: 5 }); label.position.y = 1.6;
    const light = new THREE.PointLight(0xffb040, 25, 16, 2);
    g.add(orb, glow, label, light); scene.add(g);
    return { group: g, orb, taken: false, pos: g.position, i };
  });

  const murugan = Characters.murugan();
  const player = makePlayer(ctx, scene, murugan, profile, bursts, { bounds: 190 });
  player.setPosition(6, 82); player.yaw = Math.PI; player.camYaw = 0;
  player.canThrow = false;

  const clock = makeClock();
  let phase = 'intro', got = 0;
  ui.chapterLabel('Chapter III · Swamimalai');
  ui.objective('');
  ui.counter('');
  audio.startDrone(146.8, 'day');

  const intro = async () => {
    player.frozen = true;
    await clock.wait(0.6);
    await ui.dialogue([
      { speaker: 'Brahma', text: 'Child, release me! I am the Creator of all the worlds. Creation halts while I stand in this cage.' },
      { speaker: 'Murugan', text: 'You create with the syllable Om, yet you could not tell me what it means. Whoever wields a power should understand it.' },
      { speaker: 'Brahma', text: 'Your father comes. Perhaps HE will teach you humility.' },
      { speaker: 'Murugan', text: 'Perhaps I will teach him the Pranava instead. But first I will climb the hill and listen to its three sounds.' },
    ]);
    player.frozen = false; phase = 'gather';
    ui.objective('Climb the pilgrim steps and gather the three sounds of Om.');
    ui.counter('0 / 3');
    ui.hint('Follow the stone steps that spiral up the hill', 5000);
  };

  const gather = (s) => {
    s.taken = true; got++; s.group.visible = false;
    bursts.emit(s.pos, 100, 6, '#ffd27a'); audio.chime(got * 2);
    ui.counter(`${got} / 3`);
    ui.hint(['A — the sound of beginning. Creation.', 'U — the sound that carries. Preservation.', 'M — the sound that closes. Dissolution. Now go to Shiva at the summit.'][got - 1], 5000);
    if (got === 3) { phase = 'summit'; shivaMarker.visible = true; ui.objective('Go to Shiva, seated before the temple at the summit.'); }
  };

  const teach = async () => {
    phase = 'cine'; player.frozen = true; shivaMarker.visible = false;
    await ui.dialogue([
      { speaker: 'Shiva', text: 'My son. Brahma stands in a cage of your making and the worlds have stopped turning. Do you truly know the meaning of the Pranava?' },
      { speaker: 'Murugan', text: 'I do. But a teaching must be received as a disciple receives it. Sit before me, Father, and listen.' },
      { speaker: 'Shiva', text: '(smiling) So be it. Teach me, Swaminatha.' },
    ]);
    let correct = 0, attempt = 0;
    while (correct < QUESTIONS.length) {
      const Q = QUESTIONS[correct];
      const ans = await ui.quiz(Q.q, Q.a);
      if (ans === Q.c) { correct++; audio.chime(correct * 2 + 1); bursts.emit(shiva.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)), 80, 5, '#c0e0ff'); }
      else { attempt++; audio.hurt(); await ui.dialogue([{ speaker: 'Shiva', text: ['Reflect again. Listen to the hill, not to your pride.', 'The three sounds you gathered on the path hold the answer.', 'Patience. Even a god learns by listening.'][attempt % 3] }]); }
    }
    audio.divine();
    const beam = createBeam(0xd0e8ff, 3, 70); beam.position.copy(seat.position); scene.add(beam); beam.userData.setOpacity(0.4);
    await ui.dialogue([
      { speaker: 'Murugan', text: 'A is creation, U is preservation, M is dissolution. And the silence after them — that is the Self, beyond all three. That is Om.' },
      { speaker: 'Shiva', text: 'You have taught the teacher. From this day this hill is Swamimalai, and you are Swaminathan — the guru of God. Now release Brahma.' },
    ]);
    // cage dissolves
    scene.remove(cage, cageBars); bursts.emit(cage.position, 200, 8, '#ffd080'); audio.bell();
    await clock.wait(0.8);
    await ui.dialogue([{ speaker: 'Brahma', text: 'I am humbled, Lord Skanda. Creation resumes — and I will never again pass a child without a greeting.' }]);
    ctx.complete();
  };

  intro();
  return {
    update(dt, t) {
      clock.update(dt); bursts.update(dt); water.update(dt); grass.update(t); pollen.update(t);
      shiva.animate(t, 'meditate'); brahma.animate(t, 'idle'); shivaMarker.userData.update(t);
      cage.rotation.y = t * 0.3; cageBars.rotation.y = -t * 0.2; cage.material.opacity = 0.2 + Math.sin(t * 4) * 0.08;
      syls.forEach((s) => { if (!s.taken) { s.orb.rotation.y = t * 1.5; s.orb.rotation.x = Math.sin(t) * 0.4; s.group.position.y = pathPts[Math.floor(SYL[s.i].at * (pathPts.length - 1))].y + 1.6 + Math.sin(t * 2 + s.i) * 0.25; } });
      player.update(dt, t, []);
      S.lights.follow(player.pos);
      if (phase === 'gather') for (const s of syls) if (!s.taken && dist2(s.pos, player.pos) < 4.5) gather(s);
      if (phase === 'summit' && dist2(player.pos, shivaMarker.position) < 7) teach();
    },
    dispose() { audio.stopDrone(); },
    debug: { gatherAll() { syls.forEach((s) => { if (!s.taken) gather(s); }); }, teach },
  };
}
