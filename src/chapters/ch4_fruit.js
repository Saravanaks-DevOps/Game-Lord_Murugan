// Chapter IV — Race around the world on the peacock. Fly through the rings of
// the sky three times around Mount Meru before time runs out.
import * as THREE from 'three';
import { makeScene, makeGround, makePlayer, makeClock, dist2 } from './base.js';
import { createForest, createRocks, createWater, createMotes, createTemple } from '../world/environment.js';
import { Characters, createPeacock } from '../world/characters.js';
import * as TX from '../engine/textures.js';
import { fbm, ridged, clamp, smoothstep, lerp } from '../engine/noise.js';

export async function create(ctx) {
  const { ui, input, audio } = ctx;
  const cam = ctx.renderer.camera;
  const S = makeScene(ctx, {
    fog: 0xc8dcf0, fogNear: 200, fogFar: 1400,
    sky: { elevation: 35, azimuth: 140, turbidity: 4, rayleigh: 2, mie: 0.005, exposure: 0.9 },
    light: { intensity: 3.2, color: 0xfff6e6, ambient: 0.55, skyColor: 0xa8ccff, groundColor: 0x3a5a2a, shadowExtent: 160 },
  });
  const { scene, bursts } = S;
  ctx.renderer.setBloom(0.4, 0.5, 0.9);
  cam.far = 4000; cam.updateProjectionMatrix();

  // The world: Mount Meru at the centre, continents and oceans around it
  const prof2 = (x, z) => { const r = Math.hypot(x, z); const meru = Math.pow(Math.max(0, 1 - r / 110), 1.1) * 190; const c = (fbm(x * 0.004 + 10, z * 0.004, 4) * 0.5 + 0.5) * 60 - 22; const d = ridged(x * 0.02, z * 0.02, 4) * 14 * smoothstep(-5, 20, c); return c + d + meru; };
  const terrain = makeGround(scene, { profile: prof2, palette: { grass: [0.22, 0.42, 0.14], grass2: [0.45, 0.5, 0.18], dirt: [0.45, 0.34, 0.2], rock: [0.4, 0.38, 0.36], sand: [0.78, 0.7, 0.5], sandLine: 0.5, snowLine: 120 }, size: 1600, segments: 256, repeat: 120 });
  const water = createWater(scene, S.sky.sun, { size: 4000, level: 0, color: 0x0a4a6e, distortion: 3.5, resolution: ctx.quality.water });
  createForest(scene, prof2, { count: Math.floor(500 * ctx.quality.trees), area: 700, kind: 'broadleaf', minH: 2, maxH: 60, seed: 4, scale: 2.2 });
  createForest(scene, prof2, { count: Math.floor(250 * ctx.quality.trees), area: 700, kind: 'palm', minH: 0.5, maxH: 6, seed: 14, scale: 2 });
  createRocks(scene, prof2, { count: 120, area: 700, minH: 1, scale: 3 });
  // clouds
  const clouds = new THREE.Group(); scene.add(clouds);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85, flatShading: true });
  for (let i = 0; i < 70; i++) {
    const g = new THREE.Group(); const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 500;
    g.position.set(Math.cos(a) * r, 90 + Math.random() * 90, Math.sin(a) * r);
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + Math.random() * 12, 1), cloudMat); m.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 18); m.scale.y = 0.55; g.add(m); }
    g.userData.speed = 1 + Math.random() * 2; clouds.add(g);
  }
  // Kailash court on Meru's summit
  const summitY = prof2(0, 0);
  const court = new THREE.Mesh(new THREE.CylinderGeometry(22, 26, 3, 32), new THREE.MeshStandardMaterial({ map: TX.templeStoneTexture(), color: 0xe0d4b8, roughness: 0.8 })); court.position.y = summitY - 0.5; court.receiveShadow = true; scene.add(court);
  const flatProfile = (x, z) => (Math.hypot(x, z) < 22 ? summitY + 1 : prof2(x, z));
  const temple = createTemple({ tiers: 3, width: 8, depth: 9 }); temple.position.set(0, summitY + 0.8, -12); scene.add(temple);
  const shiva = Characters.shiva(); shiva.group.position.set(-3, summitY + 1, -2); scene.add(shiva.group);
  const parvati = Characters.parvati(); parvati.group.position.set(3, summitY + 1, -2); scene.add(parvati.group);
  const ganesha = Characters.ganesha(); ganesha.group.position.set(-7, summitY + 1, 5); ganesha.group.rotation.y = 0.6; scene.add(ganesha.group);
  const narada = Characters.narada(); narada.group.position.set(8, summitY + 1, 4); narada.group.rotation.y = -0.6; scene.add(narada.group);
  const mango = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), new THREE.MeshPhysicalMaterial({ color: 0xffb020, emissive: 0xff8000, emissiveIntensity: 0.6, clearcoat: 1 })); mango.scale.set(0.8, 1.1, 0.8); mango.position.set(0, summitY + 2.6, 2); scene.add(mango);
  const mangoLight = new THREE.PointLight(0xffb040, 30, 20, 2); mangoLight.position.copy(mango.position); scene.add(mangoLight);

  // rings of the sky
  const RINGS = 9, LAPS = 3;
  const rings = [];
  const ringMatOn = new THREE.MeshStandardMaterial({ color: 0xffe080, emissive: 0xffa000, emissiveIntensity: 2 });
  const ringMatOff = new THREE.MeshStandardMaterial({ color: 0xa0c0ff, emissive: 0x3060ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.55 });
  for (let i = 0; i < RINGS; i++) {
    const a = (i / RINGS) * Math.PI * 2;
    const r = 260 + Math.sin(i * 2.1) * 60;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = Math.max(prof2(x, z) + 25, 30) + Math.sin(i * 1.3) * 25 + 40;
    const m = new THREE.Mesh(new THREE.TorusGeometry(14, 1.2, 12, 48), ringMatOff);
    m.position.set(x, y, z); m.lookAt(Math.cos(a + 0.35) * r, y, Math.sin(a + 0.35) * r); scene.add(m);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowSprite('#ffd080'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); glow.scale.setScalar(50); m.add(glow);
    rings.push({ mesh: m, glow, pos: m.position });
  }
  const skyMotes = createMotes(scene, { count: 400, area: 500, height: [30, 200], color: '#ffffff', size: 2, speed: 0.2 });

  const peacock = createPeacock({ size: 2.2 });
  const murugan = Characters.murugan();
  const player = makePlayer(ctx, scene, murugan, prof2, bursts, { bounds: 900, mount: peacock });
  player.canThrow = false;
  peacock.group.position.set(0, summitY + 1, 14); peacock.group.rotation.y = 0;
  player.setMode('fly');
  player.frozen = true;

  const clock = makeClock();
  let phase = 'intro', next = 0, lap = 0, passes = 0, timeLeft = 210;
  const TOTAL = RINGS * LAPS;
  ui.chapterLabel('Chapter IV · Around the World');
  ui.objective(''); ui.counter('');
  audio.startDrone(164.8, 'day');

  const setNext = () => { rings.forEach((r, i) => { r.mesh.material = i === next ? ringMatOn : ringMatOff; r.glow.material.opacity = i === next ? 0.5 : 0; }); };

  const intro = async () => {
    await clock.wait(0.5);
    await ui.dialogue([
      { speaker: 'Narada', text: 'A single mango from the garden of the gods — the Gnana Pazham, the fruit of all wisdom. It cannot be cut or shared.' },
      { speaker: 'Shiva', text: 'Then let it be earned. Whichever of my sons first circles the world three times shall have it.' },
      { speaker: 'Ganesha', text: '(patting his belly) Three times around the world... Brother, you had better hurry.' },
      { speaker: 'Murugan', text: 'Paravani! Fly! We will outrun the wind itself.' },
    ]);
    phase = 'race'; player.frozen = false; setNext();
    ui.objective(`Fly through the golden ring. Complete ${LAPS} laps of the sky.`);
    ui.counter(`Lap 1 / ${LAPS}  ·  0 / ${RINGS}`);
    ui.hint('W to speed up · A/D to bank · Space to climb · Shift to dive', 7000);
    ui.timer('3:30');
  };

  const win = async () => {
    phase = 'cine'; player.frozen = true; ui.timer(null); ui.objective('');
    audio.victory();
    // fly back to the summit
    const m = peacock.group;
    const from = m.position.clone(), to = new THREE.Vector3(0, summitY + 1.2, 16);
    const rotFrom = m.rotation.y;
    await clock.tween(4, (e) => { m.position.lerpVectors(from, to, e); m.position.y += Math.sin(e * Math.PI) * 40; m.rotation.y = lerp(rotFrom, Math.PI, e); m.rotation.z = 0; m.rotation.x = 0; });
    player.mode = 'cinematic';
    cam.position.set(14, summitY + 6, 22); cam.lookAt(0, summitY + 2, 2);
    // Ganesha already ate it
    scene.remove(mango, mangoLight);
    ganesha.group.position.set(0, summitY + 1, 2);
    await ui.dialogue([
      { speaker: 'Murugan', text: 'Three times round the world — over every ocean and mountain! Father, the fruit is mine.' },
      { speaker: 'Ganesha', text: 'Forgive me, brother. I walked once around our mother and father, and then twice more. They are the whole world to me. The fruit is eaten.' },
      { speaker: 'Shiva', text: 'It was not a race of speed, my son, but of understanding. Ganesha grasped it first.' },
      { speaker: 'Murugan', text: 'Then I want nothing from this house. Not fruit, not crown, not silk. Let me go where no one will measure me against anyone.' },
    ]);
    ui.fade(true);
    await clock.wait(1.5);
    // Palani: Murugan as ascetic. Reuse the summit: strip the court, dusk light.
    scene.remove(temple, court); [shiva, parvati, ganesha, narada].forEach((c) => scene.remove(c.group));
    peacock.group.visible = false; player.group.removeFromParent();
    const asc = Characters.murugan({ crown: 'none', hair: 'tied', garment: [230, 120, 30], jewelry: false });
    asc.group.position.set(0, summitY + 1, 0); scene.add(asc.group);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a20 })); staff.position.set(0.4, 1.2, 0.2); asc.group.add(staff);
    shiva.group.position.set(-3, summitY + 1, 4); parvati.group.position.set(3, summitY + 1, 4); scene.add(shiva.group, parvati.group);
    shiva.group.lookAt(0, summitY + 1, 0); parvati.group.lookAt(0, summitY + 1, 0);
    S.sky.sky.material.uniforms.sunPosition.value.setFromSphericalCoords(1, THREE.MathUtils.degToRad(84), THREE.MathUtils.degToRad(250));
    ctx.renderer.renderer.toneMappingExposure = 0.7;
    cam.position.set(6, summitY + 4, 9); cam.lookAt(0, summitY + 2, 0);
    ui.chapterLabel('Chapter IV · Palani Hill');
    ui.fade(false);
    await clock.wait(1.5);
    await ui.dialogue([
      { speaker: 'Parvati', text: 'We searched every hill for you. Come home, my son.' },
      { speaker: 'Shiva', text: 'You ask for nothing — then know this. Pazham nee: YOU are the fruit. All wisdom already lives in you.' },
      { speaker: 'Murugan', text: 'Then let me stay here on this hill, with only a staff, and give that wisdom to whoever climbs to me.' },
    ]);
    cineExtra = (t) => { asc.animate(t, 'idle'); shiva.animate(t, 'bless'); parvati.animate(t, 'bless'); };
    await clock.wait(0.5);
    ctx.complete();
  };
  let cineExtra = null;

  const fail = async () => {
    phase = 'cine'; player.frozen = true;
    await ui.dialogue([{ speaker: 'Narada', text: 'The sun has crossed the sky and the laps are unfinished. The peacock rests — and then flies again.' }]);
    next = 0; lap = 0; passes = 0; timeLeft = 210; setNext();
    peacock.group.position.set(0, summitY + 1, 14); peacock.group.rotation.set(0, 0, 0); player.flySpeed = 0;
    ui.counter(`Lap 1 / ${LAPS}  ·  0 / ${RINGS}`); player.frozen = false; phase = 'race';
  };

  intro();
  return {
    update(dt, t) {
      clock.update(dt); bursts.update(dt); water.update(dt); skyMotes.update(t);
      clouds.children.forEach((c) => { c.position.x += c.userData.speed * dt; if (c.position.x > 800) c.position.x = -800; });
      rings.forEach((r, i) => { r.mesh.rotation.z = t * 0.5; if (i === next) r.mesh.scale.setScalar(1 + Math.sin(t * 4) * 0.05); });
      if (phase !== 'cine' || !cineExtra) { shiva.animate(t, 'idle'); parvati.animate(t, 'idle'); ganesha.animate(t, 'idle'); narada.animate(t, 'idle'); }
      if (cineExtra) cineExtra(t);
      mango.rotation.y = t;
      if (phase !== 'cine' || player.mode !== 'cinematic') player.update(dt, t, []);
      else peacock.animate(t, 'idle', dt);
      S.lights.follow(peacock.group.position);
      if (phase === 'race') {
        timeLeft -= dt;
        const m = Math.floor(timeLeft / 60), s = Math.floor(timeLeft % 60);
        ui.timer(`${m}:${s.toString().padStart(2, '0')}`);
        const r = rings[next];
        if (peacock.group.position.distanceTo(r.pos) < 16) {
          passes++; audio.chime(passes % 7); bursts.emit(r.pos, 80, 12, '#ffe090');
          next = (next + 1) % RINGS;
          if (next === 0) lap++;
          if (passes >= TOTAL) win(); else { setNext(); ui.counter(`Lap ${lap + 1} / ${LAPS}  ·  ${next} / ${RINGS}`); }
        }
        if (timeLeft <= 0) fail();
      }
    },
    dispose() { audio.stopDrone(); ui.timer(null); cam.far = 3000; cam.updateProjectionMatrix(); },
    debug: { win },
  };
}
