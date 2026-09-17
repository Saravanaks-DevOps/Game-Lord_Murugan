// Chapter II — Kailash. Parvati bestows the Vel; the player masters it against
// floating asura shields before sunset.
import * as THREE from 'three';
import { makeScene, makeGround, makePlayer, makeClock, dist2, makeMarker } from './base.js';
import { createForest, createRocks, createMotes, createBeam } from '../world/environment.js';
import { Characters } from '../world/characters.js';
import * as TX from '../engine/textures.js';
import { fbm, ridged, clamp, lerp, smoothstep, mulberry32 } from '../engine/noise.js';

export async function create(ctx) {
  const { ui, input, audio } = ctx;
  const cam = ctx.renderer.camera;
  const S = makeScene(ctx, {
    fog: 0xd8e4f2, fogNear: 80, fogFar: 520,
    sky: { elevation: 18, azimuth: 210, turbidity: 3, rayleigh: 1.5, mie: 0.004, exposure: 0.95 },
    light: { intensity: 3.4, color: 0xfff4e0, ambient: 0.5, skyColor: 0xbfd8ff, groundColor: 0x8a8a90, shadowExtent: 110 },
  });
  const { scene, bursts } = S;
  ctx.renderer.setBloom(0.45, 0.5, 0.9);

  // plateau surrounded by Himalayan ridges
  const profile = (x, z) => {
    const r = Math.hypot(x, z);
    const plateau = 20 + fbm(x * 0.03, z * 0.03, 3) * 1.2;
    const mountains = ridged(x * 0.012 + 3, z * 0.012, 5) * 90 * smoothstep(40, 130, r);
    const kailash = Math.max(0, 1 - Math.hypot(x + 0, z + 230) / 120) ** 1.4 * 160; // great peak to the north
    return plateau + mountains + kailash;
  };
  const terrain = makeGround(scene, { profile, palette: { grass: [0.55, 0.58, 0.62], grass2: [0.62, 0.64, 0.66], dirt: [0.45, 0.42, 0.4], rock: [0.38, 0.36, 0.36], snowLine: 40 }, textures: { map: TX.snowRockTexture(), normalMap: TX.normalMapTexture('snow', 256, 8, 1.2) }, size: 700, segments: 240, repeat: 60 });
  createForest(scene, profile, { count: Math.floor(160 * ctx.quality.trees), area: 300, kind: 'pine', minH: 15, maxH: 45, seed: 5, exclude: (x, z) => Math.hypot(x, z) < 45 });
  createRocks(scene, profile, { count: 80, area: 300, minH: 15, exclude: (x, z) => Math.hypot(x, z) < 40 });
  const snowMotes = createMotes(scene, { count: 600, area: 90, height: [0, 25], color: '#ffffff', size: 0.5, speed: 1.2 });

  // training mandala carved on the plateau
  const mandala = new THREE.Mesh(new THREE.RingGeometry(6, 30, 64, 4), new THREE.MeshStandardMaterial({ color: 0xd2b46a, roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.55 }));
  mandala.rotation.x = -Math.PI / 2; mandala.position.y = profile(0, 0) + 0.05; scene.add(mandala);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.5, 8), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.7 }));
    p.position.set(Math.cos(a) * 30, profile(Math.cos(a) * 30, Math.sin(a) * 30) + 1.7, Math.sin(a) * 30); p.castShadow = true; scene.add(p);
    const fire = new THREE.PointLight(0xffa040, 10, 14, 2); fire.position.set(p.position.x, p.position.y + 2.2, p.position.z); scene.add(fire);
  }

  // Parvati on a dais
  const parvati = Characters.parvati(); parvati.group.position.set(0, profile(0, -8) + 0.6, -8); scene.add(parvati.group);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.6, 24), new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.7 })); dais.position.set(0, profile(0, -8) + 0.3, -8); dais.receiveShadow = true; scene.add(dais);
  const beam = createBeam(0xfff0c0, 3, 60); beam.position.copy(dais.position); scene.add(beam); beam.userData.setOpacity(0.18);
  const marker = makeMarker(); marker.position.set(0, profile(0, -4.5) + 0.1, -4.5); scene.add(marker);
  // Indra and devas watching
  const devas = [];
  for (let i = 0; i < 5; i++) { const d = i === 0 ? Characters.indra() : Characters.maiden(i + 2); const x = -14 + i * 7, z = -22; d.group.position.set(x, profile(x, z), z); scene.add(d.group); devas.push(d); }

  const murugan = Characters.murugan();
  const player = makePlayer(ctx, scene, murugan, profile, bursts, { bounds: 120 });
  player.setPosition(0, 12); player.yaw = Math.PI; player.camYaw = 0;
  player.canThrow = false; player.vel3.visible = false;

  const clock = makeClock();
  let phase = 'approach';
  const targets = [];
  let hits = 0; const TOTAL = 10; let timeLeft = 120;

  ui.chapterLabel('Chapter II · Mount Kailash');
  ui.objective('Approach Parvati on the dais.');
  ui.counter('');
  audio.startDrone(130.8, 'day');

  const spawnTargets = () => {
    targets.forEach((t) => scene.remove(t.group)); targets.length = 0;
    const rnd = mulberry32(42);
    for (let i = 0; i < TOTAL; i++) {
      const a = (i / TOTAL) * Math.PI * 2 + 0.3, r = 16 + (i % 3) * 7;
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x3a2020, metalness: 0.7, roughness: 0.4 }));
      disc.rotation.x = Math.PI / 2; disc.castShadow = true; g.add(disc);
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), new THREE.MeshStandardMaterial({ color: 0x8a1a1a, emissive: 0xff2000, emissiveIntensity: 0.6 })); face.position.z = 0.2; g.add(face);
      for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 6), disc.material); horn.position.set(s * 0.5, 0.7, 0.2); horn.rotation.z = -s * 0.5; g.add(horn); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.06, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff8000, emissiveIntensity: 1.2 })); g.add(ring);
      const base = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); base.y = profile(base.x, base.z) + 3 + rnd() * 4;
      g.position.copy(base); scene.add(g);
      targets.push({ group: g, base, pos: g.position, radius: 1.7, dead: false, orbit: i % 2 === 0 ? 0 : 0.6 + rnd() * 0.6, phase: rnd() * 6, onHit() { this.dead = true; hits++; ui.counter(`${hits} / ${TOTAL}`); audio.chime(hits); g.visible = false; if (hits === TOTAL) success(); } });
    }
    hits = 0; ui.counter(`0 / ${TOTAL}`);
  };

  const grant = async () => {
    phase = 'cine'; player.frozen = true;
    scene.remove(marker);
    await ui.dialogue([
      { speaker: 'Indra, King of the Devas', text: 'Lord, Surapadman has chained us for a thousand years. Lead our armies — be our Devasenapati.' },
      { speaker: 'Parvati', text: 'My son. You will need more than courage. Take this — it is my own power, my Shakti, given form.' },
    ]);
    audio.divine();
    beam.userData.setOpacity(0.5);
    bursts.emit(parvati.group.position.clone().add(new THREE.Vector3(0, 2, 1)), 200, 6, '#fff0b0');
    const gift = player.vel3; gift.visible = true;
    await clock.wait(1.2);
    beam.userData.setOpacity(0.18);
    await ui.dialogue([
      { speaker: 'Parvati', text: 'This is the Vel. It is wisdom itself — it cuts through ignorance and returns to a pure heart. Strike the asura shields and learn its flight.' },
    ]);
    player.canThrow = true; player.frozen = false; phase = 'train';
    spawnTargets();
    ui.objective('Throw the Vel (click or F) and strike all the asura shields before the sun sets.');
    ui.hint('Click or press F to throw · the Vel returns to your hand', 5000);
    ui.timer('2:00');
  };

  const success = async () => {
    phase = 'cine'; player.frozen = true; ui.timer(null);
    await clock.wait(0.8);
    audio.victory();
    await ui.dialogue([
      { speaker: 'Parvati', text: 'Vetrivel! Veeravel! The victorious Vel, the valorous Vel. Go now, my son — the devas await their commander.' },
    ]);
    ctx.complete();
  };

  const fail = async () => {
    phase = 'cine'; player.frozen = true;
    await ui.dialogue([{ speaker: 'Parvati', text: 'The sun has set behind Kailash. Rest, and at dawn try again. The Vel is patient.' }]);
    timeLeft = 120; spawnTargets(); player.frozen = false; phase = 'train';
  };

  return {
    update(dt, t) {
      clock.update(dt); bursts.update(dt); snowMotes.update(t);
      parvati.animate(t, 'bless'); devas.forEach((d, i) => d.animate(t + i, 'idle'));
      marker.userData.update(t);
      beam.rotation.y = t * 0.3;
      targets.forEach((tg) => { if (tg.dead) return; if (tg.orbit) { tg.group.position.x = tg.base.x + Math.cos(t * tg.orbit + tg.phase) * 4; tg.group.position.z = tg.base.z + Math.sin(t * tg.orbit + tg.phase) * 4; } tg.group.position.y = tg.base.y + Math.sin(t * 1.5 + tg.phase) * 0.6; tg.group.lookAt(player.pos.x, tg.group.position.y, player.pos.z); });
      player.update(dt, t, targets);
      S.lights.follow(player.pos);
      if (phase === 'approach' && dist2(player.pos, marker.position) < 9) grant();
      if (phase === 'train') {
        timeLeft -= dt;
        const m = Math.floor(timeLeft / 60), s = Math.floor(timeLeft % 60);
        ui.timer(`${m}:${s.toString().padStart(2, '0')}`);
        ctx.renderer.renderer.toneMappingExposure = 0.95 - (1 - timeLeft / 120) * 0.35;
        if (timeLeft <= 0) fail();
      }
    },
    dispose() { audio.stopDrone(); ui.timer(null); },
    debug: { grant, hitAll() { targets.forEach((t) => { if (!t.dead) t.onHit(); }); } },
  };
}
