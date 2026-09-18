// Entry point: boots the renderer, wires the menus and runs the chapter loop.
import * as THREE from 'three';
import { Renderer, QUALITY } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { UI } from './engine/ui.js';
import { STORY } from './story.js';
import { cleanup } from './chapters/base.js';
import { preloadModels } from './world/models.js';

const CHAPTERS = [
  () => import('./chapters/ch1_birth.js'),
  () => import('./chapters/ch2_vel.js'),
  () => import('./chapters/ch3_pranava.js'),
  () => import('./chapters/ch4_fruit.js'),
  () => import('./chapters/ch5_surapadman.js'),
  () => import('./chapters/ch6_abodes.js'),
];

const QUALITY_ORDER = ['ultra', 'high', 'medium', 'low'];
const store = {
  get(k, d) { try { const v = localStorage.getItem('skanda.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('skanda.' + k, JSON.stringify(v)); } catch (_) {} },
};

class Game {
  constructor() {
    this.ui = new UI();
    this.canvas = document.getElementById('game');
    const params = new URLSearchParams(location.search);
    this.qualityName = params.get('quality') || store.get('quality', this._autoQuality());
    this.ui.el.loading.textContent = 'Kindling the sacred fire…';
    try {
      this.renderer = new Renderer(this.canvas, this.qualityName);
    } catch (e) {
      this.ui.error('WebGL could not be initialised. This game needs a browser with WebGL 2 and hardware acceleration.\n' + e.message);
      throw e;
    }
    this.input = new Input(this.canvas);
    this.audio = new Audio();
    this.clock = new THREE.Clock();
    this.current = null; this.chapterIndex = -1; this.paused = false; this.time = 0;
    this.progress = store.get('progress', []);
    this._bindMenus();
    this.ui.el.loading.textContent = 'Looking for character models…';
    preloadModels().then((r) => { this.ui.el.loading.textContent = r.models.length ? `Real models: ${r.models.join(', ')}` : ''; }).catch(() => { this.ui.el.loading.textContent = ''; });
    this.ui.showPanel('title');
    this.ui.fade(false);
    this._loop();
    window.addEventListener('error', (e) => this.ui.error(`Error: ${e.message}`));
    window.addEventListener('unhandledrejection', (e) => this.ui.error(`Error: ${e.reason?.stack || e.reason}`));
  }

  _autoQuality() {
    const cores = navigator.hardwareConcurrency || 4;
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mobile) return 'medium';
    if (cores >= 8) return 'ultra';
    return 'high';
  }

  _bindMenus() {
    const $ = (id) => document.getElementById(id);
    const qBtn = $('btn-quality');
    const showQ = () => { qBtn.textContent = `Quality: ${this.qualityName[0].toUpperCase()}${this.qualityName.slice(1)}`; };
    showQ();
    qBtn.onclick = () => {
      const i = (QUALITY_ORDER.indexOf(this.qualityName) + 1) % QUALITY_ORDER.length;
      this.qualityName = QUALITY_ORDER[i]; store.set('quality', this.qualityName); showQ();
      // the renderer is built once per page, so a quality change reloads the page
      location.search = `?quality=${this.qualityName}`;
    };
    $('btn-start').onclick = () => { this.audio.resume(); const next = this.progress.length < STORY.length ? Math.max(0, Math.min(this.progress.length, STORY.length - 1)) : 0; this.startChapter(next); };
    $('btn-chapters').onclick = () => { this._renderChapterList(); this.ui.showPanel('chapters'); };
    $('btn-back').onclick = () => this.ui.showPanel('title');
    $('btn-resume').onclick = () => this.togglePause(false);
    $('btn-restart').onclick = () => { this.togglePause(false); this.startChapter(this.chapterIndex); };
    $('btn-menu').onclick = () => this.toMenu();
    $('btn-end-menu').onclick = () => this.toMenu();
    $('btn-next').onclick = () => this.startChapter(this.chapterIndex + 1);
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || !this.current) return;
      const overlayHidden = this.ui.el.overlay.classList.contains('hidden');
      if (overlayHidden) this.togglePause(true);
      else if (this.paused) this.togglePause(false);
    });
  }

  _renderChapterList() {
    const list = document.getElementById('chapter-list');
    list.innerHTML = '';
    STORY.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'chapter-item' + (this.progress.includes(i) ? ' done' : '');
      d.innerHTML = `<div class="n">Chapter ${s.n}</div><div class="t">${s.title}</div><div class="p">${s.place}</div>`;
      d.onclick = () => { this.audio.resume(); this.startChapter(i); };
      list.appendChild(d);
    });
  }

  togglePause(p) {
    if (!this.current) return;
    this.paused = p; this.input.enabled = !p;
    this.ui.showPanel(p ? 'pause' : null);
  }

  async toMenu() {
    await this.unload();
    this.ui.hud(false); this.ui.showPanel('title');
  }

  async unload() {
    if (this.current) {
      try { this.current.handle?.dispose?.(); } catch (e) { console.warn(e); }
      cleanup(this.renderer.scene);
      this.current = null;
    }
    this.ui.el.dialogue.classList.add('hidden'); this.ui.el.quiz.classList.add('hidden');
    this.ui.timer(null); this.ui.health(null); this.ui.hideHint();
    this.input.enabled = true; this.paused = false;
  }

  async startChapter(i) {
    if (i >= STORY.length) { this.toMenu(); return; }
    const story = STORY[i];
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, 400));
    await this.unload();
    this.ui.showPanel(null);
    this.ui.hud(false);
    // story card first: it hides the empty scene while the chapter builds
    const cardDone = this.ui.card(`Chapter ${story.n} · ${story.place}`, story.title, story.story, story.objective);
    this.chapterIndex = i;
    const token = {}; this.loadToken = token;
    let handle;
    try {
      const mod = await CHAPTERS[i]();
      const ctx = {
        renderer: this.renderer, input: this.input, audio: this.audio, ui: this.ui, quality: QUALITY[this.qualityName],
        complete: () => this.completeChapter(i),
      };
      this.input.enabled = false;
      handle = await mod.create(ctx);
    } catch (e) {
      console.error(e); this.ui.error(`Chapter failed to load: ${e.stack || e}`); return;
    }
    if (this.loadToken !== token) return;
    this.current = { handle, index: i };
    this.renderer.resize();
    this.ui.fade(false);
    await cardDone;
    this.audio.resume();
    this.input.enabled = true;
    this.ui.hud(true);
  }

  async completeChapter(i) {
    if (!this.progress.includes(i)) { this.progress.push(i); store.set('progress', this.progress); }
    this.input.enabled = false;
    this.ui.hud(false);
    this.ui.endScreen(STORY[i].end, i + 1 < STORY.length);
    document.getElementById('btn-next').textContent = i + 1 < STORY.length ? `Next: ${STORY[i + 1].title}` : 'Next chapter';
  }

  _loop() {
    const frame = () => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (this.current && !this.paused) {
        this.time += dt;
        try { this.current.handle.update(dt, this.time); }
        catch (e) { console.error(e); this.ui.error(`Runtime error: ${e.stack || e}`); this.current = null; }
      }
      this.input.flush();
      this.renderer.render();
    };
    frame();
  }
}

window.game = new Game();
