// Chapter V — Thiruchendur. Waves of asuras storm the beach; then Surapadman
// rises from the sea, becomes a mango tree and is split by the Vel.
import * as THREE from 'three';
import { makeScene, makeGround, makePlayer, makeClock, dist2 } from './base.js';
import { createForest, createRocks, createWater, createMotes, createTemple, createBeam } from '../world/environment.js';
import { Characters, createMace, createPeacock, createRooster } from '../world/characters.js';
import * as TX from '../engine/textures.js';
import { fbm, clamp, smoothstep, lerp, mulberry32 } from '../engine/noise.js';

export async function create(ctx) {
  const { ui, input, audio } = ctx;
  const cam = ctx.renderer.camera;
  const S = makeScene(ctx, {
    fog: 0xe8c9a0, fogNear: 90, fogFar: 520,
    sky: { elevation: 12, azimuth: 95, turbidity: 10, rayleigh: 3.5, mie: 0.02, mieG: 0.85, exposure: 0.8 },
    light: { intensity: 2.8, color: 0xffc070, ambient: 0.7, skyColor: 0xffc890, groundColor: 0x6a5030, shadowExtent: 110 },
  });
  const { scene, bursts } = S;
  ctx.renderer.setBloom(0.6, 0.6, 0.8);

  // beach: land to the west (negative x), sea to the east
  const profile = (x, z) => {
    const shore = smoothstep(30, -60, x); // 1 on land, 0 in sea
    const land = 2 + shore * 6 + fbm(x * 0.02, z * 0.02, 4) * 3 * shore + Math.max(0, -x - 120) * 0.25;
    const seabed = -6 + fbm(x * 0.03, z * 0.03, 3) * 1.5;
    return lerp(seabed, land, smoothstep(40, -10, x)) + (x > 0 ? -smoothstep(0, 60, x) * 4 : 0);
  };
  const terrain = makeGround(scene, { profile, palette: { grass: [0.3, 0.45, 0.16], grass2: [0.5, 0.5, 0.2], dirt: [0.5, 0.36, 0.2], rock: [0.42, 0.38, 0.34], sand: [0.82, 0.72, 0.5], sandLine: 3.5 }, textures: { map: TX.sandTexture(), normalMap: TX.normalMapTexture('sand', 256, 12, 1.2) }, size: 500, segments: 220, repeat: 50 });
  const water = createWater(scene, S.sky.sun, { size: 3000, level: 0, color: 0x0b4f6a, distortion: 4, resolution: ctx.quality.water });
  createForest(scene, profile, { count: Math.floor(200 * ctx.quality.trees), area: 220, kind: 'palm', minH: 4, seed: 6, exclude: (x, z) => Math.abs(z) < 30 && x > -40 });
  createRocks(scene, profile, { count: 50, area: 200, minH: 2, exclude: (x, z) => Math.abs(z) < 40 && x > -60 });
  const temple = createTemple({ tiers: 6, width: 12, depth: 16 }); temple.position.set(-70, profile(-70, 0) - 0.3, 0); temple.rotation.y = Math.PI / 2; scene.add(temple);
  const embers = createMotes(scene, { count: 300, area: 70, height: [0.5, 10], color: '#ff9040', size: 0.8, speed: 0.8, center: [-10, 0, 0] });

  // devas' banner poles
  for (let i = -3; i <= 3; i++) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a40 })); pole.position.set(-40, profile(-40, i * 12) + 3.5, i * 12); scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xd42a1a, side: THREE.DoubleSide })); flag.position.set(-38.8, pole.position.y + 2.8, i * 12); scene.add(flag);
  }

  const murugan = Characters.murugan();
  const player = makePlayer(ctx, scene, murugan, profile, bursts, { bounds: 200 });
  player.setPosition(-30, 0); player.yaw = Math.PI / 2; player.camYaw = -Math.PI / 2;
  player.canThrow = true;

  // devas army (decorative)
  const army = [];
  for (let i = 0; i < 10; i++) { const d = Characters.indra(); d.group.position.set(-48 - (i % 2) * 4, profile(-48, -27 + i * 6), -27 + i * 6); d.group.rotation.y = Math.PI / 2; scene.add(d.group); army.push(d); }

  const clock = makeClock();
  const enemies = [];
  let phase = 'intro', wave = 0;
  const WAVES = [
    { name: 'The asura vanguard', count: 5, general: null },
    { name: 'Tarakasura and his host', count: 6, general: 'tarakasura' },
    { name: 'Simhamukha, the lion-faced', count: 6, general: 'simhamukha' },
  ];
  let surapadman = null, tree = null, treeTarget = null;
  ui.chapterLabel('Chapter V · Thiruchendur');
  ui.objective(''); ui.counter(''); ui.health(1);
  audio.startDrone(110, 'day');

  const spawnEnemy = (kind, i, n) => {
    const rig = kind === 'tarakasura' ? Characters.tarakasura() : kind === 'simhamukha' ? Characters.simhamukha() : Characters.asura(i);
    const z = (i - (n - 1) / 2) * 9 + (Math.random() - 0.5) * 4, x = 55 + Math.random() * 25;
    rig.group.position.set(x, profile(x, z), z);
    const mace = createMace(rig.opts.size * 0.8); mace.rotation.x = Math.PI / 2 + 0.3; rig.joints.socket.add(mace);
    scene.add(rig.group);
    const eyes = new THREE.PointLight(0xff3000, 6, 8, 2); eyes.position.y = 1.6 * rig.opts.size; rig.group.add(eyes);
    const e = { rig, pos: rig.group.position, radius: 1.6 * rig.opts.size, hp: kind ? 4 : 1, maxHp: kind ? 4 : 1, dead: false, kind, atkT: Math.random(), speed: kind ? 3.2 : 4.2 + Math.random(), sink: 0,
      onHit() { this.hp--; if (this.hp <= 0) { this.dead = true; audio.roar(); bursts.emit(this.pos.clone().add(new THREE.Vector3(0, 2, 0)), 150, 9, '#ff6030'); } else ui.hint(kind === 'tarakasura' ? 'Tarakasura staggers!' : 'Simhamukha roars in fury!', 1500); } };
    enemies.push(e);
    return e;
  };

  const startWave = async () => {
    const W = WAVES[wave];
    ui.objective(`Wave ${wave + 1} of ${WAVES.length}: ${W.name}. Strike them with the Vel.`);
    for (let i = 0; i < W.count; i++) spawnEnemy(null, i, W.count);
    if (W.general) spawnEnemy(W.general, W.count / 2, W.count).pos.x += 20;
    updateCounter();
    audio.roar();
  };
  const updateCounter = () => { const alive = enemies.filter((e) => !e.dead).length; ui.counter(`${alive} asuras`); };

  const intro = async () => {
    player.frozen = true;
    await clock.wait(0.5);
    await ui.dialogue([
      { speaker: 'Veerabahu, Commander of the Devas', text: 'Lord Murugan! The asura host darkens the sea. Surapadman himself waits beyond the waves.' },
      { speaker: 'Murugan', text: 'Six days they have been given. Raise the rooster banner. Today the shore of Thiruchendur will remember us.' },
    ]);
    player.frozen = false; phase = 'battle';
    ui.hint('Click or F to throw the Vel · keep moving, the asuras strike when close', 6000);
    startWave();
  };

  const boss = async () => {
    phase = 'cine'; player.frozen = true; ui.objective('');
    await clock.wait(0.8);
    audio.roar();
    surapadman = Characters.surapadman();
    surapadman.group.position.set(60, -8, 0); surapadman.group.rotation.y = -Math.PI / 2; scene.add(surapadman.group);
    const glow = new THREE.PointLight(0xff2000, 60, 40, 2); glow.position.y = 5; surapadman.group.add(glow);
    const camFrom = cam.position.clone();
    player.mode = 'cinematic';
    await clock.tween(3, (e, k) => { surapadman.group.position.y = lerp(-8, profile(60, 0), k); cam.position.lerpVectors(camFrom, new THREE.Vector3(20, 10, 22), e); cam.lookAt(50, 4, 0); bursts.emit(new THREE.Vector3(60 + (Math.random() - 0.5) * 8, 0.2, (Math.random() - 0.5) * 8), 3, 4, '#a0d0ff'); });
    await ui.dialogue([
      { speaker: 'Surapadman', text: 'A child! Shiva sends a CHILD against the lord of a thousand forms? I have crushed Indra beneath my heel for a thousand years.' },
      { speaker: 'Murugan', text: 'You were granted your boons by my father, and you used them to chain the worlds. I do not come to destroy you, Surapadman. I come to end what you have become.' },
    ]);
    const e = { rig: surapadman, pos: surapadman.group.position, radius: 4.5, hp: 8, maxHp: 8, dead: false, kind: 'surapadman', atkT: 0, speed: 2.6, sink: 0,
      onHit() { this.hp--; audio.roar(); ui.counter(`Surapadman: ${this.hp} / 8`); if (this.hp <= 0) { this.dead = true; transform(); } } };
    enemies.push(e);
    ui.objective('Face Surapadman. Strike him eight times with the Vel.'); ui.counter('Surapadman: 8 / 8');
    player.mode = 'ground'; player.frozen = false; phase = 'boss';
  };

  const transform = async () => {
    phase = 'cine'; player.frozen = true;
    bursts.emit(surapadman.group.position.clone().add(new THREE.Vector3(0, 4, 0)), 400, 12, '#ff8040');
    await ui.dialogue([{ speaker: 'Surapadman', text: 'You cannot kill me! I will take a thousand forms — I will become the sea itself — I will become... a tree, rooted deeper than your spear can reach!' }]);
    scene.remove(surapadman.group);
    // mango tree in the sea
    tree = new THREE.Group(); tree.position.set(62, -1, 0);
    const bark = new THREE.MeshStandardMaterial({ map: TX.barkTexture(), color: 0x8a6a4a, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 16, 12), bark); trunk.position.y = 8; trunk.castShadow = true; tree.add(trunk);
    const leaf = new THREE.MeshStandardMaterial({ color: 0x1f5a1a, roughness: 0.85, flatShading: true });
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + Math.random() * 3, 1), leaf); c.position.set((Math.random() - 0.5) * 10, 15 + Math.random() * 6, (Math.random() - 0.5) * 10); c.castShadow = true; tree.add(c); }
    for (let i = 0; i < 25; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff6000, emissiveIntensity: 0.5 })); m.position.set((Math.random() - 0.5) * 12, 12 + Math.random() * 8, (Math.random() - 0.5) * 12); tree.add(m); }
    const evil = new THREE.PointLight(0xff3000, 40, 40, 2); evil.position.y = 12; tree.add(evil);
    tree.scale.setScalar(0.01); scene.add(tree);
    await clock.tween(2, (e) => tree.scale.setScalar(Math.max(0.01, e)));
    treeTarget = { pos: new THREE.Vector3(62, 10, 0), radius: 6, dead: false, stopVel: true, onHit() { this.dead = true; split(); } };
    ui.objective('Surapadman has become a mango tree in the sea. Split it with the Vel!'); ui.counter('');
    player.frozen = false; phase = 'tree';
  };

  const split = async () => {
    phase = 'cine'; player.frozen = true;
    audio.bell(); bursts.emit(new THREE.Vector3(62, 10, 0), 600, 14, '#fff0a0');
    const beam = createBeam(0xfff0c0, 6, 120); beam.position.set(62, 0, 0); scene.add(beam); beam.userData.setOpacity(0.5);
    const treeStarts = tree.children.map((c) => c.position.x);
    await clock.tween(1.5, (e, k) => { tree.children.forEach((c, i) => { c.position.x = treeStarts[i] + (i % 2 ? 1 : -1) * k * 9; }); tree.position.y = -1 - k * 9; });
    scene.remove(tree);
    const peacock = createPeacock({ size: 1.6 }); peacock.group.position.set(48, profile(48, 6), 6); peacock.group.rotation.y = -Math.PI / 2; scene.add(peacock.group);
    const rooster = createRooster(1.3); rooster.group.position.set(48, profile(48, -6), -6); rooster.group.rotation.y = -Math.PI / 2; scene.add(rooster.group);
    cineExtra = (t, dt) => { peacock.animate(t, 'display', dt); rooster.animate(t); };
    cam.position.set(30, 5, 14); cam.lookAt(48, 2, 0);
    player.mode = 'cinematic';
    await ui.dialogue([
      { speaker: 'Narrator', text: 'The Vel splits the tree in two. Yet the god does not destroy his enemy. One half rises as a peacock, the other as a rooster.' },
      { speaker: 'Murugan', text: 'You wished for a thousand forms, Surapadman. Take two — and serve me forever. Carry me as my mount, and fly on my banner.' },
      { speaker: 'Surapadman', text: 'I am freed. I am... at peace. Vetrivel! Veeravel!' },
    ]);
    audio.victory();
    await clock.wait(0.5);
    ctx.complete();
  };
  let cineExtra = null;

  const defeat = async () => {
    phase = 'cine'; player.frozen = true;
    await ui.dialogue([{ speaker: 'Veerabahu', text: 'Lord, you have fallen — but the devas rally around you! Rise; the Vel still burns in your hand.' }]);
    enemies.forEach((e) => scene.remove(e.rig.group)); enemies.length = 0;
    player.health = 1; ui.health(1); player.setPosition(-30, 0);
    if (surapadman && !surapadman.dead) { surapadman = null; }
    if (wave >= WAVES.length) { player.frozen = false; boss(); } else { player.frozen = false; phase = 'battle'; startWave(); }
  };

  intro();
  return {
    update(dt, t) {
      clock.update(dt); bursts.update(dt); water.update(dt); embers.update(t);
      army.forEach((d, i) => d.animate(t + i, 'idle'));
      if (cineExtra) cineExtra(t, dt);
      const targets = phase === 'tree' ? [treeTarget] : enemies;
      if (player.mode !== 'cinematic') player.update(dt, t, targets);
      S.lights.follow(player.pos);
      ui.health(player.health);
      // enemy AI
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.dead) { e.sink += dt; e.rig.group.position.y -= dt * 1.5; e.rig.group.rotation.x += dt * 0.5; if (e.sink > 2.5) { scene.remove(e.rig.group); enemies.splice(i, 1); } continue; }
        if (phase !== 'battle' && phase !== 'boss') { e.rig.animate(t, 'idle'); continue; }
        const d = new THREE.Vector3().subVectors(player.pos, e.pos); d.y = 0; const dist = d.length();
        e.rig.group.rotation.y = Math.atan2(d.x, d.z);
        const reach = 2.2 * e.rig.opts.size;
        if (dist > reach) { e.pos.addScaledVector(d.normalize(), e.speed * dt); e.pos.y = profile(e.pos.x, e.pos.z); e.rig.animate(t, 'walk', 1, { dt, holding: true }); }
        else { e.rig.animate(t, 'attack'); e.atkT -= dt; if (e.atkT <= 0) { e.atkT = 1.3; player.damage(e.kind ? 0.16 : 0.09); bursts.emit(player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 20, 4, '#ff4020'); } }
        // separation
        for (const o of enemies) { if (o === e || o.dead) continue; const s = new THREE.Vector3().subVectors(e.pos, o.pos); s.y = 0; const l = s.length(); if (l < 3 && l > 0.01) e.pos.addScaledVector(s.normalize(), (3 - l) * dt * 2); }
      }
      if (phase === 'battle') {
        if (enemies.every((e) => e.dead)) {
          if (enemies.length === 0) { wave++; if (wave < WAVES.length) startWave(); else boss(); }
        } else updateCounter();
      }
      if ((phase === 'battle' || phase === 'boss') && player.health <= 0) defeat();
    },
    dispose() { audio.stopDrone(); ui.health(null); },
    debug: { killAll() { enemies.forEach((e) => { while (!e.dead) e.onHit(); }); }, splitTree() { if (treeTarget && !treeTarget.dead) treeTarget.onHit(); }, get phase() { return phase; } },
  };
}
