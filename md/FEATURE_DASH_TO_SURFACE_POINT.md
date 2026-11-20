# Feature idea: the slowed approach state and the dash to a surface point

Status: **idea, not implemented** (written 2026-11-18, from the user's description). Nothing in the code exists for it yet. The
"Where it plugs in" and "Design options" sections are analysis of the current code, not decisions. The user's first answers are
recorded as decisions in section 6; the questions that remain open are listed there too.

Working names: **DashPoint** (the user's name for the hidden target point). The name of the special state and of the new input option
are not decided.

---

## 1. Summary

After falling in from `Orbit`, once the player is near enough to the planet, they enter a special state in which:

1. their movement is slowed severely, gravity included, while camera rotation is not;
2. they gain an input option they do not otherwise have: aim at a point on the planet's surface through the centre of the
   first-person camera, and press to confirm;
3. on confirming, a hidden target, the **DashPoint**, is created, their velocity is reset, and they are launched towards it so that
   they land close to it.

## 2. The mechanic, step by step

Taken from the description:

1. **Entry condition:** only after falling from `Orbit` (not from any other state), and only once the player is near enough to the
   planet. "Near enough" is not defined yet.
2. **Slowed movement** while in the state:
   - movement slows down severely, "including and especially velocity from gravity";
   - **camera rotation speed is not affected.**
   - Two candidate ways: apply only a portion of the player's velocity before translating the position, or scale down the time
     variable (deltaTime) for the player only. See section 4.1.
3. **A new input option**, available only in this state: pick a surface point by projecting out from the **centre of the
   first-person camera**, and **press to confirm**.
4. **The DashPoint** is created behind the scenes, unknown to the player:
   `DashPoint = selectedSurfacePoint + surfaceNormalAtThatPoint * idealCameraHeight`.
5. **Launch:** once the DashPoint exists, the player's current velocity is **reset to 0**, then they gain a velocity towards the
   DashPoint, enough to land them **close to it** (not exactly on it).

## 3. Where it plugs in (the current code, as read on 2026-11-18)

- **Gravity states** (`EnumStateGravity` in `classes/enums.js`): `None`, `Orbit`, `Stratosphere`, `Falling`, `Jumping`,
  `CrossingOver`, `Landed`. The state machine and its transitions live in `EntityComponentGravity` (`planet.js`).
- **Boundaries today:** `Orbit` to `Stratosphere` at `planetRadius * 5` from the planet centre (`methodGetDistanceState(1)`); the
  `Stratosphere` to `Falling` boundary is a floor distance of `planetRadius * 2.5` (`methodGetDistanceState(0)`). These are the
  numbers behind TODO item 5.
- **"Fell from Orbit" is already known:** the state machine keeps the previous state (`methodGetPrevState()`), and `Stratosphere`
  already behaves differently when the previous state was `Orbit` (it uses mixed gravity, `#methodApplyMixedGravity(0.5, ...)`).
- **On entering `Stratosphere` from `Orbit`**, the velocity is clamped (`methodClampVelocity()`); the velocity cap is chased between
  15 (min) and 115 (max) in `EntityComponentVelocity` (TODO item 13 is about this arrival speed).
- **The ideal camera height** is `#distanceFromFloorIdeal = 2.0` with a leeway of 0.5 (in `EntityComponentGravity`).
- **Surface normals:** the planet is a flat-faced icosahedron (20 faces); `methodGetFaceNormal(index)` and a floor plane and three
  wall planes per face already exist in `EntityComponentPlanetFaces`. For a flat face, "the surface's normal at that point" is the
  face's normal.
- **Velocity** (`velocity.js`): `methodUpdate` clamps a copy of the velocity to the cap, adds it scaled by `timeDelta` to the
  position, then decays the velocity by friction (0.995 per call, not scaled by `timeDelta`; horizontal friction is ten times
  stronger while `Landed`). Gravity works by adding to the velocity each frame.
- **Input:** separate classes per input kind (`EntityComponentPlayerControllerInput` and `...InputTouch`,
  `EntityComponentCameraControllerFirstPersonInputMK` and `...InputTouch`). The choice is made once at startup (TODO item 18).
- **Time:** `timeElapsed` / `timeDelta` are passed into every `methodUpdate` as parameters (TODO item 16 proposes one shared time
  object).

## 4. Design options

### 4.1 Slowing the player

| | Scale the applied velocity | Scale the player's deltaTime |
| --- | --- | --- |
| How | In `EntityComponentVelocity.methodUpdate`, translate by `velocity * factor * timeDelta`. | Give the player entity its own time scale and pass `timeDelta * scale` to its components. |
| Camera rotation unaffected | Automatically: only the velocity component reads the factor. | Only if the camera controller is excluded from the scaled time. |
| Gravity | **The stored velocity still grows from gravity every frame**, so the gravity increment must be scaled too, or the player carries a huge velocity out of the state. | Scales everything that reads the delta, gravity included. |
| Friction | Unchanged (it is per call). | Friction is per call, not per delta, so it would not slow down with the time scale. |
| Fits the current code | Yes: the state handler can set the factor the way `methodOnFallingDistanceChanged` sets the velocity cap today. | Needs a per-entity time, which is TODO item 16's territory. |

**Decision (2026-11-19): a third option, a fixed maximum velocity** (the state lowers the velocity cap; see sections 6.1 and 6.3).
The two options above are kept for the record.

First impression, before that decision: scaling the applied velocity (plus the gravity increment) is the smaller change. The time-scale option is the more
general one, but it touches everything on the player entity and needs the shared time object first.

### 4.2 Picking the surface point

- A ray from the camera centre along the view direction, tested against the planet. Two ways: three.js's `Raycaster` against the
  planet mesh, or ray-plane tests against the per-face floor planes that `EntityComponentPlanetFaces` already holds (plus the
  within-walls test it already has). The face tests also give the **face index**, which the gravity component needs later.
- The point must be validated: no hit (aiming at the sky) means nothing to confirm.

### 4.3 The launch

- **Decision (2026-11-18):** use the velocity impulse and try to account for the friction in its size; "good enough, testing
  required". The alternative of forcing a transition that translates the player towards the point while ignoring velocity is
  **not wanted**.
- **Velocity impulse** (as described) is only an approximation. With the current friction (a fixed 0.995 per call), the distance
  covered after one impulse of speed `v` is roughly `v * timeDelta / 0.005`, so **it depends on the frame rate** (about half as far
  at 60 fps as at 30 fps for the same `v`), and the velocity cap (15 by default) limits how fast the stored velocity can actually be
  applied. Gravity keeps adding to the velocity during the flight unless it is suspended.
- To land "close to" the DashPoint reliably the impulse would need to take those into account, or the launch could steer
  (re-aim the velocity towards the DashPoint each frame) instead of a single impulse.
- An alternative, outside the description: move along a path to the DashPoint over a fixed time. It arrives exactly and does not
  depend on the frame rate, but it is not physics-driven.

## 5. Interactions with other open items

- **TODO 18 (input not attachable at runtime):** the new input option exists only in this state, so it needs input options that can
  be attached and detached while the game runs. This feature is a concrete case for item 18.
- **TODO 13 (arrival speed from `Orbit`) and 12 (gravity direction jump at the boundary):** the slowed state could absorb some of the
  arrival-speed problem, but it also changes the same transition, so the three should be looked at together.
- **TODO 5 (centralized gravity-state boundaries):** the "near enough" threshold should be one more named boundary there, not
  another magic number.
- **TODO 16 (shared time object):** needed if the time-scale option is chosen.
- **TODO 10 (stuck in the air, PRIORITY):** a launch that ends in the wrong face, or hangs at the ideal height, could hit the same
  disagreement between the nearest-face and within-the-face checks.

## 6. Decisions and open questions

### 6.1 Decided (2026-11-18)

- **Entry threshold ("near enough"):** found by fiddling; it is a tuning value, not something to derive. It should still be a named
  boundary (TODO item 5), not a magic number.
- **The state ends** in whichever of these happens first:
  1. **The player confirms a point.** They have aimed the camera at a surface and pressed the confirm button. The state ends
     immediately and the dash happens. On this transition into the normal "falling while near the planet" state, the player's
     previous velocity is **nulled, once, on this transition only**, and then the dash velocity is added.
  2. **The player drifts down** towards the planet without picking a point, in which case the state ends as well (without the
     velocity reset: nothing is nulled on this path).
  3. **A time limit**, "just to be safe".
- **One dash per descent.** The state ends right after the dash, so there is no second dash and no re-aiming.
- **Confirm input:** the **left mouse button** for now (`event.button === 0` in the DOM numbering; it may become the spacebar).
- **Touch:** ignored to start with. A single tap anywhere on the screen could do later.
- **Camera:** full rotation as usual; the state does not change it.
- **Aim marker:** a tiny, semi-transparent, flat circle on the aimed surface point, angled to lie flat against the surface normal,
  following the camera as the player looks around. (The DashPoint itself, above the surface, stays hidden.)
- **The launch:** a velocity impulse that accounts for the friction as far as is practical, tested by hand (section 4.3).
- **The next state is chosen by a distance check at the moment the state ends** (the dash starting, or the drift-down exit), not
  fixed in advance. The player may have drifted down into another distance region before pressing confirm.
- **Normal gravity and unslowed movement return immediately** when the dash starts. If the game feel suffers from the abrupt change,
  the change can be lerped instead of set. The same goes for entering the state (lerp instead of hard-setting).
- **No maximum dash distance.**
- **REVISED (2026-11-20): the player can cancel.** The earlier "no cancel input" is dropped. The cancel input is any of: the
  **right mouse button**, the **control key** or the **escape key**.
- **REVISED (2026-11-20): the state suspends the velocity, it does not change it.** The game-feel idea is that the state
  temporarily slows down "time". The exits fall into two groups:
  - **The full old velocity returns:** the time limit runs out, or the player cancels. Nothing is saved or restored: the stored
    velocity is simply left alone in the state (the decay is skipped, see 6.2 item 6), so it is still there on exit.
  - **Handle the velocity independently:** touching the surface (the normal landing handling) or the dash (reset, then the
    impulse).
  - **Steering carries over (decided 2026-11-20).** WASD still works in the state and adds to the stored velocity as usual, so
    whatever the player added is part of the velocity that returns.
- **The state is named `Approach`** (see 6.2, item 4). The time limit exit and the cancel exit both lead back to `Falling` (a
  distance check at that moment, as for the other exits). Because `#hasBeenInOrbit` is reset on entry, a cancelled or timed-out
  state does not re-enter: one per descent.
- **Slowdown: one fixed maximum allowed velocity** (a speed cap while in the state), not a factor and not distance-dependent.
- **Time limit:** started at 6 seconds; **changed to 3 seconds on 2026-11-20** (`#timeLimitApproach`), to be iterated by feel.
- **No spacebar conflict.** The player can only jump while `Landed` (`methodExecuteActionJump` returns early in any other state),
  and this state only exists in the air. Verified in `player_controller.js` on 2026-11-19.

### 6.2 Still open

1. **Does the left mouse button conflict with anything?** Checked on 2026-11-18: the gameplay input classes register only
   `mousemove` (in `camera_controller_first_person.js`); the only `click` listeners are on UI buttons (`buttons.js`,
   `main_menu.js`). So the left button is free in gameplay. Still to check when building it: the pointer-lock button's `click`
   must not fire the dash, and the confirm should only react while the state is active.
2. ~~Is the time limit measured in real time?~~ **Decided (2026-11-19): yes, real time** (now 3 seconds, see 6.1), not slowed by the state.
3. ~~The cap value.~~ **Decided (2026-11-19): something slow, a placeholder to start with**, to be found by testing and fiddling.
4. **Names:** the state, the input option and the component(s), per `NAMING_CONVENTIONS.md`.
   - **State (2026-11-19): `Approach`, picked for now.** Other acceptable candidates: `Inbound` and `Nearing`. (`Drift` was
     dropped because it suggests a value slowly going out of sync; `Targeting` and `Float` were considered and set aside.)
     If it is renamed later, it is one `EnumStateGravity` member plus the `...Approach` method and field names.
   - Still open: action `Dash` (`methodExecuteActionDash`); confirm input as an `EnumModeDash…` enum; components
     `EntityComponentDash` and possibly `EntityComponentDashMarker`.
5. **Cap consequence (2026-11-19):** the velocity can be capped each frame, and it can also be reset on leaving the state, whichever
   state follows. What matters is keeping the **direction** the player had on entering the state and moving along it, slowly.
   The velocity **amount** could be ignored entirely in this state (set `direction × cap` each frame), if that is easier.
   **Superseded (2026-11-20):** on a timeout or cancel the full old velocity returns (see 6.1), so the amount is not ignored.
6. ~~How to suspend the velocity.~~ **Decided and implemented (2026-11-20): skip the decay in the state.**
   `EntityComponentVelocity.methodUpdate` applies friction to the stored velocity every call (0.995, not scaled by time), so over
   3 seconds at 60 fps it would shrink to roughly 40%. A flag `#isDecaySuspended` is set in `methodSetVelocityCap` (true for
   `Approach`, false for every other state) and checked at the top of `methodDecayVelocity`. The alternative, saving a copy on
   entry and restoring it, was dropped because it would discard the player's steering. Playing it showed it works well.
   A side effect to watch by feel: input does not decay in the state either, so releasing the keys does not stop the player.
7. ~~What "return" means for the cap.~~ **Decided and implemented (2026-11-20): the normal cap chase runs.** The
   `Approach → Falling` and `Approach → Landed` handlers call `methodOnFallingDistanceChanged`, which resets the cap target, the
   chase rate and the decay flag. (Without that call, the player would crawl on the ground, with no friction.)
8. **Cancel input details.** Right mouse button: the `contextmenu` event needs preventing so the menu does not open. Escape: in
   a browser it also releases the pointer lock, so it may clash with the pause or menu behaviour. Control: check it does not clash
   with other keys in `player_controller.js`. The cancel should only react while the state is active, as for the confirm.
9. **A full velocity reset method.** `velocity.js` has only `methodNullifyGravity` (removes the component along an axis), nothing
   that zeroes the whole velocity. The dash needs one (`methodResetVelocity`, or `methodNullifyVelocity` to match the other
   name), and `EntityComponentGravity` would get a thin wrapper like its existing `methodNullifyGravity`.

### 6.3 Notes from the decisions

- **The velocity reset belongs to the dash, not to the state transition.** The dash and the drift-down exit both end in the same
  next state, and the transition handlers are registered per pair of states, so a handler cannot tell the two exits apart. The
  nulling and the impulse are better done by an explicit "dash" step that runs right before the transition, so the drift-down
  exit never nulls the velocity.
- **The aim marker:** a flat circle mesh (a small circle geometry with a transparent, non-depth-writing material) oriented with the
  same `quaternion.setFromUnitVectors(...)` approach that `planet.js` already uses for its debug planes, and lifted a hair off the
  surface along the normal to avoid z-fighting. **Decision (2026-11-18): create it once and hide it**, since the player can reach
  `Orbit` and come back near the planet many times in one session. It is shown (`visible = true`) while the state is active and
  hidden on every exit (dash, drift-down, time limit); its geometry and material are disposed only when the owning component is
  disposed, i.e. when the world is torn down. Creating it lazily on the first entry to the state means a session that never
  enters the state never pays for it. The aim ray and the marker are recomputed every frame, so the scratch-object rule of
  TODO item 32 applies to them.
- **Landing precision matters less than it seems.** Wherever the dash ends near the surface, the existing `Landed` logic
  (`methodChaseIdealDistanceFromFloor`) corrects the player to the ideal height, and `methodShouldUpdateToNearestFace` follows
  the face change, so "close to the DashPoint" is enough.
- **A fixed maximum velocity fits the existing velocity cap.** `EntityComponentVelocity` already has a cap that is chased towards a
  target (`#velocityCapChase`, set per state in `methodSetVelocityCap`), so the state's cap is one more case there, and the chase
  gives the "lerp instead of hard-set" entry for free (it moves 50 units per second).
- **A cap alone lets the stored velocity pile up.** The cap only limits the speed that is *applied* each frame (a clamped copy);
  the stored velocity keeps growing from gravity. On the dash this does not matter, because the velocity is reset, but on the
  drift-down and time-limit exits (nothing is reset) the whole stored amount would be released at once as soon as the cap rises.
  `methodClampVelocity()` already exists to scale the stored velocity down to the cap; calling it each frame while in the state
  (it uses the current, chased cap) keeps the stored velocity in step with the cap, so nothing is hoarded.
  **Superseded (2026-11-20):** the state now suspends the velocity, and the old velocity (plus the player's steering) returns on a
  timeout or cancel (6.1), so the stored velocity must **not** be clamped or scaled down in the state. Do not call
  `methodClampVelocity()` there, and do not call it at the moment of exit either: the cap is still the slow one then, and the
  velocity would be crushed. (The existing call on `Orbit → Stratosphere` is before the state and is fine; it limits the velocity
  the player has on entry to the cap at that moment.)
- **Transition handlers cannot tell the exits to `Falling` apart.** The timeout, the cancel and the dash all lead to `Falling`,
  and handlers are registered per pair of states. That is fine, because nothing is restored in the handler (it only resets the
  cap, the chase rate and the decay flag), and the dash runs its own reset and impulse right after the transition. Landing has
  its own pair (`Approach → Landed`) and is unaffected.
- **The next-state check can reuse the existing region logic** (`methodGetSubstateStratosphere` and the `Falling` substates in
  `EntityComponentGravity`). A slightly wrong choice corrects itself, because the normal per-frame transitions between
  `Stratosphere` and `Falling` keep running after the dash.
- **A lerped exit interacts with the impulse.** If the slow factor ramps back to 1 over some time instead of at once, part of the
  dash is spent while the player is still slowed, so the same impulse covers less distance. Keep the exit hard unless it feels bad,
  and then size the impulse for the ramp. A lerped entry has no such interaction. The velocity code already has a "chase" pattern
  to copy (`methodChaseVelocityCap`).
- **"No maximum distance" is bounded by the planet anyway.** The ray from the camera can only hit the near side, so the farthest
  possible target is the horizon: `sqrt((R + h)^2 - R^2)` for a radius `R` and a height `h`. With `R = 20` that is about 67 units at
  a height of 50 and about 98 at a height of 80. At 60 fps the friction-based impulse for those distances would be above the default
  velocity cap of 15, so the cap (or the impulse) will need attention when testing.

## 7. Implementation stages (agreed 2026-11-19)

The feature is built in four stages, each playable and testable before the next one starts.

1. **The slowed-down state.** The player enters the state near the planet (see 6.1) and is held to the fixed maximum velocity,
   keeping the direction they had on entry. The state ends by touching the planet (velocity handled independently), when the
   time limit runs out (3 seconds, real time) or when the player cancels (right mouse button, control or escape). On a timeout
   or cancel the full old velocity returns. There is no dash yet.
   **Status (2026-11-20):** built and working, except the cancel input; `BelowFloor` in the state is not handled yet (TODO item 34).
   The entry is `Falling` below 0.6 of the radius above the floor, only if the player has been in `Orbit` since the last descent
   (`#hasBeenInOrbit`); the cap is 0.5; the time limit is 3 seconds.
2. **The dash.** The player can press the confirm input to dash, which ends the state early. The direction is a **placeholder**:
   the first-person camera's forward direction (the aimed direction, not yet the DashPoint direction).
3. **Picking the direction properly.**
   - Cast a ray from the first-person camera towards the planet surface to find the aimed surface point.
   - Extend that point outwards along the surface normal (to the ideal camera height) to get the DashPoint.
   - The dash direction is from the camera to the DashPoint.
   - **Early returns do not end the state and do not dash.** If the ray misses, or there is no valid normal or point, the confirm
     does nothing: the state stays active and the player can try again until they get it, or until the normal exits (touching the
     planet, running out of time). A miss (for example aiming at the sky) is normal play, **not an error**, so nothing is logged.
4. **The visual element.** The aim marker from 6.3 (a small, semi-transparent flat circle on the aimed point, aligned to the
   surface normal, created once and hidden on exit).
