// DOM overlay: HUD, dialogue, quiz, story cards. Everything the 3D scene
// cannot express is written here.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), chapterLabel: $('chapter-label'), objective: $('objective'), counter: $('counter'),
      healthWrap: $('health-wrap'), health: $('health'), timer: $('timer'), hint: $('hint'), crosshair: $('crosshair'),
      dialogue: $('dialogue'), dSpeaker: $('dialogue-speaker'), dText: $('dialogue-text'),
      quiz: $('quiz'), quizQ: $('quiz-q'), quizOpts: $('quiz-options'),
      overlay: $('overlay'), title: $('title-screen'), chapters: $('chapter-screen'), card: $('card-screen'),
      pause: $('pause-screen'), end: $('end-screen'), fade: $('fade'), loading: $('loading'), error: $('error-box'),
    };
    this._hintTimer = null;
    this._dialogueResolve = null;
    this._typing = null;
    this.el.dialogue.addEventListener('click', () => this.advanceDialogue());
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && !this.el.dialogue.classList.contains('hidden')) {
        e.preventDefault(); this.advanceDialogue();
      }
    });
  }

  showPanel(name) {
    for (const k of ['title', 'chapters', 'card', 'pause', 'end']) this.el[k].classList.toggle('hidden', k !== name);
    this.el.overlay.classList.toggle('hidden', !name);
  }

  hud(show) { this.el.hud.classList.toggle('hidden', !show); }
  chapterLabel(t) { this.el.chapterLabel.textContent = t; }
  objective(t) { this.el.objective.textContent = t; }
  counter(t) { this.el.counter.textContent = t; }
  timer(t) { this.el.timer.classList.toggle('hidden', t == null); if (t != null) this.el.timer.textContent = t; }
  crosshair(show) { this.el.crosshair.classList.toggle('hidden', !show); }
  health(frac) {
    this.el.healthWrap.classList.toggle('hidden', frac == null);
    if (frac != null) this.el.health.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }
  hint(text, ms = 3500) {
    clearTimeout(this._hintTimer);
    this.el.hint.textContent = text;
    this.el.hint.classList.add('show');
    if (ms > 0) this._hintTimer = setTimeout(() => this.el.hint.classList.remove('show'), ms);
  }
  hideHint() { this.el.hint.classList.remove('show'); }

  fade(toBlack) { this.el.fade.classList.toggle('clear', !toBlack); }

  /** Show a sequence of {speaker, text} lines; resolves when done. */
  async dialogue(lines) {
    for (const line of lines) await this._say(line.speaker, line.text);
    this.el.dialogue.classList.add('hidden');
  }

  _say(speaker, text) {
    return new Promise((resolve) => {
      this.el.dialogue.classList.remove('hidden');
      this.el.dSpeaker.textContent = speaker;
      this.el.dText.textContent = '';
      let i = 0;
      clearInterval(this._typing);
      this._fullText = text;
      this._typing = setInterval(() => {
        i += 2;
        this.el.dText.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(this._typing); this._typing = null; }
      }, 16);
      this._dialogueResolve = resolve;
    });
  }

  advanceDialogue() {
    if (this._typing) { clearInterval(this._typing); this._typing = null; this.el.dText.textContent = this._fullText; return; }
    if (this._dialogueResolve) { const r = this._dialogueResolve; this._dialogueResolve = null; r(); }
  }

  /** Multiple-choice question: resolves with chosen index. */
  quiz(question, options) {
    return new Promise((resolve) => {
      this.el.quiz.classList.remove('hidden');
      this.el.quizQ.textContent = question;
      this.el.quizOpts.innerHTML = '';
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.textContent = o;
        b.addEventListener('click', () => { this.el.quiz.classList.add('hidden'); resolve(i); });
        this.el.quizOpts.appendChild(b);
      });
    });
  }

  card(place, title, storyHtml, objective) {
    $('card-place').textContent = place;
    $('card-title').textContent = title;
    $('card-story').innerHTML = storyHtml;
    $('card-objective').textContent = objective;
    this.showPanel('card');
    return new Promise((resolve) => { $('btn-card-go').onclick = () => { this.showPanel(null); resolve(); }; });
  }

  endScreen(html, hasNext) {
    $('end-text').innerHTML = html;
    $('btn-next').classList.toggle('hidden', !hasNext);
    this.showPanel('end');
  }

  error(msg) { this.el.error.classList.remove('hidden'); this.el.error.textContent = msg; }
}
