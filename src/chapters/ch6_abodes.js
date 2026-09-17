// Chapter VI — Valli at the millet field, then the six abodes. Light the
// evening lamp at each of the Arupadai Veedu temples.
import * as THREE from 'three';
import { makeScene, makeGround, makePlayer, makeClock, dist2, makeMarker, makeLabel } from './base.js';
import { createForest, createRocks, createGrass, createFlowers, createWater, createMotes, createTemple, createLamp, createBeam } from '../world/environment.js';
import { Characters, createPeacock } from '../world/characters.js';
import * as TX from '../engine/textures.js';
import { fbm, clamp, smoothstep, lerp, mulberry32 } from '../engine/noise.js';

const ABODES = [
  { name: 'Tiruparankundram', x: -150, z: -60, h: 26, text: 'Tiruparankundram, near Madurai — the rock-cut temple where Murugan married Deivanai, daughter of Indra.' },
  { name: 'Thiruchendur', x: 150, z: -40, h: 8, text: 'Thiruchendur, the only abode by the sea — where Surapadman was vanquished and redeemed.' },
  { name: 'Palani', x: -40, z: -170, h: 40, text: 'Palani — the hill of the ascetic with the staff, Dandayudhapani. "Pazham nee": you are the fruit.' },
  { name: 'Swamimalai', x: 80, z: 120, h: 22, text: 'Swamimalai, by the Kaveri — where the son taught the father the meaning of Om.' },
  { name: 'Thiruthani', x: -110, z: 120, h: 30, text: 'Thiruthani — the hill of peace, where Murugan\'s anger cooled and he married Valli.' },
  { name: 'Pazhamudircholai', x: 170, z: 150, h: 34, text: 'Pazhamudircholai — the grove of ripe fruit near Madurai, where Murugan tested the poet Avvaiyar with roasted and unroasted fruit.' },
];

export async function create(ctx) {
  const { ui, input, audio } = ctx;
  const cam = ctx.renderer.camera;
  const S = makeScene(ctx, {
    fog: 0xf0c9a8, fogNear: 100, fogFar: 640,
    sky: { elevation: 14, azimuth: 262, turbidity: 8, rayleigh: 3, mie: 0.015, mieG: 0.85, exposure: 0.9 },
    light: { intensity: 2.8, color: 0xffc080, ambient: 0.75, skyColor: 0xffc8a0, groundColor: 0x3a4a20, shadowExtent: 140 },
  });
  const { scene, bursts } = S;
  ctx.renderer.setBloom(0.7, 0.6, 0.75);

  const profile = (x, z) => {
    let h = 3 + fbm(x * 0.012, z * 0.012, 4) * 6 + fbm(x * 0.05, z * 0.05, 3) * 1;
    for (const a of ABODES) { const d = Math.hypot(x - a.x, z - a.z); h += Math.pow(Math.max(0, 1 - d / 55), 1.3) * a.h; if (d < 14) h = Math.max(h, 3 + a.h * 0.93 + 0.5); }
    // river through the middle
    const river = Math.abs(z - 30 + Math.sin(x * 0.02) * 25);
    h -= smoothstep(18, 4, river) * 7;
    return h;
  };
  const isRiver = (x, z) => Math.abs(z - 30 + Math.sin(x * 0.02) * 25) < 14;
  const terrain = makeGround(scene, { profile, palette: { grass: [0.28, 0.45, 0.14], grass2: [0.5, 0.52, 0.2], dirt: [0.48, 0.36, 0.2], rock: [0.42, 0.38, 0.34], sand: [0.72, 0.62, 0.42], sandLine: -1.5 }, size: 520, segments: 256, repeat: 50 });
  const water = createWater(scene, S.sky.sun, { size: 1200, level: -1.5, color: 0x1f4a3a, distortion: 2.5, resolution: ctx.quality.water });
  const nearTemple = (x, z) => ABODES.some((a) => Math.hypot(x - a.x, z - a.z) < 20);
  createForest(scene, profile, { count: Math.floor(500 * ctx.quality.trees), area: 250, kind: 'broadleaf', minH: 0, seed: 12, exclude: (x, z) => isRiver(x, z) || nearTemple(x, z) || Math.hypot(x - 20, z + 60) < 45 });
  createForest(scene, profile, { count: Math.floor(120 * ctx.quality.trees), area: 250, kind: 'mango', minH: 0, seed: 13, exclude: (x, z) => isRiver(x, z) || nearTemple(x, z) || Math.hypot(x - 170, z - 150) > 60 });
  createForest(scene, profile, { count: Math.floor(120 * ctx.quality.trees), area: 250, kind: 'palm', minH: -1, maxH: 6, seed: 15, exclude: (x, z) => !isRiver(x, z) || nearTemple(x, z) });
  createRocks(scene, profile, { count: 100, area: 250, exclude: (x, z) => isRiver(x, z) || nearTemple(x, z) });
  createFlowers(scene, profile, { count: 1500, area: 200, exclude: (x, z) => isRiver(x, z) });
  // millet field near the start
  const millet = createGrass(scene, profile, { count: Math.floor(30000 * Math.max(0.35, ctx.quality.grass)), area: 40, center: [20, -60], color: 0xc8b040, exclude: (x, z) => isRiver(x, z) });
  const grass = createGrass(scene, profile, { count: Math.floor(30000 * ctx.quality.grass), area: 200, color: 0x5a9a2e, exclude: (x, z) => isRiver(x, z) || Math.hypot(x - 20, z + 60) < 42 });
  const fireflies = createMotes(scene, { count: 600, area: 200, height: [0.5, 8], color: '#ffe080', size: 0.7, speed: 0.6 });

  // temples with lamps
  const temples = ABODES.map((a, i) => {
    const y = profile(a.x, a.z);
    const t = createTemple({ tiers: 4 + (i % 3), width: 10, depth: 12 }); t.position.set(a.x, y - 0.3, a.z); t.rotation.y = Math.atan2(-a.x, -a.z) + Math.PI; scene.add(t);
    const lamp = createLamp(); const lx = a.x + Math.sin(t.rotation.y) * 13, lz = a.z + Math.cos(t.rotation.y) * 13;
    lamp.group.position.set(lx, profile(lx, lz), lz); scene.add(lamp.group);
    const marker = makeMarker(0xffd36b, 2.2); marker.position.set(lx, profile(lx, lz) + 0.1, lz); scene.add(marker);
    const label = makeLabel(a.name, { size: 48, scale: 22 }); label.position.set(a.x, y + 28, a.z); scene.add(label);
    return { ...a, lamp, marker, label, lit: false, pos: lamp.group.position };
  });

  // Valli in the millet field on a watch platform (parunthu)
  const valli = Characters.valli(); valli.group.position.set(20, profile(20, -60) + 2.2, -60); scene.add(valli.group);
  const platform = new THREE.Group(); platform.position.set(20, profile(20, -60), -60); scene.add(platform);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a40 })); leg.position.set(px, 1.1, pz); platform.add(leg); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 2.6), new THREE.MeshStandardMaterial({ color: 0xa08050 })); deck.position.y = 2.2; platform.add(deck);
  const valliMarker = makeMarker(0x80ff80, 2.4); valliMarker.position.set(20, profile(20, -57) + 0.1, -56); scene.add(valliMarker);
  const deivanai = Characters.deivanai(); deivanai.group.position.set(-150 + 6, profile(-150, -60) + 0.5, -60 + 14); scene.add(deivanai.group); deivanai.group.visible = false;
  // Ganesha as elephant helper (appears in the Valli scene)
  const elephant = new THREE.Group(); elephant.visible = false; scene.add(elephant);
  {
    const grey = new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 14), grey); body.scale.set(1, 0.85, 1.4); body.position.y = 3; elephant.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), grey); head.position.set(0, 3.6, 3); elephant.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), grey); ear.material = grey.clone(); ear.material.side = THREE.DoubleSide; ear.position.set(s * 1.3, 3.8, 2.6); ear.rotation.y = s * 0.6; elephant.add(ear); }
    const trunkCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.2, 4.1), new THREE.Vector3(0, 2, 4.8), new THREE.Vector3(0.4, 0.8, 4.6), new THREE.Vector3(0.9, 0.2, 4)]);
    elephant.add(new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 12, 0.35, 10), grey));
    for (const [px, pz] of [[-1.2, -1.5], [1.2, -1.5], [-1.2, 1.5], [1.2, 1.5]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 2.6, 10), grey); leg.position.set(px, 1.3, pz); elephant.add(leg); }
    for (const s of [-1, 1]) { const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0xf0e8d0 })); tusk.position.set(s * 0.6, 2.8, 4.3); tusk.rotation.x = Math.PI / 2 - 0.4; elephant.add(tusk); }
    elephant.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  }

  const murugan = Characters.murugan();
  const player = makePlayer(ctx, scene, murugan, profile, bursts, { bounds: 250 });
  player.setPosition(20, -20); player.yaw = Math.PI; player.camYaw = 0;
  player.canThrow = false; player.walkSpeed = 8; player.runSpeed = 14;

  const clock = makeClock();
  let phase = 'valli', lit = 0;
  ui.chapterLabel('Chapter VI · Arupadai Veedu');
  ui.objective('Find Valli in the millet field to the south.');
  ui.counter('');
  audio.startDrone(123.5, 'day');
  ui.hint('Hold Shift to run · the six temple hills are marked with their names', 6000);

  const meetValli = async () => {
    phase = 'cine'; player.frozen = true; scene.remove(valliMarker);
    await ui.dialogue([
      { speaker: 'Valli', text: 'Who goes there? This field is mine to guard, and the parrots have had enough millet for one day. Go away, hunter.' },
      { speaker: 'Murugan', text: 'I am no hunter, Valli — though I have hunted a long time for you. You were promised to me before you were born, daughter of Nambirajan.' },
      { speaker: 'Valli', text: 'Fine words. My father\'s men will hear them differently. Go, before they come.' },
      { speaker: 'Murugan', text: 'Then let your fear choose for you. Brother — a little help?' },
    ]);
    elephant.visible = true; elephant.position.set(34, profile(34, -66), -66); elephant.lookAt(20, profile(34, -66), -60);
    audio.roar(); bursts.emit(elephant.position.clone().add(new THREE.Vector3(0, 3, 0)), 60, 5, '#ffffff');
    await clock.wait(0.8);
    await ui.dialogue([
      { speaker: 'Valli', text: 'A wild elephant! Stranger — protect me, and I will be yours, I swear it!' },
      { speaker: 'Murugan', text: '(laughing) Then be mine, Valli, as you always were. That elephant is Ganesha, my brother, and he has never hurt a soul.' },
      { speaker: 'Valli', text: 'Muruga... it is you. Then take me to Thiruthani, and to the hills where you dwell.' },
    ]);
    elephant.visible = false;
    valli.group.position.set(22, profile(22, -57), -57); valli.group.lookAt(player.pos);
    phase = 'lamps'; player.frozen = false;
    ui.objective('Dusk is falling. Light the lamps of the six abodes (press E at each temple).');
    ui.counter(`0 / 6 lamps`);
    companion = valli;
  };
  let companion = null;

  const light = async (t) => {
    t.lit = true; lit++; t.lamp.light(); scene.remove(t.marker);
    audio.bell(); bursts.emit(t.pos.clone().add(new THREE.Vector3(0, 2, 0)), 120, 6, '#ffd27a');
    ui.counter(`${lit} / 6 lamps`);
    if (t.name === 'Tiruparankundram') { deivanai.group.visible = true; }
    ui.hint(t.text, 7000);
    if (lit === 6) finale();
  };

  const finale = async () => {
    phase = 'cine'; player.frozen = true; ui.objective('');
    await clock.wait(1);
    audio.divine();
    await ui.dialogue([
      { speaker: 'Nakkirar, the poet', text: 'Six hills, six abodes: Tiruparankundram, Thiruchendur, Palani, Swamimalai, Thiruthani, Pazhamudircholai. Wherever the pilgrim climbs, the Lord of the Vel is waiting.' },
      { speaker: 'Murugan', text: 'Valli, my will. Deivanai, my action. Paravani, carry us over the hills — let every lamp in the land answer these six.' },
    ]);
    // ride off on the peacock with Valli and Deivanai
    const peacock = createPeacock({ size: 2 });
    peacock.group.position.copy(player.pos); peacock.group.rotation.y = player.yaw; scene.add(peacock.group);
    player.group.removeFromParent(); peacock.saddle.add(player.group); player.group.position.set(0, 0, 0); player.group.rotation.set(0, 0, 0);
    valli.group.removeFromParent(); peacock.saddle.add(valli.group); valli.group.position.set(-0.9, 0, -0.4); valli.group.rotation.set(0, 0, 0); valli.group.scale.setScalar(0.9);
    deivanai.group.visible = true; deivanai.group.removeFromParent(); peacock.saddle.add(deivanai.group); deivanai.group.position.set(0.9, 0, -0.4); deivanai.group.rotation.set(0, 0, 0); deivanai.group.scale.setScalar(0.9);
    player.mode = 'cinematic';
    const start = peacock.group.position.clone();
    let k = 0;
    cineExtra = (t, dt) => {
      k += dt / 14;
      const e = Math.min(1, k);
      peacock.group.position.set(start.x + Math.sin(e * Math.PI * 1.5) * 90, start.y + e * 70, start.z - e * 160);
      peacock.group.rotation.y = Math.atan2(Math.cos(e * Math.PI * 1.5) * 90 * Math.PI * 1.5, -160) ;
      peacock.animate(t, 'fly', dt); player.rig.animate(t, 'fly'); valli.animate(t, 'fly'); deivanai.animate(t, 'fly');
      const camOff = new THREE.Vector3(Math.sin(t * 0.25) * 16, 5 + Math.sin(t * 0.4) * 2, Math.cos(t * 0.25) * 16);
      cam.position.copy(peacock.group.position).add(camOff); cam.lookAt(peacock.group.position.clone().add(new THREE.Vector3(0, 2, 0)));
    };
    await clock.wait(9);
    ctx.complete();
  };
  let cineExtra = null;

  return {
    update(dt, t) {
      clock.update(dt); bursts.update(dt); water.update(dt); grass.update(t); millet.update(t); fireflies.update(t);
      temples.forEach((tp) => { tp.lamp.update(t); if (!tp.lit) tp.marker.userData.update(t); });
      valliMarker.userData.update(t);
      if (phase !== 'cine') { valli.animate(t, phase === 'valli' ? 'idle' : 'walk', 1, { dt }); }
      deivanai.animate(t, 'bless');
      if (cineExtra) cineExtra(t, dt);
      if (player.mode !== 'cinematic') player.update(dt, t, []);
      S.lights.follow(player.pos);
      // companion follows
      if (companion && phase === 'lamps') {
        const d = new THREE.Vector3().subVectors(player.pos, companion.group.position); d.y = 0; const l = d.length();
        if (l > 4) { companion.group.position.addScaledVector(d.normalize(), Math.min(l - 3.5, 14 * dt)); companion.group.rotation.y = Math.atan2(d.x, d.z); companion.animate(t, 'run', 1, { dt }); }
        else companion.animate(t, 'idle');
        companion.group.position.y = profile(companion.group.position.x, companion.group.position.z);
      }
      if (phase === 'valli' && dist2(player.pos, valliMarker.position) < 9) meetValli();
      if (phase === 'lamps') {
        for (const tp of temples) if (!tp.lit && dist2(player.pos, tp.pos) < 12) {
          ui.hint(`Press E to light the lamp of ${tp.name}`, 800);
          if (input.justPressed('KeyE') || input.fire) light(tp);
        }
      }
      // dusk deepens as lamps are lit
      ctx.renderer.renderer.toneMappingExposure = 0.9 - lit * 0.05;
    },
    dispose() { audio.stopDrone(); },
    debug: { meetValli, lightAll() { temples.forEach((t) => { if (!t.lit) light(t); }); } },
  };
}
