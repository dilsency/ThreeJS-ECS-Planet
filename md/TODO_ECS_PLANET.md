# TODO — ECS-Planet (live)

The **project's own** open items, specific to ThreeJS-ECS-Planet as it stands today.
Distinct from `TODO.md`, which is a **seed-ported reference** (it describes the seed
project verbatim and is left unmodified — see its PROVENANCE banner). New refactor /
cleanup items for *this* codebase go here.

> **Planet slices #1 and #2 are both complete and committed** (see `PLANET.md`) — face
> parsing, debug visualization, and `EntityComponentSpawnOnPlanetFace` are wired into both
> worlds. The two items below are unrelated cleanup and remain open.

---

## 1. Align input-variant naming: `PlayerControllerInput` → `PlayerControllerInputMK`

The two controllers disagree on how they name their mouse-keyboard input variant:

- Camera: `EntityComponentCameraControllerFirstPersonInputMK` / `...InputTouch`
- Player: `EntityComponentPlayerControllerInput` (no `MK`) / `...InputTouch`

The MK variant is suffixed `InputMK` for the camera but bare `Input` for the player. Now
that `Touch` exists as a real sibling, a bare `Input` reads like "the input base," not
"the mouse-keyboard variant." **Rename `EntityComponentPlayerControllerInput` →
`EntityComponentPlayerControllerInputMK`** so both controllers follow the same
`…InputMK` / `…InputTouch` scheme.

- **File:** `entity components/player_controller.js` (the class + the self-attach that
  `EntityComponentPlayerController.methodInitialize()` uses to pick the MK vs Touch sibling
  — "Pattern C").
- **Check for stragglers:** any remaining import/reference elsewhere (`main.js` dropped its
  direct import when Pattern C self-attach landed, but grep to be sure), and any doc mention.
- Pure rename, no behavior change.

## 2. Folder reorg — group the loose `entity components/*.js`

Several components still sit loose in the `entity components/` root. Move them into
concern-folders (the standing reorg intent; see `NAMING_CONVENTIONS.md` §10):

- **`lighting.js` → `environment/`** — joins `skybox.js` + `planet.js`. Directly matches the
  original note ("lighting + skybox → an environment folder").
- **`camera_controller_first_person.js` + `player_controller.js` → their own folder**
  (e.g. `controller/`, or `player/` to group by the thing rather than the role) — they're the
  player rig plus its camera and are tightly coupled.
- **`test_objects.js`** (TestCube / TestCubeHUD / BackgroundPlane) — dev scaffolding; hold off
  (a `debug/` folder) until there are real world objects to sort it against. Not urgent.

Do the moves as focused commits (rename/move detection likes them isolated). After the
`context/multi/context_planet_faces.js` conversion (→ co-located `EntityComponentPlanetFaces`
in `environment/`), the `context/multi/` folder is deliberately kept but empty.

## 3. `EntityComponentPlanetFaces` — use the cached `#planetCenter` instead of re-fetching

Now that `EntityComponentPlanetFaces` caches the sibling planet's position once, in
`#planetCenter` (set during `#methodOnLazyLoadInit()`, since `EntityComponentPlanetModel`'s
position is fixed for its lifetime), the handful of call sites that still do
`entityComponent.methodGetPosition()` off a freshly-resolved `EntityComponentPlanetModel`
sibling — `methodGetFaceCenter()`, and inside the parse loop
(`#methodParseFaceDataViaPositions()` / `#methodStoreEdgeData()`) — should read `this.#planetCenter`
instead. Removes a few redundant sibling-component lookups; no behavior change, since the
value is identical either way.
- **File:** `entity components/environment/planet.js`.
