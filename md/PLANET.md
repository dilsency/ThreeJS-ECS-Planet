# The planet — mesh (slice #1) & face data (slice #2)

> Scope: how the icosahedron planet is loaded, sized, shown, and torn down (**slice #1**,
> the mesh), and parsed into per-face gravity data (**slice #2**, `EntityComponentPlanetFaces`
> — a plain component **co-located on the planet entity**, alongside the mesh). Builds on the
> lazy model-loading decisions in `DATA_DRIVEN_WORLDS_AND_PREFABS.md` §8 and increments 2–3 of
> `ECS_CONVERSION_PLAN.md`.

---

## Slice #1 — `EntityComponentPlanetModel` (the mesh)

**Goal:** a visible, correctly-sized planet in a world, generated on confirm and disposed
on return-to-menu. **No gravity, no face logic yet** — the player still spawns on the flat
ground at a random X/Z; spawn-on-face is slice #2.

### Design (settled 2026-09-11)
- **Entity topology.** The `planet` entity carries `EntityComponentPlanetModel` (the mesh) and — from
  slice #2 — `EntityComponentPlanetFaces` (the surface / face data) as a **sibling on the same
  entity**. The face data is an *intrinsic facet of the planet*, not ambient state, so it is a
  plain component, **not** a Context, and it reads its sibling mesh directly via the shared entity
  (no `$ref` between them). See `NAMING_CONVENTIONS.md` §6, "Entity topology — co-locate a facet,
  isolate ambient state".
- **Folder / name.** `entity components/environment/planet.js` → `EntityComponentPlanetModel`
  (plain domain name; it's a scene object, not a Context/Manager/Controller).
- **Params (from world JSON).** `{ model: "Icosahedron", radius: <n>, color: "#FFFFFF" }`.
  `color` is per-world (default white, immaterial). Opt-in: a world without a planet just
  omits the entity.
- **Load — async, lazy, memoized via `SingletonContextModelCache`.** `async methodInitialize()` looks up
  the session-lived **`SingletonContextModelCache`** and `await`s `methodGetModelGeometry(model)`. That
  context owns the load (`modelRegistry[model]()` → `OBJLoader.loadAsync`) and **memoizes the
  unscaled geometry** in a `Map` keyed by model name. A world never picked never fetches its
  model; re-entry reuses the cached geometry. The planet imports neither `modelRegistry` nor
  `OBJLoader` — that's what keeps it out of the import cycle.
- **Per-world mesh.** `new THREE.Mesh(cachedGeometry, material)`, `mesh.scale.setScalar(radius)`,
  added to the world scene at the origin. Material: lit
  `MeshStandardMaterial({ color, flatShading: true })`, `castShadow`/`receiveShadow` on
  (facets must read distinctly for the gravity work later).
- **Dispose.** `scene.remove(mesh)` + dispose the **per-world material**; **never** dispose
  the cached geometry (it's a persistent asset — the kept-vs-disposable resource tiers of the
  deferred-deletion design).
- **Exposes** (for slice #2): `methodGetGeometry()` (the unscaled geometry) + `methodGetRadius()`
  (+ `methodGetPosition()` once the `position` param lands). The sibling `EntityComponentPlanetFaces`
  reads these directly off the same entity to build world-space face centers (`position + centroid ×
  radius`); face normals are scale-invariant under uniform scale.

### Runtime flow — data → class → instance → mesh

Generation is *generic*: the code never names the planet — **data** does. Two hops.

**1. How the entity is created** (declaration → instantiation):

```mermaid
flowchart TD
    A["worldDefault.json — data<br/>declares a 'planet' entity + params"]
    B["SingletonContextInitialization.methodConfirm()<br/>broadcasts 'initialization.confirmed'"]
    C["WorldGenerator.methodGenerate()<br/>loops worldRegistry[world].entities"]
    D["registry.js — entityComponentRegistry<br/>'EntityComponentPlanetModel' string → class"]
    E["new EntityComponentPlanetModel(params)<br/>attached → methodInitialize() runs"]
    A --> B --> C --> D --> E
```

**2. How the instance gets its mesh** (the component resolves its own asset via the cache context):

```mermaid
flowchart TD
    A["EntityComponentPlanetModel.methodInitialize()<br/>asks cache for model 'Icosahedron'"]
    B["SingletonContextModelCache.methodGetModelGeometry()<br/>memoized: load once, reuse"]
    C["registry.js — modelRegistry[name]()<br/>lazy dynamic import → asset URL"]
    D["assets/models/Icosahedron.obj<br/>OBJLoader.loadAsync → BufferGeometry"]
    E["Mesh built, scaled, added to scene<br/>per-world material; geometry cached"]
    A --> B --> C --> D --> E
```

**The seams:** the planet is named **by string in data**; the two **registries** are the only
string→real-thing bridges — `entityComponentRegistry` (string→class) and `modelRegistry`
(string→lazy asset URL). The generator instantiates; the instance self-resolves its geometry
through `SingletonContextModelCache`. (Pretty standalone copies live in the shared threejs notes folder:
`planet_generation_flow.svg` / `planet_model_resolution_flow.svg`.)

### Implementation steps → a visible planet
1. **Asset in place.** `assets/models/Icosahedron.obj` (ported from `dilsency/threejs`).
2. **`modelRegistry`** in `classes/loading-from-json/registry.js` — a **hand-listed** lazy map,
   one entry per model: `{ "Icosahedron": modelIcosahedron }`, where `modelIcosahedron()` returns
   `import('../../assets/models/Icosahedron.obj?url').then(m => m.default)`. (The `import.meta.glob`
   auto-collect form is the deferred scale-up — see `SCALE_WHEN_NEEDED.md`.)
3. **`EntityComponentSingletonContextModelCache`** in `entity components/context/singleton/context_model_cache.js` —
   owns the cache + the load: `modelRegistry[name]()` → `OBJLoader.loadAsync` (from
   `three/addons/loaders/OBJLoader.js`) → the first mesh's geometry, memoized in a `Map` keyed by
   model name. Built once at startup in `main.js` `initContextComponents()` as the
   `"SingletonContextModelCache"` entity (session-lived, never torn down).
4. **`EntityComponentPlanetModel`** in `entity components/environment/planet.js` — the design above;
   imports only `THREE` + `EntityComponent`, looks up `SingletonContextModelCache`, and `await`s the
   geometry (so it never imports `modelRegistry`/`OBJLoader` — no import cycle).
5. **Register** `EntityComponentPlanetModel` in `entityComponentRegistry`. (`SingletonContextModelCache` is a
   startup context — built in `main.js`, *not* registered here.)
6. **Data.** Add a `planet` entity to `worldDefault.json` (and `worldB.json`):
   `{ "name": "planet", "components": [ { "type": "EntityComponentPlanetModel",
   "params": { "model": "Icosahedron", "radius": 20, "color": "#FFFFFF" } } ] }`.
7. **Verify in-browser.** Menu → pick a world → a flat-shaded planet of that radius appears
   at the origin; walk near it; return-to-menu disposes it cleanly (no leak, background
   restored); re-enter reuses the cached geometry.

**Done when:** a visible, correctly-sized, lit planet renders in both worlds and survives a
menu↔world cycle cleanly. (Player-on-flat-ground is expected at this stage.)

---

## Slice #2 — `EntityComponentPlanetFaces` (co-located) + spawn-on-face

**Spec (settled 2026-09-15, revised same day — see "Topology decision").** Scope: **core +
spawn.** Parse the icosahedron into per-face data and spawn the player on a chosen face.
**Multi-planet-ready by design**, one planet authored for now.

**Deferred to the gravity slice** (see `SCALE_WHEN_NEEDED.md`): `getNearestFace`,
`isWithinFace`, the outer-wall planes, the `helper_mesh.js` port (its two bug-fixes —
`getNormalTriangleData` first-vertex, dead `getSignOfPointInTriangle` `return`), and
**orientation** (aligning "up" to the face normal). So in this slice the player spawns
*positioned* on a face but still world-Y up.

### Topology decision (why a co-located component, not a Context)
Face data is an **intrinsic facet of the planet** — its surface, where you stand, where gravity
pulls, where things spawn — not ambient state that floats above the world. So it is a **plain
`EntityComponent` co-located on the planet entity**, a *sibling* of `EntityComponent­Planet`, and
reads that mesh directly through their shared entity (`methodGetComponent`) — **no `$ref` between
them**. This is *not* a `Context`: the earlier "`MultiContextPlanetFaces` on its own entity" plan
was wrong — "read by other entities" is not what makes something a Context; **ownership** is, and
this data is owned by one planet. Full rationale: `NAMING_CONVENTIONS.md` §6 → "Entity topology".
Multi-planet still falls out for free: each planet entity carries its **own** faces sibling.

### Decisions
- **Icosahedron 1:1** — 20 triangles = 20 faces; no coplanar bucketing / normal-hash. A
  different flat-faced shape (dodecahedron) → a *separate* builder later, behind the same face
  interface (`SCALE_WHEN_NEEDED.md`).
- **The player's "active planet" reference is the planet _entity_** — the player `$ref`s that
  entity's `EntityComponentPlanetFaces` facet (cross-entity, so a `$ref` is right here). The
  future planet-switch mechanism re-points that reference at a different planet entity.
- **Naming:** the mesh component is **`EntityComponentPlanetModel`** (renamed from
  `EntityComponentPlanet` for symmetry with its sibling `EntityComponentPlanetFaces`); both live
  on the `planet` entity. File stays `environment/planet.js`.

### `EntityComponentPlanetFaces` (co-located on the `planet` entity, sibling of the mesh)
- **No `$ref` param** — it finds its mesh sibling on its own entity via `methodGetComponent(
  "EntityComponentPlanetModel")` (the shared parent entity). Optional `debug` param (default off).
- **Lazy parse** (`methodUpdate`): grab the mesh sibling; once its geometry is loaded
  (`methodGetGeometry()` non-null) parse **once**, set `#isReady`, then early-return forever.
- **Parse:** iterate triangles (`geometry.index` if present, else sequential position triples).
  Per face `i`: `centerLocal = (a+b+c)/3`; `normal = normalize(cross(b−a, c−a))`, flipped outward
  if `dot(normal, centerLocal) < 0` (convex mesh centered at origin — **no vertex normals**, so
  the buggy `getNormalTriangleData` is never needed). Store **world-space**
  `center = planetPosition + centerLocal × radius` (position/radius read off the mesh sibling).
- **Exposes:** `methodGetFaceCount()`, `methodGetFaceCenter(i)` (world), `methodGetFaceNormal(i)`,
  `methodGetIsReady()`.
- **Debug** (`debug`, default off): an `ArrowHelper` per face center along its normal; removed in
  `methodDispose`. **This is the browser-visible payoff of Piece 2** — 20 arrows out of the faces.
- **Dispose:** drop parsed arrays; remove debug arrows. (Per-world; swept on teardown.)

### `EntityComponentPlanetModel` — amendment
- Add a **`position` param** (default origin); mesh placed at `position`, scaled by `radius`, and
  exposed via `methodGetPosition()` so the faces sibling can build world-space centers.
  (Enables multiple planets at distinct spots.)

### `EntityComponentPlayerSpawnOnFace` (on the Player prefab)
- **Params:** `faces` = `$ref` → the planet entity's `EntityComponentPlanetFaces`; `spawnFaceIndex`
  (default 0); `spawnDistance` (default 2, world units along the normal).
- **Lazy one-shot** (`methodUpdate`): resolve the `faces` `$ref`; if not ready, return; once ready →
  `position = getFaceCenter(i) + getFaceNormal(i) × spawnDistance` → `methodSetPosition(position)`
  (broadcasts `update.position` to the camera rig) → set `#hasSpawned`; thereafter return.
- Coexists with the startup ground-spawn (`SingletonContextPlayerInitialization` → the camera
  controller): the player briefly sits at the ground X/Z, then snaps to the face once ready.

### Runtime chain (all lazy / guarded)
`PlayerSpawnOnFace` waits on `EntityComponentPlanetFaces.methodGetIsReady()` (resolved by `$ref`,
cross-entity) → which waits on its **sibling** `EntityComponentPlanetModel.methodGetGeometry()`
(same entity, direct `methodGetComponent`, async OBJ load) → which waits on
`SingletonContextModelCache`. Each hop is a `$ref`/null guard — no ordering assumptions.

### Data (per world, multi-planet-ready)
```jsonc
// The planet entity carries BOTH facets — mesh + faces — as siblings:
{ "name": "planet", "components": [
    { "type": "EntityComponentPlanetModel",
      "params": { "model": "Icosahedron", "radius": 20, "color": "#00FF00" } },
    { "type": "EntityComponentPlanetFaces",
      "params": { "debug": false } } ] },
// Player prefab gains PlayerSpawnOnFace; per-world overrideParams points at the planet's faces facet:
"EntityComponentPlayerSpawnOnFace": {
    "faces": { "$ref": { "entity": "planet", "component": "EntityComponentPlanetFaces" } },
    "spawnFaceIndex": 0, "spawnDistance": 2 }
```

### Registration
`EntityComponentPlanetFaces` + `EntityComponentPlayerSpawnOnFace` added to
`entityComponentRegistry` (both JSON-spawned). `PlayerSpawnOnFace` added to `data/prefabs/player.json`.

### `$ref` resolution
The **only** `$ref` in this slice is player → the planet's faces facet (cross-entity). It resolves
via the lazy dependency-resolution pattern: store the descriptor, each `methodUpdate` try
`methodGetEntityByName(ref.entity).methodGetComponent(ref.component)` until it succeeds, then cache.
The faces↔mesh link is **not** a `$ref` — same-entity siblings, direct `methodGetComponent`.
Hydration passes `$ref` through untouched (loader-side).

### Verify
Pick `spawnFaceIndex`; confirm the player spawns at that face's position. **Drop `radius` to
~3–5** to see the planet as a discrete object (at 20 the player spawns inside it → invisible
from inside). Turn `debug: true` to eyeball the parse (20 arrows). Return-to-menu tears down cleanly.

### Build order (each piece is browser-checkable)
1. `EntityComponentPlanetModel` `position` param → planet renders offset. 2. `EntityComponentPlanetFaces`
(co-located sibling, with `debug`) + register + add to the planet entity → 20 debug arrows.
3. `EntityComponentPlayerSpawnOnFace` + register + add to player prefab + world `overrideParams` →
player snaps to the chosen face. 4. Promote wiring to the real worlds; final verify.
