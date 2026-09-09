# Plan of approach — data-driven Worlds & prefabs (JSON)

> Scope: how the ECS Planet project will define **Worlds** (scenes) and **prefabs**
> (reusable entity blueprints) as **JSON data**, loaded at world-generation time.
> This supersedes the earlier "per-World code populate hook" sketch discussed for
> the generator (see `ECS_CONVERSION_PLAN.md`, the generation increments). It sits
> underneath the MainMenu → confirm → generate flow: `ContextInitialization` holds
> the available Worlds, and the world **generator becomes a JSON loader**.
>
> Cross-project note: this is project-specific for now. If a second project adopts
> the same prefab/World loader, distil the reusable parts into a shared doc under
> `~/Syncthing/🗣️ claude conversations/threejs/` (see the shared-docs convention).

---

## 1. Why (the motivating requirements)

From the design discussion:

- **Presets represent Worlds.** A MainMenu preset isn't just a bag of scalars — it
  stands for a whole World the player can select (level-select / "World 2").
- **Different Worlds have different entity rosters**, not just different parameter
  values on a fixed roster. Hardcoding every possible entity behind a per-entity
  `if(preset.hasX)` flag does **not** scale — the roster is *World-owned data*, not
  generator-owned code.
- **Entities recur across Worlds.** A Player almost always has the same set of
  components. That default component set should be authored **once** and reused —
  i.e. a **prefab**.

So the target is the standard **prefab + scene** model:

- **Prefab** — "what a Player *is*": a named, reusable bundle of components + their
  default params. Reused across Worlds.
- **World (scene)** — "what exists in *this* World": a list of entities, each either
  an inline component set or a **prefab reference + overrides**, plus World-level
  params (planet size, etc.).

---

## 2. The hard boundary: static data vs. live/computed values

JSON cleanly expresses **structure + static params**. It **cannot** express three
things, and the loader exists precisely to bridge them:

1. **Types are strings.** `"type": "EntityComponentDirectionalLight"` needs a
   **component registry** mapping the string to the actual class. This replaces
   main.js's explicit per-class imports with a single lookup table.
2. **Rich param types.** `THREE.Vector3`, colors, etc. need **hydration** from a
   JSON-friendly form. Use **tagged values** (explicit), never magic auto-detection:
   - `{"$vec3":[x,y,z]}` → `new THREE.Vector3(x,y,z)`
   - `{"$vec2":[x,y]}` → `new THREE.Vector2(x,y)`
   - `"0xffff00"` (or `{"$color":"#ffff00"}`) → a color
   - plain scalars/strings/bools pass through untouched
3. **Live cross-entity references and runtime-computed params.** JSON can't hold a
   live object — but it can hold a **name**, and the *component itself* resolves that
   name to the live object at update-time (see "Lazy dependency resolution" below).
   Computed params (e.g. the HUD cube's layout, derived from `cameraHUD`'s projection
   at runtime) are produced by **code** — a builder hook — not authored as data.
   - by-name reference (a plain, serializable param the component knows how to resolve):
     `{"$ref":{"entity":"sun","component":"EntityComponentDirectionalLight"}}`

**Consequence — the loader stays single-phase.** Because components self-resolve their
own deferred dependencies (next section), the loader does **not** need a second
"resolve/wire" pass, and there is **no immediate-`methodInitialize()` ordering problem**
to work around: a component's `methodInitialize()` just stashes the *name*; nothing it
depends on has to exist yet. The loader only ever:

```
instantiate   create entities, hydrate static params, attach components,
              run builder hooks for computed entities
              → record every created entity in #listSpawnedEntities
```

## Lazy dependency resolution (a general ECS capability)

A component may be **constructed with an unresolved reference** and **resolve it at
runtime**, rather than requiring every dependency to exist at construction time. The
JSON loader is one beneficiary (it turns a by-name param into a live object with no
loader phase-2 and no construction-order guarantees), but the capability **stands on
its own** — it is general ECS architecture, useful even if we never adopt JSON, and a
**standing design goal to keep open**: don't write components that *assume* a
dependency exists at construction — store the name, guard the usage, resolve when
available. The HUD/`sun` pairing is just the **first** concrete case; it already
matches the grain of the codebase — the HUD's `EntityComponentLightManager` fetches its
target cube fresh each frame until it exists ("the mesh loads asynchronously ... fetch
it fresh rather than caching it").

> The **general form** of this pattern now lives in the shared
> `ECS_DESIGN_PATTERNS_THREEJS.md` → "Resolving a dependency that doesn't exist yet
> (lazy/deferred)". The section below is the ECS-Planet-specific application (the
> HUD/`sun` pairing, the JSON `$ref` param shape).

The contract:

- **By-name in, live-object cached.** The component receives a *name* (or `$ref`
  descriptor) as a plain param and, each `methodUpdate()`, resolves it via
  `methodGetEntityByName(...).methodGetComponent(...)` **until it succeeds**, then
  caches the result and stops searching.
- **Resolved ≠ done.** "Stop looking" means stop *searching*, not stop *using*:
  - **one-shot** deps (a computed layout value) → resolve once, apply once, done;
  - **continuously-live** deps (the sun the HUD light tracks) → resolve once, then
    keep *reading* the cached reference every frame.
- **Invalidate on `toBeDeleted`, then re-resolve.** A cached reference can go stale
  when its target is torn down. Each frame, before using it, check the target's
  deletion flag; if set, drop the cached pointer and resume searching (which naturally
  picks up a freshly-generated replacement). Invalidate on *flagged*, not on
  *disposed* — a flagged object is "gone" immediately (hidden + inert), disposal is
  deferred to the end-of-frame sweep. Uses the same `toBeDeleted` signal the
  deferred-deletion system already emits (see `ECS_CONVERSION_PLAN.md`); this is
  increment-4 machinery, so until it exists the invalidation guard is a harmless no-op.
- **Throttle is optional.** These deps resolve within a frame or a few, and a name
  lookup is a cheap `find` over a small array, so a plain per-frame null-guard is
  enough. Add a throttle only for a dependency that can be *absent for a long time*.
- **Bare-minimum objects are exempt.** `camera`/`cameraHUD`/`cameraPivot`/`scene` etc.
  are reachable from `methodInitialize()` via the typed `methodGetCamera*()` accessors
  and already exist (EngineContext is built first). Lazy resolution is only for
  **sibling/other-entity components and async meshes**.

---

## 3. Which current entities fit (hybrid, on purpose)

- **Easy / pure-data → JSON:** `sun` (directional light + sky cube), `player`,
  `pointerLockButton`. These move to JSON almost as-is. (`pointerLockButton`'s
  `document` param is environmental — injected by the loader, not authored in JSON.)
- **Hard / code builder hook → still part of the World:** the HUD trio
  (`EntityComponentContextHUDLayout` → panel → cube → `EntityComponentLightManager`).
  Its params are **computed** from `cameraHUD`'s projection and it is cross-wired, so
  it isn't authored as flat params — but it **is World-scoped** (see below), so the
  World JSON names it as a **builder** entry and the loader calls a registered code
  function to build it: `{ "name": "hud", "builder": "buildHUD" }`.

**Design stance: declarative where it's static, code where it's computed** — one clean
seam (`"components"` vs `"builder"`), both inside the same World load. Don't promise
100% declarative.

**The HUD is World-scoped, not menu-persistent** (decision 2026-09-08, reversing the
earlier "load the HUD on the MainMenu" idea). It's generated on confirm with the rest
of the World and **destroyed on return-to-menu** along with it. Consequence: the
cross-World stale-reference problem *disappears* — the HUD's `LightManager` and the
`sun` it tracks are created and torn down **together**, so no persistent consumer ever
holds a pointer to a destroyed sun across Worlds. Lazy resolution (previous section) is
still used — for **ordering-independence within a single World load** (the sun may not
exist yet when the HUD builds) — and its `toBeDeleted` invalidation guard stays correct
but is no longer load-bearing for the HUD case.

---

## 4. Schema sketch

### Prefab (`data/prefabs/<name>.json`)
```jsonc
{
  "prefab": "Player",
  "components": [
    { "type": "EntityComponentCameraControllerFirstPerson" },
    { "type": "EntityComponentPlayerController" }
  ]
}
```

### World (`data/worlds/<name>.json`)
```jsonc
{
  "name": "default",
  "entities": [
    { "name": "player", "prefab": "Player",
      "overrides": {
        "EntityComponentPlayerController": { "spawnFaceIndex": 0, "spawnOffsetVertical": 1.0 }
      }
    },
    { "name": "sun", "components": [
      { "type": "EntityComponentDirectionalLight",
        "params": { "position": {"$vec3":{"x":5,"y":8,"z":5}}, "target": {"$vec3":{"x":0,"y":0,"z":0}} } },
      { "type": "EntityComponentTestCube",
        "params": { "positionOffset": {"$vec3":{"x":5,"y":8,"z":5}}, "color1": "#ffff00" } }
    ]},
    { "name": "pointerLockButton",
      "components": [ { "type": "EntityComponentButtonPointerLock" } ] }
  ]
}
// The `player` entry above shows the step-2 prefab form; step 1's default.json
// inlines its two components instead. Top-level `name` identifies the World (the
// "world" is implied by the data/worlds/ folder). The visible cube colour is
// `color1` (fed to MeshStandardMaterial) — `color2` is currently inert.
```

### Entity entry — three mutually-exclusive forms
- **`"prefab": <name>` (+ optional `"overrides"`)** — instantiate the prefab's
  component set, then deep-merge overrides on top (see merge rules below).
- **`"components": [...]`** — inline component list (no prefab).
- **`"builder": <name>`** — hand off to a registered code function (the escape hatch
  for computed/cross-wired entities).

### Override / merge rules (to pin down before implementing)
- Overrides are keyed by **component type name**; each maps to a params object.
- Merge is a **shallow per-component param merge** (world params win over prefab
  defaults) — start shallow; only go deep-merge if a real nested-param case appears.
- Overriding a component the prefab doesn't have: **add it** (prefab set ∪ overrides).
- Removing a prefab component: out of scope for v1 (add a `"remove": [...]` list later
  only if needed).

---

## 5. Loader responsibilities (the generator, data-driven)

The world generator becomes the **loader**. It owns *mechanism*, never *content*:

> The *why* of the registry + hydration (turning JSON strings into classes, and JSON
> values into live `THREE.*` types) is written up generally in the shared
> `registry and hydration - turning strings into classes.md`. This section is the
> ECS-Planet-specific loader.

- **Component registry** — `{ typeName: class }`, in a **dedicated `registry.js`**
  (not folded into the loader) — the single file that imports every gameplay component
  class.
- **Builder registry** — `{ builderName: fn(loaderContext) }` for code-hook entities.
- **Param hydration (loader-side)** — recursively walk a params object; a node with a
  `$`-prefixed key is a reserved **tag**: `$vec3` → `new THREE.Vector3(x,y,z)` from a
  `{x,y,z}` object; `$ref` → **passed through untouched** (the component resolves it,
  not the loader); any other `$…` key → **throw**. Non-tag objects/arrays recurse.
  Hydrating loader-side means components receive live `THREE.*` types, identical
  whether built from code or JSON. **Colors need no tag** — authored as CSS-hex
  strings (`"#ffff00"`) the component hands straight to `THREE.Color`. Tag set for now
  is **just `$vec3`** (grow it when a later entity needs `$vec2`/etc.).
- **Instantiate (single pass)** — for each World entity: either resolve prefab (if
  any) + merge overrides and instantiate its components (hydrate params,
  `new <class>(params)`, attach), or call its **builder** hook for computed entities;
  push the entity onto **`#listSpawnedEntities`**. There is no second "resolve/wire"
  pass — components self-resolve their own by-name deps lazily (see Lazy dependency
  resolution).
- **Environment injection** — supply non-authored params like `document`.
- **Teardown (`methodTeardown`)** — iterate **`#listSpawnedEntities`** and remove +
  dispose each (roster-agnostic *by construction* — this is why the tracking list is
  built from day one, even though full disposal lands at increment 4). Keeps shared
  loaded assets (planet geometry) per the deferred-deletion design.

Triggering (Option B messaging, already in place): `ContextInitialization` broadcasts
`initialization.confirmed` → loader `methodGenerate()`, and
`initialization.returnedToMenu` → loader `methodTeardown()`. `ContextInitialization`
adds the generator's component as a second capability-target alongside the existing
`EntityComponentMainMenu` one.

---

## 6. Two concrete steers

- **Import the JSON, don't fetch it.** `import worldDefault from "./data/worlds/default.json"`
  — Vite bundles it: no async, no base-path handling. Fetching from `public/`
  reintroduces the exact `%BASE_URL%`/base-path pain already fought with the PWA
  manifest (see `GOTCHAS.md` / the manifest double-base note). Switch to runtime
  `fetch` only if Worlds must be user-editable/hot-loaded later.
- **`ContextInitialization` evolves, it is not replaced.** Its `InitPreset`
  data-class becomes "a loaded World definition"; its list of presets becomes a list
  of imported Worlds. The MainMenu → confirm → generate flow is unchanged — only the
  *source* of the data moves from hardcoded objects to JSON.

---

## 7. Staged adoption (fits the 0–10 increment cadence)

Build the spine first, layer richness after. Each step builds & runs on its own.

1. **Registry + minimal loader.** One flat World JSON (`default.json`) holding only
   the **easy** entities (sun, player, button) — no prefabs, no `$ref`, no overrides,
   no HUD yet. Prove: confirm → loader reads the World → spawns the three entities →
   menu hides. *(This is the recommended increment-2 line.)*
2. **Prefabs + overrides.** Extract `data/prefabs/player.json`; both Worlds reference
   it; the second World overrides the player's spawn transform. Add the override merge.

   **Two ways to avoid repeating entities across worlds:**
   - **Prefab + overrides** — for entities that *vary per world*: define the component
     set once in `data/prefabs/`, reference it by name, and specify only what differs
     (e.g. the sun's per-world position). One line + the diff, not a re-definition.
   - **Base / shared set** — for entities *identical in every world* (e.g. the
     pointer-lock button): the generator spawns a common set automatically, so a world
     file declares only what's *unique* to it and never lists the shared ones at all
     ("base world merged with this world").

   Rule of thumb: **varies per world → prefab + override; identical everywhere → base
   set.**
3. **Lazy self-resolution + the HUD builder hook.** Give components by-name deps
   (`LightManager.source` as a `$ref` the component resolves itself, per Lazy
   dependency resolution — no loader wiring). Fold the **HUD** in as a `"builder"`
   entity of the World load (it moved off the menu). Full param hydration coverage.
4. **Multiple Worlds in the menu.** `ContextInitialization` loads a list of World
   JSONs; MainMenu lists them; confirm loads the chosen one; return-to-menu tears it
   down (depends on increment-4 deferred deletion for real disposal).

   **How worlds get imported (don't accumulate N imports in the generator):**
   - **Worlds index module** — one file maps `name → imported JSON`; the generator
     imports that map and loads the *chosen* world by name. Simple; every world is
     bundled.
   - **`import.meta.glob("../../data/worlds/*.json")`** (Vite) — auto-collects every
     world file, no hand-listing. *Eager* = all bundled; *lazy* = each world is a
     dynamic import fetched only when selected (preferable once there are many).

   Either way the generator loads the single world `ContextInitialization` selects —
   never a pile of hardcoded `import` lines. (Step 1's lone `default.json` import is
   fine until then.)

Later / only-if-needed: nested prefabs, component removal in overrides, runtime
`fetch` for user-authored Worlds, hardening a subset of params into a stricter schema
for a level editor.

---

## 8. Decisions & remaining open questions

**Decided (2026-09-08):**
- **Tag strategy: A — self-describing tags** (`{"$vec3":…}`), not a per-component
  schema. Verbosity + a forgettable tag are acceptable; no schema to keep in sync.
- **Hydration is loader-side**, recursive, and **throws on an unknown `$`-tag**.
- **`$vec3` payload is a `{x,y,z}` object** (reads more three.js than `[x,y,z]`).
- **Colors: no tag** — CSS-hex strings (`"#ffff00"`) passed to `THREE.Color` (so
  `EntityComponentTestCube`'s color param accepts a string; note the visible colour is
  `color1` → `MeshStandardMaterial`, `color2` is currently inert). This keeps the tag
  set to **just `$vec3`** for now.
- **All spatial triples are `$vec3`** — including `positionOffset`, which hydrates to a
  `Vector3` the component reads `.x/.y/.z` off. One rule: any 3-number spatial value is
  tagged.
- **World file top-level key is `name`** (not `world`) — the "world" is implied by the
  `data/worlds/` folder; uniform with each entity also having a `name`.
- **`$`-prefix reserved** for hydration/resolution tags (data fields may not use it);
  precedent in JSON Schema (`$ref`, `$schema`) and .NET serializers (`$ref`, `$type`).
  `$ref` is component-resolved, not loader-hydrated.
- **Registry: a dedicated `registry.js`** (kept separate from the loader), per the
  general "keep files/components separate" preference.
- **File location:** `data/worlds/` and `data/prefabs/` as **bundled source imports**
  (not `public/`), per the §6 steer.
- **`#listSpawnedEntities`** lives on the loader component and is the authority
  teardown iterates (not the EntityManager).

**Still open:**
- **Merge depth** for prefab overrides: shallow per-component params for v1 (confirm
  when we reach step 2 — no prefabs in step 1, so not blocking).
