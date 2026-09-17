// Shared scaffolding for chapters: scene creation, lighting/sky presets and a
// small helper collection every chapter uses.
import * as THREE from 'three';
import { createSky, createLighting, createTerrain, biomeColor, Bursts, disposeScene } from '../world/environment.js';
import * as TX from '../engine/textures.js';
import { Player } from '../engine/player.js';

export function makeScene(ctx, { fog = 0x9fbfd8, fogNear = 60, fogFar = 420, sky = {}, light = {} }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(fog, fogNear, fogFar);
  ctx.renderer.setScene(scene);
  const skyR = createSky(scene, ctx.renderer.renderer, sky);
  const lights = createLighting(scene, skyR.sun, { shadowSize: ctx.quality.shadowMap, ...light });
  const bursts = new Bursts(scene);
  return { scene, sky: skyR, lights, bursts };
}

export function makeGround(scene, { profile, palette, textures = null, size = 400, segments = 220, repeat = 40 }) {
  const terrain = createTerrain({ size, segments, profile, colorFn: biomeColor(palette), textures: textures ?? { map: TX.grassTexture(), normalMap: TX.normalMapTexture('ground', 256, 10, 1.5) }, uvRepeat: repeat });
  scene.add(terrain.mesh);
  return terrain;
}

export function makePlayer(ctx, scene, rig, heightAt, bursts, extra = {}) {
  const p = new Player({ rig, scene: scene, camera: ctx.renderer.camera, input: ctx.input, heightAt, audio: ctx.audio, bursts, ...extra });
  return p;
}

/** Simple tween scheduler for cutscenes: await wait(seconds). */
export function makeClock() {
  const timers = [];
  const tweens = [];
  const ease = (t) => t * t * (3 - 2 * t);
  return {
    wait(sec) { return new Promise((res) => timers.push({ t: sec, res })); },
    /** Calls fn(eased, linear) every frame for `sec` seconds; resolves when done. */
    tween(sec, fn) { return new Promise((res) => tweens.push({ t: 0, sec, fn, res })); },
    update(dt) {
      for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { timers.splice(i, 1)[0].res(); } }
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]; tw.t = Math.min(tw.sec, tw.t + dt); const k = tw.t / tw.sec;
        tw.fn(ease(k), k);
        if (k >= 1) { tweens.splice(i, 1); tw.res(); }
      }
    },
  };
}

/** Smoothly move the camera to a pose over duration, for cutscenes. */
export function cameraFly(camera, from, to, look, duration, clock) {
  let t = 0; const start = from.clone();
  const done = clock.wait(duration);
  const upd = (dt) => { t = Math.min(1, t + dt / duration); const e = t * t * (3 - 2 * t); camera.position.lerpVectors(start, to, e); camera.lookAt(look); };
  return { done, update: upd };
}

export function dist2(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; }

export function cleanup(scene) { disposeScene(scene); }

/** Interactable marker ring pulsing on the ground. */
export function makeMarker(color = 0xffd36b, r = 1.6) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.userData.update = (t) => { m.scale.setScalar(1 + Math.sin(t * 3) * 0.1); m.material.opacity = 0.5 + Math.sin(t * 3) * 0.3; };
  return m;
}

/** Floating label sprite made from canvas text. */
export function makeLabel(text, { color = '#ffd36b', size = 42, scale = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = `bold ${size}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 12;
  ctx.fillStyle = color; ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(scale, scale / 4, 1);
  return s;
}
