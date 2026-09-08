# ECS conversion plan — isometric planet / per-face gravity

Scope study of how *this* project's per-face-gravity mechanic works today, plus a
plan-of-approach for **re-implementing it as new ECS components in a fresh repo**
seeded from the mature architecture of
`ThreeJS-PWA-npm-Vite-Surface-Stable-Dithering` (the "main project").

**Chosen approach (decided 2026-09-04): new repo, not in-place conversion.** This
repo (`~/GitHub/ThreeJS/threejs`) is kept only as the **reference spec + asset
source** — its rough procedural `main.js` is read to understand the behavior,
never ported line-for-line. The new game is built by copying the main project,
**stripping it down to a bare playable base** (removing entity components
unrelated to a first-person walker — the dithering cubes, its custom shader,
multiplayer, HUD-identity contexts), then adding the planet features **one new
entity component at a time**, keeping the app runnable and verifiable at every
step. See "Part 2" for the strip list and the increment cadence.

This is a **project-specific** planning doc, now living in the new repo
`ThreeJS-ECS-Planet` (in `md/`). The reference repo `~/GitHub/ThreeJS/threejs`
remains the **spec + asset source** this is distilled from (its `main.js` line
numbers below are signposts into that repo, not this one). The
*general* write-up of the reorientable-gravity mechanic is a separate,
project-agnostic doc in the shared notes folder —
`~/Syncthing/🗣️ claude conversations/threejs/REORIENTABLE_GRAVITY_THREEJS.md`
(currently a stub; this study is what will fill it in). Background reading for
the target architecture, all in that shared folder:
`PROJECT_STRUCTURE_THREEJS.md`, `ECS_DESIGN_PATTERNS_THREEJS.md`,
`FIRST_PERSON_CAMERA_THREEJS.md`, `INPUT_DEVICES_AND_HANDLING_THREEJS.md`.

> **Status: planning only — nothing built yet.** Line numbers below refer to this
> reference repo's `main.js` as of this writing; the code is rough and shifts, so
> treat them as signposts, not contracts.

---

## Part 1 — How it works today (scope study)

### Project shape
- **Single ~4236-line procedural `main.js`.** All module-level `var`/`const`
  globals + free functions. No classes, no ECS.
- **CDN / importmap** (`index.html` → `<script type="importmap">` pointing
  `three` at jsdelivr `@0.168.0`; `main.js` is `type="module"`). No build step;
  deployed raw to GitHub Pages. (Contrast the dithering project, which moved to
  `npm install three` + Vite — see the shared `VITE_PWA_GITHUB_PAGES_THREEJS.md`.)
- **The "player" is a two-node camera rig**, not an entity/mesh: `cameraPivot`
  (an `Object3D`, holds position + yaw) parenting `camera` (holds pitch). Same
  pivot rig as `FIRST_PERSON_CAMERA_THREEJS.md` — but here the **up-axis is not
  fixed**, which is the whole point of this project.
- **The planet is loaded, not generated.** `initTerrain()` loads
  `./models/Icosahedron.obj` (20 triangular faces), `flatShading`, scaled ×20.
  (`helper_generation_planet.js` and `js/app.js` are empty/dead.)

### Per-frame heartbeat — `update()` (L1542)
`requestAnimationFrame(update)` first, then in order: `precalculateHasPlanetSide`
→ `precalculateCameraDirection` → `precalculateDistanceToFloor` →
`updateCameraGravityPerpendiculars` (movement axes) → inline debug/manual keys →
`checkControlsMovementMK` (read WASD/QE) → `updatePlayerStateGravity` →
`updatePlayerVelocityByStateGravity` → `updateMovePlayerInDirectionOfVelocity` →
`updateCameraLerp` (up-vector ease) → `checkControlsMouse` (look) →
`updateUniforms` → `updateTextLog` → `renderer.render`.

### The mechanic, in five moving parts

**1. Faces → "sides".** At load, `generateTriangleData()` (L1004) walks the
geometry's position/normal buffers, computes each triangle's centroid + face
normal (`helper_mesh.js` `getFaceNormal`), and **buckets coplanar triangles into
"sides" by a normal-hash** (`getHashIdFromFaceNormal`, L1069). Each side gets an
entry in parallel hash-keyed maps: `terrainObjectFloorPlanes` (a `THREE.Plane`
with the averaged normal), `terrainObjectCenterPoints` (Vector3),
`terrainObjectSidesWithOuterWalls` (boundary prism planes for containment),
`terrainObjectSidesWithTriangleIndeces`. **`indexSide` is the single global "which
face am I on"** (a normal-hash key).

**2. Which face is the player on?** `updateFindAndSetClosestGravity()` (L2580) —
**not raycasting**: it iterates `terrainObjectCenterPoints` and picks the side
whose center is nearest to `cameraPivot.position`. Throttled by *elapsed time*,
with the interval swapped between **far (4.0s)** and **near (0.2s)** depending on
gravity state. On a change it calls `setCurrentGravity(newKey)`.

**3. Gravity direction = the face's plane normal**
(`terrainObjectFloorPlanes[indexSide].normal`). That vector is the current "up".

**4. Reorienting the camera up.** On a face change, `setCurrentGravity()` (L2430)
picks an ease speed (fast — 8 frames — when leaping/falling to a side; otherwise
scaled by distance via `rescale`) and calls `resetCameraUp()` (L2737), which
saves the old up into `gravityDirectionLerpOld`, **snaps** `cameraPivot.up` /
`camera.up` to the new normal (the "jarring" snap the HUD text admits to), and
resets `gravityDirectionLerpCount = 0`. Then every frame `updateCameraLerp()`
(L3973) eases `up` from the saved old direction toward the normal by
`alpha = count / countMax`, copies it into `cameraPivot.up`/`camera.up`, and
re-`lookAt`s. A second, delta-time-scaled path
(`camera.quaternion.rotateTowards`) exists for the "unskew" experiments.

**5. Movement relative to gravity.** `updateCameraGravityPerpendicularsWithSide()`
(L2829): `right = normalize(cameraDirection × normal)`,
`forward = normalize(normal × right)` — the walk axes, rebuilt each frame from
the *current* normal (a no-side fallback uses `scene.up`). Then
`updateMovePlayerInDirectionOfVelocity()` (L1744) moves `cameraPivot.position`:
gravity pull via `playerVelocityFromGravity`; **Q/E along the face normal**
(up/down); **W/S along `directionCameraGravityForward`**; **A/D along
`cameraDirectionRight`**. Mouse look yaws with `rotateOnWorldAxis(normal, …)`
around the current gravity normal (not world-Y), pitch on the camera.

### The gravity state machine (`playerStateGravity`, L3110/3143/3273)
Six states driving *how* gravity integrates and *which* ease/throttle is used:
- `-1` unset · `0` falling toward planet center (far) · `1` falling toward the
  nearest side/floor (entered hemisphere) · `2` on the ground (velocity zeroed) ·
  `3` inside the planet (snap back to surface) · `4` leaping off a side edge
  (don't re-pick the closest side) · `5` falling to floor after a leap (≈ state 1).

Transitions (`updatePlayerStateGravityTrigger`) set the reorientation ease speed,
flip the face-search throttle between far/near, zero velocity on landing, and
snap out of the planet interior.

### The messy bits (prune, don't port)
- **Frame-rate dependent simulation.** Velocity accel, gravity addends, and
  movement are fixed per-frame constants (`0.005`, `0.02`, `addScaledVector(…,1.0)`)
  **not** multiplied by `clockDelta`; the up-ease is **frame-count** based
  (`count/countMax`), not time-based. Only the `rotateTowards` unskew uses delta.
- **Dead/legacy code**: `*OLD` functions, an early `return` hiding old
  triangle-distance logic after L2652, commented-out throttle guards
  (`throttleMoveGravity`, `throttleCameraLerp`).
- **Helper bugs**: `helper_mesh.js` `getNormalTriangleData` only ever writes its
  first vertex normal; `getSignOfPointInTriangle` has a dead second `return`.
- **Empty files**: `js/app.js`, `helpers/helper_generation_planet.js`.
- **HUD text ↔ keymap drift**: the on-screen help lists 1/2 as teleport/lookAt,
  but the current keymap wires them to closest-gravity / perpendiculars.
- **Two half-finished reorientation paths** (frame-lerp vs `rotateTowards`
  quaternion) coexisting — the conversion should pick one.

---

## Part 2 — Plan of approach (procedural → ECS)

The target is the main project's hand-rolled ECS (EntityManager / Entity /
EntityComponent with `methodInitialize()` + `methodUpdate(timeElapsed,
timeDelta)`), Context components for shared state, and the Input-vs-Logic split.
See `ECS_DESIGN_PATTERNS_THREEJS.md` for all of it. This is a **two-phase**
effort: stand up a bare playable base copied from the main project, *then* add the
planet features one component at a time.

### Phase 0 — seed a new repo from a stripped-down main project
Don't upgrade this repo; **start the new game from the main project's
architecture**, which already has npm+Vite+PWA+Pages, the ECS classes, the
Input-vs-Logic split, lighting, and a first-person pivot rig.
1. **Copy the main project into a new repo** (new remote/URL — the old
   `dilsency/threejs` deploy is not carried over).
2. **Strip it to a bare, still-playable first-person walker** — remove the entity
   components unrelated to walking around a scene:
   - **Strip:** the fractal dithering shader + textures, and all multiplayer
     components (`PeerConnection*`, `PeerMeshFormation`, `PlayerNetworkSync`,
     `RemotePlayerManager`). None relate to the planet game (at least initially).
   - **Keep:** ECS classes, thin-`main.js` `init()`/loop shape, `ContextEngine`,
     `ContextEnvironment`, the first-person `CameraController*` (+ Input/Touch),
     the `PlayerController*` movement (+ Input/Touch), lighting
     (`LightManager`/`DirectionalLight`), the pointer-lock button, and the **3D-HUD**
     (`TestCubeHUD` cube + panel + `ContextHUDLayout`, self-looking-up
     `ContextLocalPlayerIdentity`) — a reusable mechanic kept on purpose (see the
     "HUD as a forward-facing 3D model" entry in `RECURRING_MECHANICS_THREEJS.md`).
     The HUD is **World-scoped**: generated on confirm, destroyed on return-to-menu
     (decision 2026-09-08 — *not* menu-persistent). See
     `DATA_DRIVEN_WORLDS_AND_PREFABS.md` (the HUD is a `"builder"` entity of the World
     load). `TestCube` is likewise kept (it's the world "sun" cube).
   - Confirm it still builds, deploys, and lets you **walk around flat ground** —
     that's the base every planet component gets added onto.
3. **Bring the planet assets over** from this reference repo:
   `models/Icosahedron.obj` and any textures/materials the planet needs (fix the
   `helper_mesh.js` bugs — `getNormalTriangleData` only writes its first vertex,
   the dead `getSignOfPointInTriangle` `return` — when those helpers are ported).

### Phase 1 — the target component design (added one at a time)
The components to build on top of the bare base, in the cadence below. Names
follow the main project's conventions:

- **Engine context** — `EntityComponentContextEngine`: holds
  renderer/scene/cameraPivot/camera/clock, looked up by everyone (don't hand-wire
  through constructors — see the "no hard-wiring in main.js" rule).
- **MainMenu / initialization** — a **separate pre-generation system** (see the
  "Main menu / pre-generation setup" entry in `RECURRING_MECHANICS_THREEJS.md`).
  - **`EntityComponentContextInitialization`** (a Context component): owns the
    selectable **init sets** (`{planetRadius, spawnFaceIndex, spawnDistanceFromPlanet}`
    presets) + the chosen one; exposes `getPlanetRadius()` / `getSpawnFaceIndex()` /
    `getSpawnDistance()` once confirmed, plus `isConfirmed()` — the de-facto phase gate.
    It's a **toggle**, not one-way: `methodConfirm()` → Playing, `methodReturnToMenu()` →
    back to the menu (**re-enterable at runtime** — level select / "Quit to menu"), which
    triggers world teardown (see "ECS teardown & deferred deletion").
  - **`EntityComponentMainMenu`** (UI): while unconfirmed, shows the init-set choices;
    on confirm, records the choice, triggers generation, and the game enters Playing
    **unpaused**. Assumes nothing is generated yet.
- **Planet entity** (generated on MainMenu confirm, parameterized by the init set)
  - the mesh (loaded OBJ, sized by the init set's `planetRadius`), and
  - **`EntityComponentContextPlanetFaces`** (a Context component): owns the
    parsed per-face data — the normal-hash → {plane/normal, center, outer-walls,
    triangle indices} maps — computed once at init from the geometry. Exposes
    lookups: `getFaceNormal(faceId)`, `getFaceCenter(faceId)`,
    `getNearestFace(position)`, `isWithinFace(position, faceId)`. This replaces
    the global `terrainObject*` maps.
- **Player entity** (the cameraPivot rig), with single-purpose siblings:
  - **Input** (mouse+keyboard, and the touch/Joy-Con paths this repo already
    dabbled in — note `helper_camera_rotation.js`'s `isJoyConL` math): raw state
    only, behind one shape, per `INPUT_DEVICES_AND_HANDLING_THREEJS.md`. Selected
    via the self-attaching-sibling pattern.
  - **`EntityComponentPause`** (`isPaused`, per-player): starts **false** (the game
    enters Playing *unpaused* after the MainMenu — "begins paused" is superseded by
    "begins in MainMenu") and is the "this client is paused" master switch, toggled
    in-game by a dedicated key (independent of the pointer-lock control). Pause-aware
    components early-return in `methodUpdate()` on a pause check — player-owned ones
    read their own entity's flag, autonomous world movers read the local player's.
    The **pause menu** (shown when paused) holds the 3D-HUD position controls
    (left/center/right) and, later, the multiplayer connect UI — these live *only*
    here, not in the MainMenu. See the "Pause system" entry in
    `RECURRING_MECHANICS_THREEJS.md`; multiplayer broadcast + remote-avatar
    freeze/indicator + autonomous-mover sync are deferred.
  - **`EntityComponentGravityState`**: the state machine (states −1..5),
    distance-to-planet/floor, transition triggers. The "brain" that decides which
    gravity regime we're in. Owns the throttle intervals.
  - **`EntityComponentGravityOrientation`**: owns the *current* gravity up (a face
    normal), performs the reorientation ease (old→new up), and applies it to
    `cameraPivot.up`/`camera.up`. Reads `ContextPlanetFaces` + `GravityState`.
    Because it is the **single writer** of `cameraPivot.up`/`camera.up`, the camera
    controller and the movement component can both just *read* that up and stay
    gravity-agnostic. **Pick one reorientation path** (the frame-lerp is simpler;
    make it delta-time based — see decisions).
  - **`EntityComponentPlayerMovementGravity`**: recompute the perpendicular basis
    (`right`/`forward` from `cameraDirection × up`) and integrate velocity (input
    + gravity) onto the pivot position. Reads the current up from
    `GravityOrientation` and the input from the Input sibling.
  - **`EntityComponentCameraControllerFirstPersonGravity`** — a **new** Logic
    class, *not* a modification of the base first-person controller (keep that one
    intact as the flat-ground baseline to A/B against). It **reuses the base's
    Input siblings unchanged** (mouse/keyboard/touch, via the self-attaching-sibling
    pattern); the only difference is the yaw axis —
    `cameraPivot.rotateOnWorldAxis(cameraPivot.up, deltaX)` instead of
    `rotateY(deltaX)` (pitch stays `camera.rotateX(deltaY)`). It yaws around
    **whatever `cameraPivot.up` currently is** (maintained by `GravityOrientation`),
    so it needs to know nothing about faces or gravity. This is the concrete
    generalization of `FIRST_PERSON_CAMERA_THREEJS.md` and the heart of what
    `REORIENTABLE_GRAVITY_THREEJS.md` will document.
  - **Face selection** can live inside `GravityState` (it already gates the
    throttle by state) or as its own component writing "current face" into
    `GravityOrientation`.

The per-frame ordering the loop currently hard-codes (perpendiculars → movement →
up-ease → look) becomes the natural `methodUpdate()` order across these
components; where one genuinely must precede another, make it explicit rather
than relying on registration order.

### Resolved design choices (2026-09-04)
- **A new camera controller, not a modification** of the base first-person
  controller — it keeps a known-good flat-ground baseline to A/B against, and the
  gravity variant is a small new Logic class reusing the base's Input siblings (yaw
  around `cameraPivot.up`; details in the component list above).
- **Generation phase first, as its own verified gate** (increments 1–2) before any
  gravity/camera/movement work.

### Decisions to make during conversion (flag, don't silently port)
- **Make simulation frame-rate independent**: multiply velocity/gravity/ease by
  `timeDelta`. The up-ease should become time-based (seconds to reorient), not a
  frame counter.
- **Keep the normal-hash face bucketing?** It's clever but fragile. Consider
  whether faces should be identified by geometry group / material index instead.
- **Nearest-center search vs raycast** for "which face am I on" — raycast down the
  current gravity is more robust near edges; the center-distance search is cheap
  but can mispick on an icosahedron's narrow faces. **Reference resource:**
  `~/GitHub/ThreeJS/ThreeJS-Test-CDN/helpers/helper_mesh.js` has a richer
  collision toolkit than this repo's `helper_mesh.js` —
  `getDoesPredictedPositionIntersectTriangle` / `getPredictedPositionIntersectTriangle`
  (continuous collision), `getYCoordinateOfPointOnTriangle` (snap-to-surface),
  `getDistanceToTriangle`, `getSignedVolumeTetrahedron` — worth borrowing from if we
  go the raycast/collision route. (It is *not* a bug-fixed drop-in: it lacks
  `getNormalTriangleData` entirely and shares the `getSignOfPointInTriangle`
  dead-`return`; the two `helper_mesh` bugs are trivial to fix ourselves.)
- **The reorientation snap** (`resetCameraUp` snaps then eases from old) is
  visibly janky; decide whether to ease purely from the current up with no snap.
- **One reorientation mechanism**, not two.

### ECS teardown & deferred deletion (foundational — the re-enterable MainMenu forces it)
The MainMenu is **re-enterable at runtime** (navigate to *and* from it — level-select /
"Quit to menu"). So `confirm` / `return-to-menu` **toggle** `ContextInitialization`'s
`isConfirmed`, and returning must tear the current world down so a new one can be built.
This base ECS has **no removal** (`methodRemoveEntity` / `methodRemoveComponent` don't
exist) — so it needs building, and it's needed by multiplayer despawn later too, so it's
foundational, not menu-only.

**Two-phase (deferred) deletion — flag, then sweep.** Removing an entity/component
*during* the update loop's iteration is a classic crash/skip bug, so split it:
- **Every `EntityComponent` carries `#toBeDeleted`** (base class) +
  `methodFlagForDeletion()` / `methodGetIsFlaggedForDeletion()`, plus `methodDispose()`
  (default no-op; overridden by components that own scene objects).
- **Phase 1 — flag:** a flagged component **early-returns in `methodUpdate()`** (inert)
  and hides its mesh (`.visible = false`) — "hidden + un-interactible, instantly." This is
  the *same early-return shape as pause*; `flaggedForDeletion` ≈ a permanent, invisible
  pause.
- **Phase 2 — sweep:** a manager pass at **end-of-frame** (outside the update iteration
  — the decided starting point) removes flagged entities/components and calls
  `methodDispose()`. Immediate for now; "until appropriate to actually remove it" leaves
  room to gate it later (after a fade / a network ack).

**Granularity — both base classes carry it.** `#toBeDeleted` +
`methodFlagForDeletion()` / `methodGetIsFlaggedForDeletion()` live on **both the base
`EntityComponent` and the base `Entity`**. Flag a *component* → just that component is
swept; flag an *entity* → the whole entity and all its components go (the common case —
"delete this whole player/planet"). The sweep treats a component as gone if either its
own flag **or** its owning entity's flag is set.

**Dispose must respect kept assets.** `methodDispose()` does `scene.remove(mesh)` +
`.dispose()` on the geometry/material/textures it **owns** — but **never** on
shared/cached resources; disposing those corrupts the next world that reuses them, and
*not* disposing owned ones leaks GPU memory. Two resource tiers:
- **Persistent (kept across menu↔world):** the async-**loaded geometry** + any shared
  material. Loaded once; not re-fetched or disposed on teardown.
- **Per-world (flagged + disposed):** the scene mesh instance, the player's world state,
  the gravity components, and the **3D-HUD entity** (cube + panel + light + layout) —
  created on enter-world, torn down on return-to-menu. (The HUD is World-scoped, not
  menu-persistent — decision 2026-09-08.)

**Generation is a generate/teardown pair, not a one-shot.** Keep the loaded geometry
alive and **recompute the cheap face parse each world** (sub-ms for a 20-face
icosahedron — a results-cache for it would be premature; revisit only if a world's
generation ever profiles as slow). On return-to-menu, flag the per-world objects → they
hide instantly (clean menu transition) → the sweep disposes them.

**Multiplayer (deferred):** broadcast `toBeDeleted` as part of state sync; a receiving
client flags its local copy (hidden + inert for everyone) and sweeps its own copies on
its own schedule — the "something must disappear for all players mid-game" case, with no
synchronized hard-delete required.

> This deferred-deletion pattern is general ECS architecture (not planet-specific) — a
> candidate to distill into the shared `ECS_DESIGN_PATTERNS_THREEJS.md` once it's built
> and proven.

### Cross-component events — how one component notifies others
When a state change on one component must notify components on *other* entities
(`confirm` / `return-to-menu` → MainMenu hides/shows; later generation builds/tears down),
there are three approaches — **but note up front:** the only messaging pattern the dither
project actually *uses* is **same-entity** (an entity broadcasts `update.position` within
itself and its *own* components react); its cross-entity method is defined but unused. So
no cross-entity option below is a proven convention here — choose with eyes open.

**A. Co-locate sender + listener on one entity → same-entity messaging.** The proven
dither pattern (`methodSendMessageWithinEntity`, listener registers on its *own* entity).
Cleanest and most idiomatic — **but only when the state is genuinely private to that one
consumer.** A real **Context** is multi-consumer shared state *by definition* (that's the
whole Context-component pattern), so bolting a specific consumer (the MainMenu UI) onto it
would destroy the independence the Context exists for. `ContextInitialization` is read by
MainMenu, generation, *and* player-spawn — so it stays its own entity, and **A does not
apply to it.** (A is only for state that isn't actually shared — e.g. a controller talking
to its own siblings.)

**B. Capability-targeted send** (`methodSendMessageToEntitiesWithComponent`). The
project's *designed* cross-entity mechanism: the source addresses listeners **by
capability** (component name) — matching this ECS's "address by capability" philosophy. The
Context sends to `"EntityComponentMainMenu"`, and to each further listener component-type as
it's added. Trade-off: the source names its consumers (a coupling) and is edited per new
listener — though in a capability-addressed system that coupling is arguably intentional.

**C. Hub via foreign registration.** The source broadcasts *within its own entity*
(`methodSendMessageWithinEntity`) and foreign listeners reach in to register handlers on
the source's entity. Blind sender, one send, no new entity. Trade-off: it **bends the
"register on your own entity" convention** (a listener's behavior partly lives on another
entity), it is **unproven** here, and it needs a handler-**unregister** on teardown (a
per-world listener's handler outlives it — see the teardown step, increment 4).

**Where this leaves us:** `ContextInitialization` is a legitimate multi-consumer Context,
so it **stays a separate entity** (A is off the table for it — see the design check below).
The real choice for notifying its consumers is **B vs C**: B is idiomatic to this ECS with
mild, arguably-intended coupling; C is blind but unconventional with a lifecycle caveat.
**Decided (2026-09-05): B, and implemented** — the Context broadcasts
`initialization.confirmed` / `initialization.returnedToMenu` via
`methodSendMessageToEntitiesWithComponent("EntityComponentMainMenu", …)`, and the MainMenu
registers those two handlers on its **own** entity (→ `methodHide()` / `methodShow()`).
Revisit only if the Context's per-listener naming grows annoying as more listeners
subscribe. Whichever is chosen, **name messages for what happened, not what to do** (`"initialization.confirmed"`,
not `"menu.hide"`) so each listener decides its own reaction — the shared
`ECS_DESIGN_PATTERNS_THREEJS.md` "blind sender" principle.

**Design check — should Context components be their own entities?** Yes. Keeping a Context
as its own entity is *correct* precisely because it's multi-consumer shared state whose
ownership is independent of any single consumer — that is the Context pattern's whole
purpose, and it applies to `ContextInitialization` exactly as to `ContextEngine` /
`ContextPlanetFaces`. So "should MainMenu and the init Context be one entity?" resolves to
**no**; the earlier co-location idea was inconsistent with the Context principle and is
retracted. Co-location (A) is right only for genuinely private, single-consumer state — the
init state is not that.

### Increment cadence — one new entity component at a time
Each step adds **one** new component to the running base and leaves the game
playable and verifiable before the next. Read the reference `main.js` for the
behavior each should reproduce; don't port its code.

0. **Bare base** (Phase 0): stripped main project, walk around flat ground.
1. **MainMenu + init sets.** Add `EntityComponentContextInitialization` (the
   selectable `{planetRadius, spawnFaceIndex, spawnDistanceFromPlanet}` presets +
   chosen/confirmed state) and `EntityComponentMainMenu` (GUI showing the init-set
   choices while unconfirmed; on confirm, record the choice and flip to Playing
   **unpaused**). No planet yet — verify the menu shows at start, you can pick a set,
   and confirm hides it and drops you into the (flat, for now) playable base.
   Testable on what's already here.
2. **Load the planet — on MainMenu confirm.** Generate the `Icosahedron.obj` mesh,
   sized by the init set's `planetRadius`, **triggered by confirm** (not at startup).
   The OBJ load is **async** (parse after it arrives / a `ready` flag). No gravity
   yet — verify: menu → pick a radius → confirm → a planet of that size appears and
   you can walk near it. (Port `helper_mesh.js` cleaned up.) The generation trigger +
   the **data-driven World loader** this and later increments build on are specified in
   `DATA_DRIVEN_WORLDS_AND_PREFABS.md` — its staged **step 1** (registry + minimal flat
   loader for the easy entities) is the spine of this increment.
3. **`EntityComponentContextPlanetFaces` + spawn.** Parse the geometry into per-face
   data (normal-hash buckets → normal/center/outer-walls) and expose the lookups
   (`getFaceNormal`, `getFaceCenter`, `getNearestFace`, `isWithinFace`). Use the init
   set's `spawnFaceIndex` + `spawnDistanceFromPlanet` to place the player (along that
   face's normal). Verify the face data by visualizing centers + normals, and that
   the player spawns where the chosen set says.

   **⟵ Generation gate.** Steps 1–3 are the "MainMenu → generation" front: choose an
   init set, generate a planet from it, spawn the player — and it's **fully testable
   on the current base with no gravity yet**. Confirm this whole loop before touching
   gameplay.
4. **ECS teardown + deferred deletion — completes the menu↔world cycle.** Build the
   removal the base ECS lacks: `#toBeDeleted` + `methodFlagForDeletion()` /
   `methodGetIsFlaggedForDeletion()` on **both** `EntityComponent` and `Entity`; a
   `methodDispose()` hook (default no-op; overridden to `scene.remove()` + `.dispose()`
   the objects it *owns* — never the kept/shared geometry); `EntityManager.methodRemoveEntity`
   / `Entity.methodRemoveComponent` (plus a **message-handler unregister**, which the ECS
   also lacks — so a per-world listener's handler on a long-lived hub entity stops firing
   after dispose; see "Cross-component events"); and an **end-of-frame sweep** that removes
   flagged things and calls their `methodDispose()`. Wire `methodReturnToMenu()` to flag the
   per-world objects → they hide + go inert instantly → the sweep disposes them. Verify
   the full loop: menu → generate World A → return to menu (A's planet **and HUD** gone,
   geometry kept) → pick + generate World B → walk around it. See "ECS teardown &
   deferred deletion" above.
   (Multiplayer broadcast of the flag is deferred.)
5. **`EntityComponentPause` (in-game).** Add the pause flag (**starts false**), the
   dedicated pause key, and `methodIsPaused()`. Wire the early-return into the
   movement + camera components, and add the **pause menu** holding the 3D-HUD
   position controls (its first occupants; the MainMenu does *not* have them).
   Pausing frees the cursor. No "begins paused" — the MainMenu is the entry point.
   **Every world component added after this respects pause from birth via the same
   early-return.** See `RECURRING_MECHANICS_THREEJS.md`. (Multiplayer broadcast +
   remote freeze/indicator + autonomous-mover sync deferred.)
6. **`EntityComponentGravityOrientation`.** Given a *manually chosen* face, set
   and ease `camera`/`cameraPivot` up toward its normal. Verify with a key that
   cycles faces — the horizon should reorient smoothly. (Time-based ease.)
7. **Gravity-aware camera yaw.** Add the **new**
   `EntityComponentCameraControllerFirstPersonGravity` (reusing the base Input
   siblings; the base fixed-up controller stays available to A/B against). Yaw
   around `cameraPivot.up`, pitch on the camera. Verify look feels correct on a
   tilted face.
8. **`EntityComponentPlayerMovementGravity`.** Recompute the perpendicular basis
   from `cameraDirection × up`; move WASD along it, Q/E along the face normal,
   gravity pull along −up. Verify walking on a single face.
9. **`EntityComponentGravityState`.** Add the state machine + `getNearestFace`
   selection so the current face updates automatically as you walk/leap/fall —
   this is what makes it a *game* rather than a manual demo. Verify crossing
   between faces, leaping an edge, and falling from far.
10. **Polish pass.** Frame-rate independence throughout, resolve the reorientation
   snap/jank, ensure a single reorientation path, tune throttles.

### Testing
This repo has no test suite. Verify end-to-end in a real browser (and on a real
touch device if the touch path is kept), per the sibling's practice — walk across
several faces, leap an edge, fall from far, and confirm the camera up and
movement axes stay correct on each face.

### Feeds back into the shared docs
Once the mechanic is understood/clean, distill the project-agnostic version into
`REORIENTABLE_GRAVITY_THREEJS.md` (gravity as a per-surface up-vector propagated
to camera + movement), cross-linking `FIRST_PERSON_CAMERA_THREEJS.md`.
