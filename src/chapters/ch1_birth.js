// Chapter I — Saravana Poigai. Night. The player is the divine fire itself,
// drifting over the lake to gather the six sparks resting on lotuses.
import * as THREE from 'three';
import { makeScene, makeGround, makeClock, dist2, makeLabel } from './base.js';
import { createWater, createMotes, createForest, createLotus, createBeam, createRocks } from '../world/environment.js';
import { Characters } from '../world/characters.js';
import * as TX from '../engine/textures.js';
import { fbm, clamp, lerp, mulberry32 } from '../engine/noise.js';

export async function create(ctx) {
  const { ui, input, audio } = ctx;
  const cam = ctx.renderer.camera;
  const S = makeScene(ctx, {
    fog: 0x061020, fogNear: 40, fogFar: 260,
    sky: { elevation: -8, azimuth: 200, turbidity: 2, rayleigh: 0.3, mie: 0.002, exposure: 0.55, night: true },
    light: { intensity: 0.8, color: 0xa9c4ff, ambient: 0.4, skyColor: 0x2a3a6a, groundColor: 0x0a0804, shadowExtent: 90 },
  });
  const { scene, bursts } = S;
  ctx.renderer.setBloom(0.9, 0.7, 0.55);

  // moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf4f1e0, fog: false }));
  moon.position.set(-300, 220, -500); scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#cfd8ff'), transparent: true, blending: THREE.AdditiveBlending, opacity: 0.6, fog: false }));
  moonGlow.scale.setScalar(120); moonGlow.position.copy(moon.position); scene.add(moonGlow);
  S.lights.dir.position.copy(moon.position);

  // lake basin terrain
  const profile = (x, z) => {
    const r = Math.hypot(x, z);
    const rim = Math.pow(Math.max(0, (r - 55) / 40), 1.6) * 30;
    return -3.5 + fbm(x * 0.02, z * 0.02, 4) * 2.5 + rim + fbm(x * 0.08, z * 0.08, 3) * 0.6 * Math.max(0, r - 45) / 40;
  };
  const terrain = makeGround(scene, { profile, palette: { grass: [0.08, 0.16, 0.08], grass2: [0.12, 0.22, 0.1], dirt: [0.2, 0.16, 0.1], rock: [0.22, 0.22, 0.24], sand: [0.25, 0.22, 0.14], sandLine: 0.5 }, size: 360, segments: 200 });
  const water = createWater(scene, S.sky.sun, { level: 0, color: 0x03111e, distortion: 1.6, resolution: ctx.quality.water });
  water.mesh.material.uniforms.sunColor.value.set(0x8aa0ff);

  const forest = createForest(scene, profile, { count: Math.floor(220 * ctx.quality.trees), area: 170, kind: 'broadleaf', minH: 1.5, seed: 21 });
  createRocks(scene, profile, { count: 40, area: 150, minH: 0.8 });
  // reeds along the shore
  {
    const rnd = mulberry32(8);
    const geo = new THREE.CylinderGeometry(0.02, 0.05, 2.6, 5); geo.translate(0, 1.3, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3e5a2a, roughness: 0.9 });
    const count = Math.floor(6000 * Math.max(0.3, ctx.quality.grass));
    const reeds = new THREE.InstancedMesh(geo, mat, count);
    const d = new THREE.Object3D(); let n = 0, tries = 0;
    while (n < count && tries++ < count * 6) {
      const x = (rnd() - 0.5) * 300, z = (rnd() - 0.5) * 300, y = profile(x, z);
      if (y < -1.4 || y > 0.4) continue;
      d.position.set(x, y, z); d.rotation.set((rnd() - 0.5) * 0.3, rnd() * 6, (rnd() - 0.5) * 0.3); d.scale.setScalar(0.7 + rnd() * 0.8); d.updateMatrix(); reeds.setMatrixAt(n++, d.matrix);
    }
    reeds.count = n; reeds.castShadow = true; scene.add(reeds);
  }
  const fireflies = createMotes(scene, { count: 500, area: 90, height: [0.3, 6], color: '#b8ff7a', size: 0.7, speed: 0.6 });

  // six lotuses, sparks and Krittika maidens
  const rnd = mulberry32(3);
  const sparks = [];
  const maidens = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4, r = 26 + (i % 2) * 14;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const lotus = createLotus(1.6, 0.5); lotus.position.set(x, 0.05, z); lotus.rotation.y = rnd() * 6; scene.add(lotus);
    const spark = new THREE.Group(); spark.position.set(x, 1.1, z);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#ffb347'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(4);
    const light = new THREE.PointLight(0xffa040, 40, 30, 2);
    spark.add(core, glow, light); scene.add(spark);
    sparks.push({ group: spark, lotus, pos: spark.position, taken: false, phase: rnd() * 6 });
    // maiden on the shore behind the lotus
    const ma = a, mr = 70;
    const mx = Math.cos(ma) * mr, mz = Math.sin(ma) * mr;
    const rig = Characters.maiden(i); rig.group.position.set(mx, profile(mx, mz), mz); rig.group.lookAt(0, profile(mx, mz), 0); scene.add(rig.group);
    const lamp = new THREE.PointLight(0xffc080, 12, 18, 2); lamp.position.set(mx, 2.5, mz); scene.add(lamp);
    maidens.push(rig);
  }
  // central great lotus where Parvati will appear
  const greatLotus = createLotus(3.2, 0.2); greatLotus.position.set(0, 0.05, 0); scene.add(greatLotus);
  const beam = createBeam(0xfff0c0, 4, 90); beam.position.set(0, 0, 0); scene.add(beam);

  // the divine flame (player)
  const flame = new THREE.Group();
  const fCore = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d0 }));
  const fGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#ff9a3c'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fGlow.scale.setScalar(7);
  const fLight = new THREE.PointLight(0xff9a40, 120, 45, 2);
  flame.add(fCore, fGlow, fLight);
  flame.position.set(0, 1.2, 62);
  scene.add(flame);
  const trail = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: TX.glowSprite('#ffb060'), size: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const trailN = 120, trailPos = new Float32Array(trailN * 3), trailLife = new Float32Array(trailN);
  trail.geometry.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trail.frustumCulled = false; scene.add(trail);
  let trailHead = 0;

  const vel = new THREE.Vector3();
  let camYaw = Math.PI, camPitch = 0.35;
  const lookT = new THREE.Vector3();
  const clock = makeClock();
  let taken = 0, phase = 'play';
  let parvati = null, shanmukha = null;

  ui.chapterLabel('Chapter I · Saravana Poigai');
  ui.objective('Gather the six sparks of Shiva resting on the lotuses.');
  ui.counter(`0 / 6`);
  ui.hint('Move with W A S D · drag the mouse to look around', 6000);
  audio.startDrone(98, 'night');

  const collect = async (sp) => {
    sp.taken = true; taken++;
    ui.counter(`${taken} / 6`);
    audio.chime(taken);
    bursts.emit(sp.pos, 120, 7, '#ffd27a');
    sp.group.visible = false;
    // an infant appears on the lotus
    const babe = Characters.muruganChild(); babe.group.scale.setScalar(0.5); babe.group.position.copy(sp.lotus.position).add(new THREE.Vector3(0, 0.35, 0));
    babe.group.rotation.y = Math.random() * 6; scene.add(babe.group); sp.babe = babe;
    const halo = new THREE.PointLight(0xffd080, 15, 12, 2); halo.position.y = 1.5; babe.group.add(halo);
    ui.hint(['A spark becomes a child asleep on the lotus.', 'The Krittika maidens sing softly across the water.', 'Third spark — the lake glows like dawn.', 'Four faces of the light have awakened.', 'Five children breathe among the reeds.', 'All six sparks are gathered.'][taken - 1], 4000);
    if (taken === 6) finale();
  };

  const finale = async () => {
    phase = 'cine';
    input.enabled = false;
    ui.objective('');
    await clock.wait(1.2);
    audio.divine();
    // Parvati descends in a beam of light
    parvati = Characters.parvati(); parvati.group.position.set(0, 40, 0); scene.add(parvati.group);
    const camFrom = cam.position.clone();
    const camTo = new THREE.Vector3(14, 8, 22);
    await clock.tween(6, (e) => { parvati.group.position.y = lerp(40, 0.6, e); beam.userData.setOpacity(Math.sin(e * Math.PI) * 0.35); cam.position.lerpVectors(camFrom, camTo, e); cam.lookAt(0, 3, 0); });
    await ui.dialogue([
      { speaker: 'Parvati', text: 'Six children, born of my Lord\'s fire and nursed by the daughters of the sky. Come to me, my sons.' },
    ]);
    // infants fly to Parvati and merge
    const babes = sparks.map((s) => s.babe);
    const babeStarts = babes.map((b) => b.group.position.clone());
    const merge = new THREE.Vector3(0, 1.2, 0.6);
    await clock.tween(2.5, (e) => { babes.forEach((b, i) => { b.group.position.lerpVectors(babeStarts[i], merge, e); b.group.scale.setScalar(0.5 * (1 - e * 0.6)); }); });
    bursts.emit(new THREE.Vector3(0, 1.5, 0.6), 400, 10, '#fff0b0');
    babes.forEach((b) => scene.remove(b.group));
    audio.bell();
    shanmukha = Characters.muruganChild(); shanmukha.group.position.set(0, 0.6, 1.2); scene.add(shanmukha.group);
    // six heads: a ring of faces around the child (visual shorthand for Shanmukha)
    const heads = new THREE.Group(); shanmukha.group.add(heads);
    for (let i = 1; i < 6; i++) {
      const h = Characters.muruganChild(); h.group.scale.setScalar(1); const head = h.joints.head; head.parent.remove(head);
      head.position.set(0, 0.62 * 0.62 + 0.9 * 0.62, 0); head.rotation.y = (i / 6) * Math.PI * 2; head.rotation.order = 'YXZ';
      const pivot = new THREE.Group(); pivot.rotation.y = (i / 6) * Math.PI * 2; pivot.add(head); head.rotation.y = 0; head.position.set(0, 0.94, 0.02); heads.add(pivot);
    }
    const aura = new THREE.PointLight(0xffe0a0, 80, 30, 2); aura.position.y = 2; shanmukha.group.add(aura);
    beam.userData.setOpacity(0.5);
    await ui.dialogue([
      { speaker: 'Parvati', text: 'One child. Six faces to see all directions, twelve arms to protect all worlds. Shanmukha — Arumugan — Karthikeya.' },
      { speaker: 'The Devas', text: 'Skanda is born! The one who will end Surapadman\'s tyranny has come.' },
    ]);
    await clock.wait(0.5);
    ctx.complete();
  };

  const tmp = new THREE.Vector3();
  return {
    update(dt, t) {
      clock.update(dt);
      water.update(dt); fireflies.update(t); bursts.update(dt);
      sparks.forEach((s) => { if (!s.taken) { s.group.position.y = 1.1 + Math.sin(t * 2 + s.phase) * 0.2; s.group.children[1].scale.setScalar(3.5 + Math.sin(t * 5 + s.phase) * 0.6); } s.lotus.position.y = 0.05 + Math.sin(t * 0.8 + s.phase) * 0.05; });
      greatLotus.position.y = 0.05 + Math.sin(t * 0.6) * 0.06;
      maidens.forEach((m, i) => m.animate(t + i, 'bless'));
      if (parvati) parvati.animate(t, 'bless');
      if (shanmukha) { shanmukha.animate(t, 'idle'); shanmukha.group.rotation.y = Math.sin(t * 0.3) * 0.3; }
      beam.rotation.y = t * 0.2;

      if (phase === 'play') {
        const look = input.consumeLook();
        camYaw -= look.dx * 0.0032; camPitch = clamp(camPitch + look.dy * 0.0025, -0.2, 1.2);
        const ax = input.axis();
        const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
        const move = fwd.multiplyScalar(ax.y).add(right.multiplyScalar(ax.x));
        const spd = (input.down('ShiftLeft') ? 16 : 10);
        vel.lerp(move.multiplyScalar(spd), Math.min(1, dt * 4));
        flame.position.addScaledVector(vel, dt);
        const r = Math.hypot(flame.position.x, flame.position.z);
        if (r > 80) { flame.position.x *= 80 / r; flame.position.z *= 80 / r; }
        const gy = profile(flame.position.x, flame.position.z);
        flame.position.y = Math.max(gy + 1.2, 1.2) + Math.sin(t * 3) * 0.15;
        fGlow.scale.setScalar(6.5 + Math.sin(t * 9) * 0.8);
        fLight.intensity = 110 + Math.sin(t * 11) * 20;
        // trail
        trailHead = (trailHead + 1) % trailN;
        trailPos[trailHead * 3] = flame.position.x + (Math.random() - 0.5) * 0.4; trailPos[trailHead * 3 + 1] = flame.position.y + (Math.random() - 0.5) * 0.4; trailPos[trailHead * 3 + 2] = flame.position.z + (Math.random() - 0.5) * 0.4;
        for (let i = 0; i < trailN; i++) trailPos[i * 3 + 1] += dt * 1.5;
        trail.geometry.attributes.position.needsUpdate = true;
        // collect
        for (const s of sparks) if (!s.taken && dist2(s.pos, flame.position) < 4) collect(s);
        // camera
        const target = flame.position.clone();
        const off = new THREE.Vector3(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch)).multiplyScalar(11);
        const desired = target.clone().add(off); desired.y = Math.max(desired.y, profile(desired.x, desired.z) + 1.5, 2);
        cam.position.lerp(desired, Math.min(1, dt * 6));
        lookT.lerp(target, Math.min(1, dt * 10)); cam.lookAt(lookT);
        S.lights.follow(flame.position);
      }
    },
    dispose() { audio.stopDrone(); },
    debug: { collectAll() { sparks.forEach((s) => { if (!s.taken) collect(s); }); } },
  };
}
