// Renderer + cinematic post-processing stack (bloom, FXAA, vignette, ACES).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

export const QUALITY = {
  ultra: { pixelRatio: Math.min(window.devicePixelRatio, 2), shadowMap: 4096, bloom: true, fxaa: true, grass: 1.0, trees: 1.0, water: 1024 },
  high:  { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadowMap: 2048, bloom: true, fxaa: true, grass: 0.6, trees: 0.8, water: 512 },
  medium:{ pixelRatio: 1, shadowMap: 1024, bloom: true, fxaa: false, grass: 0.3, trees: 0.6, water: 256 },
  low:   { pixelRatio: 0.75, shadowMap: 512, bloom: false, fxaa: false, grass: 0.1, trees: 0.4, water: 128 },
};

export class Renderer {
  constructor(canvas, qualityName = 'ultra') {
    this.canvas = canvas;
    this.qualityName = qualityName;
    this.q = QUALITY[qualityName];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.q.fxaa, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(this.q.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.scene = new THREE.Scene();

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.85);
    this.bloom.enabled = this.q.bloom;
    this.composer.addPass(this.bloom);

    this.fxaa = new ShaderPass(FXAAShader);
    this.fxaa.enabled = this.q.fxaa;
    this.composer.addPass(this.fxaa);

    this.vignette = new ShaderPass(VignetteShader);
    this.vignette.uniforms.offset.value = 1.05;
    this.vignette.uniforms.darkness.value = 1.15;
    this.composer.addPass(this.vignette);

    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.fxaa.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }

  setScene(scene) {
    this.scene = scene;
    this.renderPass.scene = scene;
  }

  setBloom(strength, radius, threshold) {
    this.bloom.strength = strength; this.bloom.radius = radius; this.bloom.threshold = threshold;
  }

  render() {
    this.composer.render();
  }
}
