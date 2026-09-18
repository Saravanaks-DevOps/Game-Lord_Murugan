# Real 3D characters (optional)

Drop rigged **GLB** files here and the game uses them instead of the procedural
figures. Missing files fall back to the built-in models, so you can add
characters one at a time.

| File | Replaces |
| --- | --- |
| `murugan.glb` | Lord Murugan (the player) |
| `parvati.glb` | Parvati |
| `shiva.glb` | Shiva |
| `ganesha.glb` | Ganesha |
| `valli.glb` | Valli |
| `deivanai.glb` | Deivanai |
| `surapadman.glb` | Surapadman (boss) |
| `asura.glb` | generic asura soldiers |
| `brahma.glb` | Brahma |
| `peacock.glb` | the peacock Paravani (optional) |

Reference face images can go in `assets/refs/<name>.jpg` (or .png / .webp).
They are projected onto the procedural head as an interim upgrade until a real
model exists for that character.

Optionally list what you added in `assets/manifest.json` so the game does not
probe for every possible file (this only removes 404 lines from the console):

```json
{ "characters": ["murugan", "asura"], "refs": ["brahma.jpg"] }
```

## Requirements

- Format: `.glb` (binary glTF 2.0). Draco-compressed meshes are supported.
- Facing **+Z**, standing on the ground, any scale (the game rescales to height).
- Rigged with a humanoid skeleton. Mixamo rigs work out of the box: the right
  hand bone (`mixamorigRightHand`) receives the Vel or mace, the head bone
  receives effects.
- Animations embedded in the same GLB, named with any of these words
  (case-insensitive): `idle`, `walk`, `run`, `throw`/`attack`, `fly`/`jump`,
  `meditate`/`sit`, `bless`/`wave`. Missing clips fall back to `idle`.
- Materials: PBR (metallic/roughness). Name skin materials with `skin` or
  `face` and gold with `gold`/`metal` to get the tuned shaders.
- Keep each file under ~20 MB (2k textures, 30k–80k triangles).

## Suggested workflow

1. Generate or buy a model (Meshy / Tripo3D / Rodin from a reference image,
   or Sketchfab / CGTrader with a suitable license).
2. Upload to [Mixamo](https://www.mixamo.com) → auto-rig → download the
   character with animations *Idle*, *Walking*, *Running*, *Throw* and
   *Falling Idle* (fly). Export as FBX, convert to GLB (Blender: File → Import
   FBX, File → Export glTF 2.0, tick *Animation*), or download directly as
   glTF where offered.
3. Name the file as in the table above and place it in this folder.
4. Keep the model's license text next to it (`murugan.LICENSE.txt`).
