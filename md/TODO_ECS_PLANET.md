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

## 4. Scale planet-face-alignment camera rotation speed by distance from planet

When far away from a planet, the camera's rotation to match the current planet-face's
normal direction should take much longer (slower turn) than when close up. Right now the
turn speed is presumably fixed regardless of distance — it should scale with (or at least
step down at) distance from the planet.

- **Files:** likely `entity components/movement/camera_controller_first_person.js` and/or
  `entity components/environment/planet.js` (wherever the face-normal alignment rotation
  is driven).

## 5. Centralize the gravity-state distance boundaries in ONE place

The distance boundaries that separate "within floor range", the normal "falling" range,
"far" falling, and "orbit" are currently scattered as magic numbers across
`entity components/environment/planet.js` (the gravity state machine there), e.g.:

- `#isWithinFloorRange = (this.#distanceToFloor >= 0.5 && this.#distanceToFloor <= 2.0)`
- `#distanceFromFloorIdeal = 2.0`, `#distanceFromFloorIdealLeeway = 0.5`
- the `Falling` ↔ `FallingFar` boundary at `distanceToFloor >= 50.0` (appears at multiple
  call sites, e.g. `methodUpdateByStateFallingFar()` and `methodUpdateByStateOrbit()`)

These need to be defined in **ONE** place, not re-declared/re-typed at each check site.

**Discussion — is this a Context component's job?**

- A `Context` component (singleton/multi, per `context/` conventions) is the natural home
  for values that are *shared configuration*, not per-entity state — e.g. a
  `ContextPlanetDistanceThresholds` (singleton) or fields added to the existing planet-face
  context. That fits: these boundaries are conceptually planet-wide tuning constants, not
  something that varies per gravity-component instance today.
- Counter-consideration: the boundaries might eventually need to vary **per planet**
  (different planet sizes/masses → different "far"/"orbit" cutoffs), in which case they
  belong on `EntityComponentPlanetModel` (or `EntityComponentPlanetFaces`) as per-planet
  fields, with the gravity component reading them off its planet sibling rather than off a
  global Context.
- Simplest fix either way: pull the literals (`0.5`, `2.0`, `50.0`, etc.) out of inline
  checks into named constants/fields declared once at the top of the owning component, then
  decide Context-vs-per-planet only if/when a second planet with different tuning is
  actually needed. Avoid the Context indirection until there's a concrete case for it.
- **File:** `entity components/environment/planet.js` (search for `#isWithinFloorRange`,
  `#distanceFromFloorIdeal`, `>= 50.0`, `< 50.0`).

**Update — leaning decision: per-planet, on the planet (not a Context singleton)**

The cutoffs depend on the planet's size, which is the concrete case the counter-consideration
above was waiting for. (Current planet: radius 20 in `worldDefault.json`; the `Orbit` cutoff of
100 from the center is 5x the radius, and the `FallingFar` cutoff of 50 from the floor is
2.5x the radius.)

- **Two kinds of cutoff:**
  - *Planet-scale* (should scale with the planet): the `Orbit` boundary
    (`distanceToPlanetCenter` vs `100.0`, in `methodUpdateByStateOrbit` / `methodUpdateByStateFallingFar`),
    the `Falling` / `FallingFar` boundary (`distanceToFloor` vs `50.0`), and the initial-state
    values (`100.0`, `30.0`, `2.0` in gravity's lazy-load `spawn` region).
  - *Player-scale* (same on any planet): the ideal height above the floor (`2.0`, leeway `0.5`),
    the floor range (`0.5`..`2.0`) and the crossing / floor checks (`dist >= 2.0`). These stay as
    named fields in `EntityComponentGravity`.
- **Where:** `EntityComponentPlanetFaces` already knows the radius (via its `PlanetModel` sibling)
  and owns the distance queries, so it holds the planet-scale ranges as the single source:
  - optional per-planet params in the world JSON (e.g. `orbitDistance`, `fallingFarDistance`),
    defaulting to multiples of the radius so a bigger planet gets bigger ranges automatically;
  - getters such as `methodGetOrbitDistanceFromCenter()` and `methodGetFallingFarDistanceFromFloor()`;
  - `EntityComponentGravity` reads them once in its lazy-load (it already depends on the planet
    faces) and caches them in private fields; the spawn logic uses the same values.
- **One measure per cutoff:** the `Orbit` boundary is checked against the **distance to the
  planet center** (faces are not tracked there); the other boundaries are checked against the
  **distance to the current face's floor**. Define each cutoff against the measure it is checked
  with, and use that same measure everywhere. At the moment gravity's initial-state check uses the
  *floor* distance for the `Orbit` threshold (`dist >= 100.0`), while the runtime update uses the
  *center* distance. With `faceDistance: 100` the initial floor distance is exactly on that
  cutoff, so floating-point error can put the player in `FallingFar` or `Orbit`, and the first
  update may then flip the state. A single shared method that takes both distances and returns the
  state would remove the duplicated logic between the initial state and the runtime updates.
- **Hysteresis:** give `Orbit` separate enter and exit distances (a small gap), so a player
  hovering near the boundary does not flip between `Orbit` and `FallingFar` (see item 7).
- **Files:** `entity components/environment/planet.js` (`EntityComponentPlanetFaces`,
  `EntityComponentGravity`, `EntityComponentSpawnOnPlanetFace`), `data/worlds/*.json` (planet params).

**Still under consideration — where the player-scale defaults and their overrides live**

Undecided. The planet-scale cutoffs above go on the planet. For the player-scale values (ideal
height above the floor `2.0`, leeway `0.5`, floor range, crossing checks), the options are:
- **Option A (leaning, not decided): default in `EntityComponentGravity`, override via its own
  `params`.** These values describe the *entity* (e.g. the player's eye height), not the planet,
  and a different kind of entity on the same planet may want a different height. Gravity is
  per-entity and already takes `params` in the prefab (`data/prefabs/player.json`), so a param like
  `distanceFromFloorIdeal` is the natural override, with the current private fields as the default.
  Layering: gravity default -> gravity `params` override -> (only if ever needed, e.g. a "floaty"
  planet) a planet-level override on top.
- **Option B: default in `EntityComponentPlanetFaces`, overridden when necessary.** Not strange,
  but it ties a player dimension to the planet, so every entity on that planet shares the planet's
  default. This fits only if the value is really a property of the *surface* (e.g. deep snow that
  makes everything stand higher), which a `2.0` eye height is not.
- **Side finding for either option:** `#isWithinFloorRange` checks `0.5..2.0`, while ideal +/-
  leeway is `1.5..2.5`. They may be intentionally different, but once the numbers are named fields
  in one place, decide whether the range should be derived from the ideal and the leeway.

## 6. Fix movement perpendiculars flipping when aiming straight down — done

When the camera was aimed fully down, `directionForwardNonvertical` /
`directionRightNonvertical` sometimes "overshot", so holding S walked the player diagonally
*forwards*. Confirmed cause: the nonvertical forward was the camera's pitched forward minus its
up-component, which is ~0 at pitch `-π/2` (measured `7e-15`), and `.normalize()` turned that
rounding noise into a random direction.

- **Fix:** the nonvertical forward is now derived from the cameraPivot's yaw (no pitch), with an
  epsilon (`1e-6`) fallback to the previous frame's vector. Verified by hand: looking straight
  down and straight up both work. The fallback's up-direction-transition case (e.g. walking
  straight into a wall) is not yet tested.
- **File:** `entity components/movement/camera_controller_first_person.js`
  (`methodUpdatePerpendicularsForward()` / `methodUpdatePerpendicularsForwardPreventOvershoot()`).
- **Full write-up (issue, root cause, fix options):**
  `C:\Users\Nils\Syncthing\🗣️ claude conversations\threejs\perpendicular-overshoot-when-aiming-down.md`

## 7. `Orbit` state: free camera look, up-direction, and movement

When the player is far from the planet (`Orbit`, further out than `FallingFar`; currently
`distanceToPlanetCenter > 100.0`), the player should be able to look and fall freely:

- **Camera look (implemented, needs polish):** pitch is no longer clamped while in `Orbit`.
  `EntityComponentCameraControllerFirstPerson` has `#pitchShouldClamp`, set by
  `methodOnFallingDistanceChanged(index)` (`false` for index 2 = `Orbit`, `true` otherwise) and
  checked in mouse-look and in the look-in-direction pitch. Decision: **unclamped pitch**, not
  a free quaternion rotation (no roll, no poles-free orientation). Known issues with it:
  - **Snap when leaving `Orbit`:** `#pitch` keeps accumulating (it can be 7.0 or -9.5). When
    clamping comes back on, the next mouse move clamps straight to `±π/2`. Wrap `#pitch` into
    `(-π, π]` when re-enabling the clamp, then ease it into range instead of snapping.
  - **Yaw feels reversed while upside-down** (`cos(pitch) < 0`): negate the horizontal mouse
    speed while unclamped and upside-down.
  - The pitch-clamp logic is repeated in three places; a small private helper
    (e.g. `#methodApplyPitch(pitchUnclamped)`) would be the one place to put the wrap fix.
- **Gravity (already done):** `Orbit` already applies gravity towards the planet center
  (`#methodApplyGravityTowardsPlanetCenter()`), not along the current face's normal.
- **Nearest face (already skipped in `Orbit`):** `methodShouldUpdateToNearestFace` is not called
  in `Orbit`; on dropping into `FallingFar` its update picks the nearest face up again once the
  player is outside the current face. Optionally compute the nearest face once on that
  transition instead.
- **Up-direction (to try):** the camera's up still follows the stale face's normal while in
  `Orbit`, so the horizontal plane that WASD moves in stays fixed instead of following the
  planet's curvature. Try updating it each frame to the direction from the planet center to
  the player (`methodSetDirUp(radialDirection)`, e.g. from `methodUpdateByStateOrbit()`); the
  existing smooth up-transition then tracks it and the heading stays consistent. This should
  make WASD move in the plane tangent to the planet. It will probably help, but it does NOT
  change the movement issues in the next bullet.
- **Movement in `Orbit` (consider changing it entirely):** WASD currently moves along the
  *pivot's* yaw projected onto the horizontal plane (TODO 6), not along where the camera looks.
  In `Orbit` that means:
  - Looking up or down does not change where W takes you; it never moves you towards where you
    are aiming.
  - Past the poles (pitch beyond `±π/2`) the camera looks backwards horizontally while the
    pivot's forward does not change, so **W moves away from where you look**.
  - (This corrects an earlier note here: removing the clamp does not bring back the old random
    direction bug from TODO 6, but it does introduce this consistent reversal.)
  Suggestions:
  - While in `Orbit`, move along the camera's **full forward** (`#directionForward`, including
    pitch) and the camera's right, i.e. "fly where you look", instead of the horizontal-plane
    vectors. Gate it with the same `#pitchShouldClamp` / index-2 hook, so landed and falling
    movement is unchanged.
  - Optionally give `Orbit` a distinct movement scheme altogether (e.g. thrust along view
    direction as velocity, rather than direct position offsets), since gravity already applies
    velocity there.
  - Decide this together with the up-direction bullet above: if movement follows the camera's
    full forward, a stale up direction matters much less.
- **Per-frame work (not done):** `EntityComponentGravity.methodUpdate()` computes
  `#isWithinFace`, the floor distance and the face-wall checks every frame for every state,
  against the stale face. Skipping them in `Orbit` is where the performance would actually be
  saved.
- **Related:** the `Orbit` / `FallingFar` boundary is one hard threshold (`> 100.0` / `< 100.0`),
  so a player hovering at ~100 could flip between the two. See item 5 (named thresholds); a
  hysteresis gap would also fix this.
- **Files:** `entity components/movement/camera_controller_first_person.js`,
  `entity components/movement/player_controller.js`,
  `entity components/environment/planet.js` (`EntityComponentGravity`).

## 8. `EntityComponentGravity.methodOnFallingDistanceChanged` crashed on its first call — done

The first time `methodOnFallingDistanceChanged(index)` ran, it threw, because
`this.#componentInstanceVelocity` was still `null` (it calls
`this.#componentInstanceVelocity.methodOnFallingDistanceChanged(index)` unguarded, since velocity
is mandatory).

Cause: the two components waited on each other.
- `EntityComponentSpawnOnPlanetFace`'s lazy-load called `methodSetStateInitial()`, which called
  `EntityComponentGravity.methodSetState(...)`; the state machine's `None -> X` handler then
  called `methodOnFallingDistanceChanged(...)`.
- Gravity's own lazy-load resolves `#componentInstanceVelocity`, but its `dependent` region first
  waited for the spawn component to be ready, which only happens after that same call finished.
- So the first falling-distance notification always arrived before gravity had resolved velocity
  (and before it had resolved the optional player controller and camera, which the `?.` calls
  then skipped silently).

Fix (both parts were needed):
- Gravity now resolves velocity **before** the "spawn component is ready" wait, so the unguarded
  call is safe.
- `EntityComponentSpawnOnPlanetFace` no longer sets the gravity state (`methodSetStateInitial()`
  removed). Gravity decides its own initial state in the `spawn` region of its lazy-load, after
  velocity and the optional components are resolved, so the first notification reaches all of
  them. (Before, a second `methodSetState` with the same state was a no-op because
  `methodTransitionTo` returns early on an unchanged state, and the camera / player controller
  never got the initial index.)
- Behavior change: the initial state is now `Orbit` / `FallingFar` / `Falling`; `Landed` is no
  longer chosen at spawn (the state update lands the player from `Falling`).
- Remaining: the initial-state thresholds use the floor distance, while the runtime `Orbit` /
  `FallingFar` boundary uses the distance to the planet center. See item 5.
- **File:** `entity components/environment/planet.js` (`EntityComponentGravity`,
  `EntityComponentSpawnOnPlanetFace`).

## 9. Pivot / camera rotation changes are not broadcast to other components

Position and up-direction changes are broadcast within the entity (`Entity.methodSetPosition` ->
`update.position`, `Entity.methodSetDirUp` -> `update.dir.up`). Rotation is only broadcast from
**one** place: mouse/keyboard look in `EntityComponentCameraControllerFirstPerson.methodUpdate()`
(`methodSetRotations(...)` -> `update.rotations`, which also stores `#rotationA` / `#rotationB` on
the entity).

Every other path that rotates the cameraPivot or camera does **not** broadcast, and does not
update the entity's stored rotations:
- `methodUpdateUpDirectionTransition()` (the smooth up-direction transition, every frame while it runs)
- `methodSetDirUpWithoutTransition()`
- `#methodLookInDirectionYaw()` / `#methodLookInDirectionPitch()` (and so `methodLookAt()` /
  `methodLookInDirection()`), plus the `...OLD` versions
- `#methodResetCameraRotation()`

Today nothing seems to listen: no component registers a handler for `update.rotations` (the
camera controller's own registration is commented out, and `methodHandleUpdateRotations()`
returns immediately), and `methodGetCameraPivotQuaternion()` / `methodGetCameraQuaternion()`
(meant for network sync, see `MULTIPLAYER_TOPOLOGY_AND_SYNC.md`) have no callers in the JS. So it
is not causing a visible bug yet. **To do: decide whether it should be, and what the rule is.**
Anything that relies on the entity's stored rotation, or on `update.rotations` (e.g. multiplayer
remote-player facing, or a future component that follows the player's orientation), would miss
the changes listed above, most noticeably the up-direction transition, which rotates the pivot
without any message.

Questions to settle:
- Should the look-in-direction / up-direction methods call `methodSetRotations(...)` after they
  change the pivot (the `...Delta` arguments are speeds for mouse-look; what should they be here)?
- Or should rotation be read by consumers straight from the pivot/camera (the getters above)
  instead of via messages, which would make the broadcast unnecessary?
- Whichever it is, it should be consistent: either every rotation change is broadcast, or none are.
- **File:** `entity components/movement/camera_controller_first_person.js` (and
  `classes/ECS/entity.js` for `methodSetRotations`).

## 10. PRIORITY: player stuck in the air — the "nearest face" and "within the face" checks can disagree

**Symptom:** the player hangs in mid-air in the `Falling` state and never falls.

**Reproduction (found with the debug snapshot, `window.debugSnapshot()` / key `P`, 2026-10-13):**
- Planet at `(0,0,-50)`, radius 20 (`worldDefault.json`).
- `gravityState: "Falling"`, `currentFaceIndex: 7`, position `(-14.56, -1.47, -32.56)`,
  `distanceToPlanetCenter: 22.77`, `distanceToPlanetFace: 6.02` (above the floor),
  `isCurrentFaceWithinWalls: "N"`, `isCurrentFaceAboveFloor: "Y"`, `velocity: (0,0,0)`.
- No `nearestFaceIndex` key in the snapshot, so the nearest face **is** the current face (face 7).
- Two snapshots 1.5 s apart were identical (position, state, face): genuinely stuck.

**Cause (read from the code, matches the snapshot):** `methodUpdateByStateFalling` is one
`else if` chain. After the `FallingFar` check, the branch `else if(!this.#isWithinFace)` only calls
`methodShouldUpdateToNearestFace(...)`, which returns immediately when the nearest face equals the
current face. Nothing after that branch can run, so **no gravity is applied**. The branch that
would apply a weak gravity for exactly this case (`else if(!this.#isWithinFace) {... * 0.1}`) has the
same condition and is **unreachable (dead code)**. This chain predates the 2026-10 changes
(present in commit `dfa7722`).

**Why the two answers disagree:**
- *Nearest face* is chosen by direction from the planet center (`methodGetMostAlignedFace`; "we do
  not care about distances"): a clean partition of space, no gaps.
- *Within the face* (`#isWithinFace`) = above the floor AND within the walls: a triangular **prism
  extruded along the face normal**. Above a convex edge or corner, neighbouring prisms diverge and
  leave a wedge-shaped gap that grows with height. A player in the gap is outside both prisms, while
  the direction-based nearest face is still the current one.
- Other states use the same pattern: `FallingFar` (and `Jumping`) also do "outside the prism -> update
  the nearest face" with nothing else, and the gap is widest at the heights `FallingFar` runs at, so
  the same freeze is likely possible there.

**Plan, in this order:**
1. **Safety net (do first, small):** no state may leave the player with nothing acting on them. In
   the "outside the walls and the nearest face is unchanged" case, apply the weak downward gravity
   (what the dead branch was meant to do), and remove the dead branch. Expectation (reasoning, not
   yet tested): falling along the face normal keeps the sideways offset but changes the direction
   from the center, so the nearest face eventually flips to the neighbour, the face index changes
   and the player lands. Verify with the snapshot. Check `FallingFar` and `Jumping` for the same shape.
2. **Fix the face selection (root cause):** a method on `EntityComponentPlanetFaces`, e.g.
   `methodGetFaceContaining(position, hintIndex)`, used by `EntityComponentGravity.methodShouldUpdateToNearestFace`
   instead of `methodGetNearestFace`:
   1. check the **current face's prism** (stay on it if still inside: avoids flip-flopping between
      faces and the up-direction transition each switch triggers);
   2. else check the **neighbouring faces' prisms**: `#faceNeighborsDirect` (share an edge) first,
      then `#faceNeighborsDiagonal` (share only a corner), because above a corner several faces meet
      (5 on an icosahedron), not just two. Together the two lists are exactly the faces sharing a
      corner with the current face. (The lists are private fields; the new method lives in the same
      class, so no getters needed.);
   3. else **fall back to the most-aligned face** (the existing check).
   Above the surface on a convex planet a position is inside at most one prism (prisms diverge);
   below the floor they can overlap, which is why "within" also requires "above the floor".
   The fallback can still pick a face whose prism does not contain the player (they may be in a gap),
   so step 1 (the safety net) is still needed; the two fixes do not replace each other. Selection
   fixes how often it happens, the safety net guarantees nothing can freeze.
3. **Coverage check (debug tool):** a debug function that samples many points around the planet at
   several heights and counts how many are in a blind spot (no containing prism, and the nearest
   face's own prism does not contain them). Turns "this can happen" into a number, and shows whether
   step 2 closes the gaps. Could live next to the debug snapshot (`entity components/debug/`).
4. **Re-test** with the original reproduction position above, then walk the player over several
   edges and corners at different heights.

- **Files:** `entity components/environment/planet.js` (`EntityComponentGravity`:
  `methodUpdateByStateFalling`, `methodUpdateByStateFallingFar`, `methodUpdateByStateJumping`,
  `methodShouldUpdateToNearestFace`; `EntityComponentPlanetFaces`: `methodGetMostAlignedFace` /
  `methodGetNearestFace`, `methodGetIsWithinFace`, the neighbour lists),
  `entity components/debug/debug_snapshot.js`.

## 11. Replace "string indices" / magic numbers with `Object.freeze({...})` constants

Several places identify a case by a bare string or a bare number. Replace them with frozen constant
objects (e.g. `const GravityStates = Object.freeze({ Landed: "Landed", Falling: "Falling", FallingFar: "FallingFar", Orbit: "Orbit", ... })`),
and use `GravityStates.Orbit` instead of `"Orbit"` / `2`. A typo in a raw string or a wrong number fails
silently; a typo in a frozen-object property is at least visible in a search, and the definition lives in one place.
No behaviour change; do it **after** the fall-through investigation (item 10) and the situation switch.

- **The falling-distance index — done (numbers -> state-name strings):** `methodOnFallingDistanceChanged` now takes
  `"Falling"` / `"FallingFar"` / `"Orbit"` (parameter `nameOfState`) in `EntityComponentGravity` (the seven handler
  calls and the receiver) and in the three components that `switch` on it: `EntityComponentVelocity.methodSetVelocityCap`,
  `EntityComponentPlayerController.methodSetMovementSpeed`,
  `EntityComponentCameraControllerFirstPerson.methodSetGravityTransitionAngularSpeed` (and its `#pitchShouldClamp`).
  What is left here is only replacing those raw string literals with the frozen constants below.
- **`EntityComponentPlanetFaces.methodGetDistanceState(index)` — still numeric:** its numbering is the opposite of the old
  falling-distance index (`1` = the `Orbit` cutoff, `0` = the `FallingFar` cutoff), and now that the falling-distance
  argument is a state name it is the one remaining place that still takes a number. Take a name
  (`methodGetDistanceState("Orbit")`) so the two cannot be mixed up. Call sites: the `Orbit` / `FallingFar` / `Falling`
  updates and the lazy-load `spawn` region in `EntityComponentGravity` (five calls, with `1` or `0`).
- **The state machine's own state strings** (`"Landed"`, `"Crossing"`, `"Jumping"`, `"None"`, ...): same frozen object,
  shared by the gravity component and everything that reads the state (`methodGetState() == "Landed"` in `velocity.js`,
  the debug snapshot).
- **The new "situation" values** from the branch-chain rewrite (`OutsideWalls`, `BelowFloor`, `BelowRange`, `InRange`,
  `AboveRange`): define them as a frozen object from the start (`FaceSituation`), not as raw strings.
- **Where the constants live:** decide on a shared module (e.g. next to `classes/state-machine/`, or an
  `environment/` file) that gravity, velocity, the player controller, the camera controller and `PlanetFaces`
  can all import without circular imports.
- **Precedent already in the repo:** `entity components/context/singleton/context_hud_layout.js` exports
  `Object.freeze` enums named `...Enum` (`HUDCubeHorizontalAlignmentEnum`, `HUDPanelYawBehaviorEnum`). Follow that
  naming (`GravityStateEnum`, `FaceSituationEnum`) and the same export style, so the new ones match.
- **A reminder:** a `switch` over these values still will not warn about a missing case in JavaScript; keep a
  `default:` that logs an error.

## 12. Gravity direction jumps at the `Orbit` -> `FallingFar` boundary: smooth it (two states, or a blend)

**Problem:** in `Orbit`, gravity points at the planet center (`#methodApplyGravityTowardsPlanetCenter()`). One frame later, in
`FallingFar`, it points along the current face's normal (`#methodApplyDownwardGravity()`). For the same position the two directions
can differ by several degrees (it depends on where the player is above the face). The velocity carried out of `Orbit` is aimed at the
center and only slowly bends towards the face normal; the camera's up direction also swings from "away from the center" to the face
normal at that moment (see the re-level discussion in item 7).

**Idea from the user (two states):** split `FallingFar` by how it was reached.
- `FallingFarFromOrbit` (temporary name): still has some velocity towards the planet center (as `Orbit` does), combined with some
  velocity along the current face normal (as `Falling` does).
- `FallingFarFromSurface` (temporary name): only velocity along the current face normal.

**Alternative (suggested, not decided): one `FallingFar` state, with the gravity direction blended by position.**
- Blend between the two directions only inside the `FallingFar` band:
  weight = smoothstep(distanceToPlanetCenter, nearCenterDistance, orbitCenterDistance); direction = normalize(lerp(-faceNormal,
  towardsPlanetCenter, weight)). Weight 1 at the `Orbit` boundary (central gravity), 0 at the `Falling` boundary (face-normal gravity).
- Why prefer it: a state per history multiplies states (handlers in the state machine's `prev -> new` table, a falling-distance
  notification for each, a rule for when "from Orbit" ends), while the history is already in the velocity (an inward velocity from
  `Orbit`, an upward one after a jump). A position-only law has no extra state and no hysteresis.
- A player who jumped up from the surface would get a little central pull at the top of the band (physically consistent). If that
  should never be felt, narrow the blend range.
- The same blend could drive the camera's up direction ("up = opposite the blended gravity"): up then fades from radial to face
  normal while descending through the band, instead of swinging at the `Orbit` exit. Goes naturally with the `Frozen` up-transition
  mode in `Orbit` (item 7): frozen in `Orbit`, then a gradual re-alignment through `FallingFar`.
- Two distance measures at the band's ends: the `Orbit` boundary is a distance from the center, the `Falling` boundary a distance from
  the floor. Use the center distance for the blend; the lower end is the `Falling` cutoff converted to a center distance (about the
  inradius plus that cutoff). Item 5 (named, per-planet thresholds) would make this cleaner.
- It is tuning rather than logic: the blend curve and range are to be adjusted by feel.

**Decide after trying `Frozen` in `Orbit` (item 7).** If the two-state version is preferred, use the enum style from item 11 for the
new state names.

- **Files:** `entity components/environment/planet.js` (`EntityComponentGravity`: `methodUpdateByStateOrbit`,
  `methodUpdateByStateFallingFar`, the `Orbit` -> `FallingFar` handler, `#methodApplyGravityTowardsPlanetCenter`,
  `#methodApplyDownwardGravity`), `entity components/movement/camera_controller_first_person.js` (up direction, if the blend also
  drives up).

## 13. Arrival speed when falling in from `Orbit`: make the velocity cap follow the height

**Measured (2026-10-15, hold `0` to go out to `Orbit`, then wait; sampled every 40 ms):** after `Orbit`, the player enters
`Stratosphere` at about 90 from the planet center (floor distance about 75) with the stored velocity clamped to about 114
(`methodClampVelocity()` in gravity's generic transition callback; before the clamp it was over 6000). The descent to the floor
then takes under a second, and the player lands at about **77 units per second** of actual movement (`Falling` at floor 49,
`Landed` at floor 2).

**Why it does not slow down:**
- **The stored speed holds at about 110.** Gravity adds roughly 0.5 per frame (0.25 down + 0.25 towards the center in the mixed
  gravity from `Orbit`, 0.5 down otherwise), and friction removes 0.5% per frame; they balance at 0.5 / 0.005 = about 100. So a
  stronger or weaker pull changes the stored speed, but the *actual* speed is limited by the cap.
- **The velocity cap eases too slowly for this drop.** `methodChaseVelocityCap` moves the cap at 50 units per second, so from
  115 it reaches only about 75 in 0.8 s. The whole descent is shorter than that, so the cap never gets near 15.
- `Falling` does not change it: its cap target (`#velocityCapMin`) is the same as `Stratosphere`'s.

**Options (not decided):**
- **Height-based cap (preferred idea):** compute the cap from the distance, e.g. 115 at the top of the `Stratosphere` band and 15 at
  the `Falling` boundary (about floor distance 50), using the center distance like the `Orbit` boundary. History-free (no
  "from Orbit" flag needed in Velocity), and it ties in with the gravity blend in item 12: the same weight could drive both.
  Velocity would take a target cap (or the weight) from gravity each frame instead of a per-state value.
- **Faster time-based easing:** raise the chase speed in `methodChaseVelocityCap`. Simple, but tuned to this drop's duration only.
- **Also clamp the stored velocity to the cap** each frame (soft clamp) so a high stored speed cannot sit behind a low cap.
- Small related fix: `methodChaseVelocityCap` runs after the "velocity is zero" early return in `methodUpdate`, so the cap does
  not ease while the player is still. Move it above that return.

**Naming to tidy when touching this** (`methodGetSubstateStratosphere`): its `"AboveRange"` / `"BelowRange"` mean "go to `Orbit`" /
"go to `Falling`", while the same names in `methodGetSubstateFalling` mean "go up to `Stratosphere`" / "land". Names like
`TransitionToOrbit` and `TransitionToFalling` would not clash. Also decide whether the `BelowRange` check in `Stratosphere`
should keep requiring `isWithinFace` (within the walls and above the floor): without it, `Falling` would take over as soon as
the floor distance drops below 50, even slightly outside a face's walls.

- **Files:** `entity components/movement/velocity.js` (`methodChaseVelocityCap`, `methodSetVelocityCap`, `methodUpdate`),
  `entity components/environment/planet.js` (`methodGetSubstateStratosphere`, `#methodApplyMixedGravity`,
  `#methodApplyDownwardGravity`, gravity's generic transition callback).

## 14. After picking a world on the main menu, the player flashes close to the planet, then jumps far away

**Symptom (reported 2026-10-15):** for a split second after pressing a world selection, the player appears very close to the planet.
The next split second, they appear to have been moved far away from it.

**Likely cause (read from the code, not yet confirmed at runtime):** the camera pivot is created at the origin and given no position
(`main.js`, `cameraPivot = new THREE.Object3D()`; the `position.z = 5` line is commented out). `EntityComponentSpawnOnPlanetFace` only
places the player once its lazy-load completes, and that waits until the planet's face data is ready (the planet model has to load and
be parsed first), which takes some frames. Until then the scene renders from `(0, 0, 0)`. In `worldDefault.json` the planet is at
`(0, 0, -50)` with radius 20, so the origin is only about 30 from its surface ("very close"). When the spawn finally runs, it moves the
player to the face center plus the normal times `faceDistance` (now 300), and the view jumps far away.

**To confirm:** sample the camera pivot's position on each of the first frames after the world loads (a `requestAnimationFrame` loop
started on the menu click), and see which frame the position changes from the origin to the spawn position. The debug snapshot only
exists after the lazy-load, so it cannot show this.

**Options (not decided):**
- **Don't render the world until the spawn has happened:** keep the menu or a loading screen up until `EntityComponentSpawnOnPlanetFace`
  reports `methodGetIsReady()` (it already exposes it), then show the world. Probably the cleanest.
- **Start the camera in a sensible place:** give the pivot an initial position that matches where the spawn will put it (e.g. read
  `faceDistance` and the planet position), so the first frames are already roughly right. Fragile: the spawn face can be random.
- **Hide the canvas for the first frames** (CSS opacity or the renderer skipping drawing) until the spawn has run. The smallest change,
  but it hides the problem instead of fixing the ordering.
- The same ordering issue may affect other entities that wait for the planet (gravity waits for the spawn component), so check that
  the first frames are not also running gravity or camera logic with default values.

**Direction chosen (2026-10-15): a rudimentary loading screen while we wait.** Sketch:
- **Where it hooks in:** `EntityComponentSingletonContextInitialization.methodConfirm()` broadcasts `initialization.confirmed`
  (the world generator builds the world on it, and `main_menu.js` listens to it to leave the menu); `methodReturnToMainMenu()`
  broadcasts `initialization.returnedToMenu`. A small UI component, in the style of `main_menu.js`, would show a plain "loading"
  overlay on `initialization.confirmed` and remove it on `initialization.returnedToMenu`.
- **When it goes away:** each frame it checks that the local player entity's `EntityComponentSpawnOnPlanetFace.methodGetIsReady()` is
  true (that flag already exists), then removes itself, so the first frame the player sees is already the spawn.
- **Worlds without a spawn component** (non-planet worlds) must not wait forever: treat "no such component" as ready, and
  consider a timeout that logs a warning.
- Keep it rudimentary: an opaque full-screen element and some text. No progress bar needed.

**Decision (2026-10-21): "version A", the initialization context is the hub.** `EntityComponentSingletonContextInitialization` already
owns the confirm -> return lifecycle, and `EntityComponentMainMenu` already reacts to it; "ready" is the missing step.
1. **Context:** add `methodReportReady(reason)` next to `methodConfirm()` in `context_initialization.js`. It ignores the call if the world
   is not confirmed, and otherwise broadcasts `initialization.ready` (value: the reason, e.g. `"player.spawned"`) with
   `methodSendMessageToEntitiesWithComponent("EntityComponentMainMenu", ...)`, in the same style as `initialization.confirmed`.
2. **Spawn:** at the end of `EntityComponentSpawnOnPlanetFace`'s lazy-load, after its ready flag is set, report to the context:
   `this.methodGetEntityByName("SingletonContextInitialization")?.methodGetComponent("EntityComponentSingletonContextInitialization")?.methodReportReady("player.spawned");`
   Only the local player's spawn may report (remote players may have the same component): guard it there or in `methodReportReady`.
3. **Loading screen:** a new component `EntityComponentLoadingScreen` in `entity components/ui/`, added **to the same entity as the main menu**
   in `main.js` (next to `entityMainMenu.methodAddComponentWithName("EntityComponentMainMenu", ...)`, around line 257). Messages are
   delivered to the whole entity, so it receives `initialization.confirmed` / `initialization.returnedToMenu` without any change to the
   context's send lists. It shows on `initialization.confirmed`, hides on `initialization.ready` and on `initialization.returnedToMenu`.
4. **Timeout:** in its `methodUpdate`, if the overlay has been up for about 10 seconds, hide it and `console.warn` (worlds with no spawn
   component must not hang on it).
5. **Reset:** the overlay's "waiting" state starts again on each `initialization.confirmed`, so picking a second world works.
Note: the main menu and the world generator are added in `main.js` (not from JSON), so the new component is **not** registered in
`registry.js`, which only holds the JSON-loadable ones.

- **Files:** `main.js` (`cameraPivot` creation), `entity components/environment/planet.js` (`EntityComponentSpawnOnPlanetFace`
  lazy-load), the world load / menu code (`entity components/generation/world_generator.js`, `main_menu.js`,
  `context/singleton/context_initialization.js`) and a new small UI component for the loading screen (added in `main.js`).

## 15. Audit: where could the ECS broadcast-message system be used, and is not?

**Goal:** go through the places where components talk to each other directly (`methodGetComponent(...)` then a method call), and
decide, case by case, whether the entity's message system (`methodSendMessageWithinEntity` / `methodRegisterMessageHandlerWithinEntity`,
and `methodSendMessageToEntitiesWithComponent` across entities) is the better fit. Not a rewrite: a classification, then changes
only where a message is genuinely clearer.

**How the message system is used today (survey, 2026-10-19):**
- *Sent by the entity's own setters:* `update.position`, `update.dir.up`, `update.dir.facing`, `update.rotation`, `update.rotations`
  (`classes/ECS/entity.js`).
- *Listened to:* `update.position` (camera controller, and two handlers in `test_objects.js`). `update.dir.up`, `update.rotation`
  and `update.rotations` currently have **no listeners** (see item 9).
- *Sent across entities:* `initialization.confirmed` / `initialization.returnedToMenu`, to the main menu and the world generator
  (`context_initialization.js`; handlers in `main_menu.js` and `world_generator.js`).
- A message is delivered synchronously, in the order handlers were registered, only within one entity (or to the entities that have
  a named component). It carries no return value.

**Candidates to look at first (direct calls that are really notifications):**
- `EntityComponentGravity` -> velocity / player controller / camera: `methodOnFallingDistanceChanged(...)` and the generic
  `methodOnStateGravityChanged(prevState, newState)`. The code already has a comment asking "is this not what the broadcast message
  system and handlers is for!?". A `gravity.state.changed` message with `{prevState, newState}` would let each component subscribe
  instead of gravity knowing all of them (and the optional-component `?.` checks would disappear).
- *Readiness polling in the lazy-load methods:* gravity polls `spawn.methodGetIsReady()`, velocity waits for gravity, the camera waits for
  its input sibling, the debug snapshot waits for several. A `component.ready` (or `player.spawned`) message could replace per-frame
  polling. The loading screen (item 14) also needs a "spawn is ready" signal, so it is a natural first user.
- `EntityComponentSpawnOnPlanetFace` -> camera: `methodSetDirUpWithoutTransition(...)` and `methodLookAt(...)` after spawning.
- `EntityComponentGravity` -> camera `methodSetDirUp(...)` when the face changes or in `Orbit`. The entity already broadcasts
  `update.dir.up`; check whether the camera could listen to that instead of being called.
- Rotation changes (item 9): the camera could broadcast `update.rotations` for every rotation change, not only mouse-look.

**Probably stay direct (queries, and commands that need a result or an exact order):** reading a value (`methodGetState()`,
`methodGetVelocity()`, the debug snapshot's getters), adding velocity (`methodAddToVelocity...`), `methodNullifyGravity`, and anything
where the order of two calls matters (e.g. the `Orbit` -> `Stratosphere` pair handler must run before the generic callback; a message
would hide that order).

**Questions to settle while auditing:**
- The state machine already has its own handler system (`methodRegisterHandler`, `methodRegisterHandlerOnAny`). Should state changes be
  *re-broadcast* as an entity message by one handler, so there is a single way for other components to hear about them?
- Message names: keep the dotted style (`gravity.state.changed`), and put the names in one place (an enum, in the style of item 11) so
  a typo is not silent. A handler registered under a misspelled name never fires and nothing complains.
- Debuggability: a stack trace through a message is harder to follow than a direct call. Consider a dev-only log of every message sent.
- Ordering and re-entrancy: a handler that sends another message runs nested, inside the sender's call. Note where that could surprise.

**Suggested method:** `grep` for `methodGetComponent(` in code that runs after initialization, and label each cross-component call as
*query*, *command with a result*, *notification*, or *readiness polling*. Only the last two are candidates. Do the loading screen's
readiness message first, as the smallest real use.

- **Files:** `classes/ECS/entity.js`, `classes/ECS/entity_component.js` (the message API), and the components above:
  `entity components/environment/planet.js`, `movement/velocity.js`, `movement/player_controller.js`,
  `movement/camera_controller_first_person.js`, `debug/debug_snapshot.js`.

## 16. Single shared time object; remove `timeElapsed` / `timeDelta` as parameters

> Full design: `TIME_AND_MAIN_LOOP_THREEJS.md` (in the shared `threejs/` docs folder, not in
> this repo). This item is only the work tracker.

**Decision:** `main.js` stays the only place time is measured (`clock.getDelta()` /
`getElapsedTime()`, `update()` around line 479). Each frame, right after those two reads and
before `updateEntityComponentSystem()`, it calls `methodSetTime(...)` on ONE shared time
object: a new startup context, `EntityComponentSingletonContextTime` on an entity named
`"SingletonContextTime"` (separate from `...Engine`, which stays a plain holder). That object
is the **single source of truth** for time.

**It holds two clocks** (pause menu is wanted): real time (`realElapsed`/`realDelta`, never
pauses) and game time (`gameElapsed`/`gameDelta`, derived in the setter from `paused` and
`timeScale`). Large deltas are clamped once, at the source.

**Why:** `methodInitialize()` and message handlers have no clock today (`entity.js:245/259`
call `methodInitialize()` with no arguments; `entity.js:365` calls handlers with only the
message). Anything created there that expires later (chat entries, projectiles, particles,
buffs) needs `spawnedAt = now`. A shared object works in every place; the parameters only work
in `methodUpdate`.

**Phase 1 (DONE, committed 2026-11-07; verified in browser): keep both.**
- Add the time context, written once per frame in `main.js`.
- Keep `methodUpdate(timeElapsed, timeDelta)` as it is, so nothing breaks.
- New code that needs time outside `methodUpdate` reads the time object.

**Phase 2 (explicit TODO, not started): remove the parameters.**
- Remove `timeElapsed` / `timeDelta` from every `methodUpdate` signature
  (`EntityManager.methodUpdate`, `Entity.methodUpdate`, `EntityComponent.methodUpdate`, all
  subclasses) and from the calls in `entity_manager.js:112`, `entity.js:330`, and `main.js:529`.
- Components read time only via the time object. No second route.
- Not purely mechanical: the old parameters carry **real** time, so each consumer must now
  choose real vs game time explicitly.
- Do it as its own focused commit.

**Open:** `maxDelta` value; real vs game time for chat lifetimes (leaning real); what triggers
pause and what must keep running during it (e.g. voice capture).

First consumer (next): `EntityComponentChatList` message lifetimes; see `push-to-talk-voice-to-text.md` "Progress and revisions" (shared docs folder) for the ChatList build order.

Not done in phase 1: `EntityComponent` shorthands for the getters; `methodUpdateTime` is a duplicate alias of `methodSetTime` (remove); `methodSetTimeScale` has no negative/NaN guard.

## 17. Optional: rewrite history so every commit is authored by `dilsency` (needs a force-push)

**Background:** every commit in this repo was meant to be `dilsency <dilsency@gmail.com>`. Some
were made under `NilsTillaeus` (a different local git name, same email `dilsency@gmail.com`) and
3 under `NilsTillaeus <nils.tillaeus@gmail.com>` (the other account, used by accident). The global
git name on the main workstation is now `dilsency`.

**Done (non-destructive):** a `.mailmap` in the repo root maps both to `dilsency <dilsency@gmail.com>`.
`git log` (with `%aN`/`%aE` or the default format) and `git shortlog` show all 72 commits as
`dilsency`. No hashes changed. GitHub's web UI ignores `.mailmap`, so commits made under
`nils.tillaeus@gmail.com` may still show the other account there.

**Open (only if wanted): the full rewrite.**
1. Back up first: `git clone --mirror` of the repo (or a backup branch).
2. On a fresh clone: `git filter-repo --mailmap .mailmap` (reuses the existing file).
3. `git push --force origin main`. Every commit from the first rewritten one onward gets a new hash.
4. **Every other workstation:** discard or save local work, then `git fetch` and
   `git reset --hard origin/main`. Unpushed commits there must be rebased onto the new history.
5. Once the history is clean, `.mailmap` can be deleted.

**Why it is optional:** purely cosmetic (GitHub already attributes by email for the
`dilsency@gmail.com` commits). The cost is new hashes, a force-push, and a reset on the other
workstation. Not worth it unless the three `nils.tillaeus@gmail.com` commits showing as another
account on GitHub bothers you.

## 18. Input classes are NOT future-proof: controlling-options must be attachable and detachable at runtime

**The current version is NOT future-proof.** The choice of input is made ONCE, at startup, and never
revisited.

**How it works today:**
- `context_environment.js:35` computes `#isTouchPrimary` once:
  `('ontouchstart' in window) || (navigator.maxTouchPoints > 0)`.
- `EntityComponentPlayerController.methodInitializeAttachment()` ("Pattern C", `player_controller.js`
  around line 492) reads it a single time and attaches EITHER `EntityComponentPlayerControllerInputTouch`
  OR `EntityComponentPlayerControllerInput` as a sibling, under the one slot name
  `"EntityComponentPlayerControllerInput"`. `camera_controller_first_person.js` (around line 584) does
  the same for its own Input classes.
- Entities have no remove-component method, so a chosen sibling can never be detached.

**What goes wrong:**
- A player can attach or detach controlling-options at any time (a Bluetooth keyboard on a tablet,
  a controller, a mouse). Nothing is noticed after startup.
- A laptop with a touchscreen has `maxTouchPoints > 0`, so the touch Input wins and the keyboard Input
  is never attached at all.
- Keyboard + touch are not mutually exclusive, so "pick one" is the wrong model.

**What it needs to be able to do, in the future:**
- Handle attaching AND detaching various controlling-options at runtime (keyboard, touch, and later
  gamepads or other peripherals), without a restart and without leaking listeners.

**Ideas (not decided):**
- Attach all available Input classes and merge their `keys` (they do not conflict), instead of picking
  one at startup. The consumer reads one merged result.
- OR: one Input wrapper component that owns the shared state and holds a set of plain "source" objects
  that can be added and removed at runtime. This is the same shape as the voice transcriber wrapper
  plus backends (see `push-to-talk-voice-to-text.md`, shared docs folder).
- Detecting a change: `pointer: coarse` media query change events, first touch / first key press seen,
  and gamepad connect / disconnect events.
- Every source must remove its listeners on detach (the listener cleanup in `player_controller.js`
  was already done as a separate small change).

**Open:** what to merge when two sources disagree (e.g. both press forward); whether the camera
controller's Input classes should share the same mechanism; how a source announces itself.

## 19. Possible alternative: voice "tail" delay driven by `methodUpdate` and the time object, instead of `setTimeout`

**Background:** when the push-to-talk key is released, calling the recognizer's `.stop()` at once usually
cuts off the last spoken word. `VoiceTranscriberCloud` (`entity components/voice/transcriber.js`) therefore
delays `.stop()` by `#timerTailDuration` (300 ms, tuned by ear) using `setTimeout`. A new press during the
delay cancels the pending stop and the recording simply continues.

**The alternative (not chosen for now):** `EntityComponentVoiceTranscriber` (the wrapper) counts the delay
down in its own `methodUpdate`, using the shared time object (`this.methodGetTimeElapsed()`, REAL time so a
pause does not stretch it):
- On a stop request, store `timeStopAt = now + tail`, and do not stop yet.
- In `methodUpdate`, when `now >= timeStopAt`, call the transcriber's `methodStopRecording()` and clear it.
- A new start request while a stop is pending clears `timeStopAt` (same "keep recording" behaviour).

**Pros:**
- One clock: `main.js` stays the only place time is measured; nothing else owns a timer.
- No timer handle to clear in dispose or on a backend swap.
- Applies to every backend (Local/Whisper too), and the wrapper can expose a "stopping" state for the
  planned "currently recording" indicator.
- Runs in step with the frame loop and the rest of the ECS.

**Cons:**
- More code than a `setTimeout`, for the same visible behaviour.
- Frame granularity (about 16 ms), which is negligible against a 300 ms tail.
- The tail is a property of Web Speech; Whisper may need a different value or none. It would need to come
  from the backend (e.g. a `methodGetTailDuration()`), not be a constant in the wrapper.

**Decision:** keep `setTimeout` inside `VoiceTranscriberCloud` for now. Revisit when the Local (Whisper)
transcriber is added, or when the recording indicator needs a "stopping" state.

## 20. Optional: console diagnostics for voice sessions that produce no text and no error

**Status:** not implemented, on purpose. Written down so it can be added quickly if "sometimes nothing is
transcribed" becomes a real problem. All lines are **console only**, never chat. Files:
`entity components/voice/transcriber.js` (Cloud class and wrapper) and `context_voice.js`.

**Why:** Web Speech can end a session with no result and no `onerror`, and several code paths return
silently. Today nothing shows which one happened. A prime suspect: pressing V again before the previous
session's `onend` fired, so `methodStartRecording` returns early at its `#isRecording` check.

**Convention:** one prefix for every line, `voice : ...`, so they can be filtered in the console.
Optionally wrap them in one `#isDebug` flag (default `true`) so they can be switched off in one place.

**1. Cloud class, `methodStartRecording`**
```js
if(this.#timerTail != null)
{
    console.log("voice : press during tail delay, continuing the current recording");
    clearTimeout(this.#timerTail);
    this.#timerTail = null;
    return;
}
if(this.#isRecording)
{
    console.log("voice : start ignored, the previous session has not ended yet");
    return;
}
```

**2. Cloud class, `methodStopRecording`**
```js
if(!this.#isRecording)
{
    console.log("voice : stop ignored, not recording");
    return;
}
if(this.#timerTail != null)
{
    console.log("voice : stop ignored, a stop is already pending");
    return;
}
```

**3. Cloud class, transcript loop**
```js
if(!iteration.isFinal)
{
    console.log("voice : skipped a non-final result");
    continue;
}
// ... after trimming
if(trimmedText.length <= 0)
{
    console.log("voice : skipped an empty result");
    continue;
}
```

**4. Cloud class, "session ended with no transcript"** (new private field `#hasTranscriptThisSession`)
```js
// methodStartRecording, after start() succeeds:  this.#hasTranscriptThisSession = false;
// transcript loop, right before delivering:      this.#hasTranscriptThisSession = true;
// methodHandleOnEnd:
if(!this.#hasTranscriptThisSession)
{
    console.log("voice : session ended with no transcript");
}
```

**5. Cloud class, recognizer lifecycle events** (in the constructor)
```js
this.#instanceVoiceRecognizer.onaudiostart = () => console.log("voice : audio capture started");
this.#instanceVoiceRecognizer.onspeechstart = () => console.log("voice : speech detected");
this.#instanceVoiceRecognizer.onspeechend = () => console.log("voice : speech ended");
this.#instanceVoiceRecognizer.onnomatch = () => console.log("voice : no match");
```
`methodDispose` must set these four to `null` too, BEFORE `abort()`, like `onresult`/`onend`/`onerror`.
How to read them: no `audiostart` = the mic never reached the browser (relevant over Remote Desktop mic
redirection); `audiostart` but no `speechstart` = no speech detected; `speechstart` but no result = the
service returned nothing.

**6. Wrapper, `methodStartRecording`**
```js
if(this.#swappableTranscriber == null)
{
    console.log("voice : start ignored, no transcriber (mode None)");
    return;
}
if(!this.#swappableTranscriber.methodGetIsSupported())
{
    console.log("voice : start ignored, this browser does not support the transcriber");
    return;
}
```

**7. Context, key handler** (optional)
```js
// methodEventOnKeyDown
if(this.#mode === EnumModeVoiceTranscriber.None)
{
    console.log("voice : V ignored, mode is None");
    return;
}
```
Do NOT log the `e.repeat` early return: a held key fires it about 30 times a second.

**Other likely cause that needs no code:** a very quick tap. `stop()` right after `start()` often gives no
result, because the recognizer needs a moment to connect. Related: the tail delay (item 19) exists because
`stop()` at once cuts off the last word.
 
---
 
## 21. Local (offline) voice transcription: implement `VoiceTranscriberLocal`
 
Status: `VoiceTranscriberLocal` in `entity components/voice/transcriber.js` is a stub, and the "Local" radio button
on the Main Menu selects it. Selecting it works, but pressing V does nothing, because `methodGetIsSupported()` is false.
Size: medium-large. A working prototype is about one focused session; a polished version is a few.
 
**What already exists (the easy part).** The wrapper (`EntityComponentVoiceTranscriber`), the mode switch, the radio
button and the chat output are all in place. The Local class only has to match the Cloud class's shape:
constructor `(language, onTranscript, onEnd, onError)`, plus start / stop / dispose / `methodGetIsSupported`.
 
**Hurdles**
 
1. **Audio capture.** `SpeechRecognition` records for us; locally we must do it ourselves.
   `getUserMedia`, then `MediaRecorder` or an `AudioContext`, producing 16 kHz mono PCM (what Whisper expects).
   The tail delay (see item 19) still applies. About 50-100 lines.
2. **Running the model.** Likely transformers.js (`@huggingface/transformers`), e.g.
   `pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en")`. Run it in a Web Worker so inference does not
   freeze the render loop. This is the biggest piece: a separate worker file, a message protocol between worker and
   component, and making sure Vite bundles the worker correctly (also for the GitHub Pages build).
3. **Model download.** `whisper-tiny.en` is about 40 MB, `base.en` about 75 MB. The first use needs a loading state;
   the chat list can report progress, as the world generator does. The browser caches the model afterwards.
4. **Latency.** Local transcription is batch, not live: release V, the audio is processed, the text appears
   about 1-3 seconds later (depends on the device and on WebGPU vs plain WASM). The UI should signal "transcribing...".
   This also fits the recording indicator that is planned anyway.
5. **Hosting.** GitHub Pages is fine (static), but the model is fetched from Hugging Face's CDN at
   runtime. No privacy warning is needed: audio and text never leave the device; only the model is downloaded (one way).
   Show "Downloading speech model (40 MB)" in the chat, and label the Main Menu radio button "Local (40 MB)".
6. **Quality.** The tiny models misrecognise more than Chrome's cloud engine. Compare `tiny.en` and `base.en`.
7. **Lifecycle.** `methodDispose` must terminate the worker and stop the mic stream tracks. Switching the mode
   away from Local mid-download or mid-transcription needs a cancellation story.
8. **Errors.** Mic denied, model download failed, no WebAssembly / WebGPU. Report through `#handlerOnError`, as Cloud does.
 
**Suggested approach**
 
1. Throwaway spike first: record 3 seconds, run it through the model, print the text to the console. No ECS, no worker.
2. If that works: move inference into a worker, then build `VoiceTranscriberLocal` around it.
3. Then loading state / progress in the chat list, then `methodGetIsSupported()`.
 
**Depends on / related**
- Recording indicator (animating vector image), planned for cloud as well.
- Item 19 (tail delay driven by `methodUpdate`).
- Item 20 (voice diagnostics), where the log lines would apply to Local as well.
