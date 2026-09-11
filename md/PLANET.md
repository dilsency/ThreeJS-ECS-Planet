# The planet — mesh (slice #1) & face data (slice #2)

> Scope: how the icosahedron planet is loaded, sized, shown, and torn down (**slice #1**,
> the mesh), and — later — parsed into per-face gravity data (**slice #2**,
> `ContextPlanetFaces`, deferred). Builds on the lazy model-loading decisions in
> `DATA_DRIVEN_WORLDS_AND_PREFABS.md` §8 and increments 2–3 of `ECS_CONVERSION_PLAN.md`.

---

## Slice #1 — `EntityComponentPlanet` (the mesh)

**Goal:** a visible, correctly-sized planet in a world, generated on confirm and disposed
on return-to-menu. **No gravity, no face logic yet** — the player still spawns on the flat
ground at a random X/Z; spawn-on-face is slice #2.

### Design (settled 2026-09-11)
- **Entity topology.** A `planet` entity carries **only** `EntityComponentPlanet`. The face
  data (`ContextPlanetFaces`, slice #2) is a **separate** Context entity — never a sibling
  (see `NAMING_CONVENTIONS.md` §6, "Context components live alone on their own entity").
- **Folder / name.** `entity components/environment/planet.js` → `EntityComponentPlanet`
  (plain domain name; it's a scene object, not a Context/Manager/Controller).
- **Params (from world JSON).** `{ model: "Icosahedron", radius: <n>, color: "#FFFFFF" }`.
  `color` is per-world (default white, immaterial). Opt-in: a world without a planet just
  omits the entity.
- **Load — async, lazy, memoized.** `async methodInitialize()`:
  `await modelRegistry[model]()` → `OBJLoader.load(url)`; the parsed **geometry is memoized
  unscaled** (module-level, keyed by model name). A world never picked never fetches its
  model; re-entry reuses the cached geometry.
- **Per-world mesh.** `new THREE.Mesh(cachedGeometry, material)`, `mesh.scale.setScalar(radius)`,
  added to the world scene at the origin. Material: lit
  `MeshStandardMaterial({ color, flatShading: true })`, `castShadow`/`receiveShadow` on
  (facets must read distinctly for the gravity work later).
- **Dispose.** `scene.remove(mesh)` + dispose the **per-world material**; **never** dispose
  the cached geometry (it's a persistent asset — the kept-vs-disposable resource tiers of the
  deferred-deletion design).
- **Exposes** (for slice #2): `methodGetGeometry()` (the unscaled geometry) + `methodGetRadius()`.
  `ContextPlanetFaces` will multiply face centers by `radius` for world space; face normals
  are scale-invariant under uniform scale.

### Implementation steps → a visible planet
1. **Asset in place.** `assets/models/Icosahedron.obj` (ported from `dilsency/threejs`).
2. **`modelRegistry`** in `classes/loading-from-json/registry.js`:
   `import.meta.glob('../../assets/models/*.obj', { query: '?url', import: 'default', eager: false })`,
   re-keyed from the glob's full paths to bare model names (basename, no extension), exported.
3. **`EntityComponentPlanet`** in `entity components/environment/planet.js` — the design above.
   `OBJLoader` from `three/addons/loaders/OBJLoader.js`; a module-level `#geometryCache`
   (name → `Promise<BufferGeometry>`) memoizes the load.
4. **Register** `EntityComponentPlanet` in `entityComponentRegistry`.
5. **Data.** Add a `planet` entity to `worldDefault.json` (and `worldB.json`):
   `{ "name": "planet", "components": [ { "type": "EntityComponentPlanet",
   "params": { "model": "Icosahedron", "radius": 20, "color": "#FFFFFF" } } ] }`.
6. **Verify in-browser.** Menu → pick a world → a flat-shaded planet of that radius appears
   at the origin; walk near it; return-to-menu disposes it cleanly (no leak, background
   restored); re-enter reuses the cached geometry.

**Done when:** a visible, correctly-sized, lit planet renders in both worlds and survives a
menu↔world cycle cleanly. (Player-on-flat-ground is expected at this stage.)

---

## Slice #2 — `ContextPlanetFaces` (deferred)

The per-face parse (normal-hash buckets → normal / center / outer-walls), `getNearestFace` /
`isWithinFace`, world-space centers via `radius`, and the `helper_mesh.js` port with its two
bug fixes (`getNormalTriangleData` only writing its first vertex; the dead
`getSignOfPointInTriangle` `return`). Mostly maths — brainstormed separately, once slice #1
is on screen.
