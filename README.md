# Skanda: The Six Faces — The Life of Lord Murugan

A cinematic 3D browser game that retells the life of **Lord Murugan** (Karthikeya, Skanda, Shanmukha, Subrahmanya) in six playable chapters — one for each of his six faces and each of his six holy abodes, the *Arupadai Veedu* of Tamil Nadu.

Built with [Three.js](https://threejs.org) and physically-based rendering: ACES tone mapping, a Rayleigh/Mie atmospheric sky that also lights the scene as an image-based environment, cascaded soft shadows, reflective water, bloom, FXAA and a film vignette. **Every model, texture and sound is generated procedurally at runtime** — the repository ships no binary art assets.

## Play

No build step. Serve the folder with any static file server and open `index.html`:

```bash
npm start            # python http.server on http://127.0.0.1:8080
# or
npx serve .
```

Then open <http://127.0.0.1:8080>. A WebGL 2 capable browser is required (Chrome, Edge, Firefox, Safari 16+).

### Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | `W A S D` / arrow keys | left half of screen (virtual stick) |
| Look | drag with the mouse | drag on the right half |
| Jump / climb (peacock) | `Space` | — |
| Sprint / dive (peacock) | `Shift` | — |
| Throw the Vel | click or `F` | tap on the right half |
| Interact / advance dialogue | `E` / `Space` / click | tap |
| Pause | `Esc` | — |

Quality (Ultra / High / Medium / Low) can be changed on the title screen; it controls shadow-map size, bloom, anti-aliasing, vegetation density and water reflection resolution. Progress is saved in the browser.

## The six chapters

| # | Place | Story | Gameplay |
| --- | --- | --- | --- |
| I | **Saravana Poigai** | Six sparks from Shiva's third eye fall into the lake of reeds; the Krittika maidens nurse six infants whom Parvati unites into the six-faced Shanmukha. | Guide the divine fire over a moonlit lake and gather the six sparks. |
| II | **Mount Kailash** | Parvati bestows the *Vel*, her own Shakti given form; the devas make Murugan their commander. | Target practice: master the returning Vel against floating asura shields before sunset. |
| III | **Swamimalai** | Brahma cannot explain *Om*; Murugan imprisons him and teaches the Pranava to his own father, Shiva, becoming *Swaminathan*. | Climb the spiral pilgrim steps, collect the three sounds A‑U‑M, then answer Shiva's questions. |
| IV | **Around the world / Palani** | The race for the fruit of wisdom against Ganesha; Murugan's retreat to Palani as the ascetic with the staff — *Pazham nee*, "you are the fruit". | Fly the peacock Paravani through the rings of the sky for three laps around Mount Meru. |
| V | **Thiruchendur** | *Soorasamharam*: six days of war, the fall of Tarakasura and Simhamukha, and Surapadman's transformation into a mango tree split by the Vel into peacock and rooster. | Wave-based combat with the Vel, two generals, and a shape-shifting boss. |
| VI | **Arupadai Veedu** | Deivanai and Valli, the two brides; Ganesha as the elephant; Nakkirar's six abodes. | Meet Valli in the millet field, then light the evening lamps of the six temples across an open world. |

## Project layout

```
index.html                 entry page, HUD and menus
src/main.js                boot, game loop, chapter flow, save state
src/story.js               narrative text for every chapter
src/engine/renderer.js     WebGL renderer + post-processing stack
src/engine/player.js       third-person controller, peacock flight, Vel projectile
src/engine/input.js        keyboard / mouse / touch
src/engine/audio.js        procedural WebAudio (tanpura drone, bells, SFX)
src/engine/ui.js           DOM overlays: dialogue, quiz, story cards
src/engine/textures.js     procedural canvas textures and normal maps
src/engine/noise.js        simplex noise / fBm
src/world/environment.js   sky, lighting, terrain, water, forests, grass, temples, lamps, particles
src/world/characters.js    rigged procedural deities, asuras, peacock, rooster, the Vel
src/chapters/ch*.js        the six chapters
vendor/three/              Three.js r170 (MIT) and the addons used, vendored for offline play
scripts/smoke.mjs          headless Playwright smoke test that loads every chapter
```

### Smoke test

```bash
npm install            # installs playwright (dev only)
npm start &            # serve on :8080
npm run test:smoke     # boots Chromium headless, loads all six chapters, reports console errors
npm run test:flow      # plays every chapter to its end screen through the chapters' debug hooks
```

## Sources

The narrative follows the *Skanda Purana* and the Tamil *Kanda Puranam* of Kachiyappa Sivachariar, with the Arupadai Veedu tradition of Nakkirar's *Thirumurugatrupadai*. Dialogue is an original dramatisation.
