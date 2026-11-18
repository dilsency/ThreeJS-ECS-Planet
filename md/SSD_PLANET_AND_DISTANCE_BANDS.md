# Surface-Stable-Dithering on the planet, with distance bands: plan of approach

Status: **plan, partly implemented** (written 2026-11-17, vocabulary updated 2026-11-18). The test cubes are done and pushed. The
planet's material swap and the camera-distance calculation exist as uncommitted work in progress in
`entity components/environment/planet.js`. The two band classes (`DitherDistanceBand` and `DitherDistanceLadder`, in
`classes/dither/dither_distance_band.js`) are written, including the blending and the overlap check, and are uncommitted. They are
not connected to the dither context or the planet yet.

Related: `SHADER_SOURCE_AND_TEXTURE_CACHING.md` (seed reference, inherited), `PLANET.md`, `TODO_ECS_PLANET.md` items 30 and 31.

---

## 1. Goal

Render the planet (`EntityComponentPlanetModel`) with the Surface-Stable-Dithering (SSD) shader that the test cubes already use,
and make the dither's look **change with the camera's distance from the surface**, so that it can be tuned to look good both
near the surface and from far away.

The shader already adapts dot size to the surface's screen-space UV derivatives. The bands are a tuning tool on top of that:
they let us change `level`, `scale`, the anti-aliasing and the dot radius by distance, to find out which parameters matter and
whether parameters alone can fix the far look.

## 2. Decisions already made

- **Start with the test cubes, then the planet.** The cubes are done (commits `05eddcd`, `c4a1698`).
- **Lit, not unlit.** The shader takes `directionalLights[0].direction` plus the shadow map, so a real `DirectionalLight` is needed.
- **Checkerboard textures first**; new textures later. The capability for several textures per object is wanted eventually.
- **The 3D HUD is deferred.** (Note: the HUD cube inherits the new cube material path, so it is dithered too, with shape and
  colours from the local player identity. That is a side effect, not the HUD task.)
- **Caching lives in a singleton:** `EntityComponentSingletonContextDitherMaterialCache`, matching the existing
  `EntityComponentSingletonContextModelCache`. It owns the shared shader sources and textures, resets them on a failed load,
  disposes the textures on teardown, and builds a fresh material per call.
- **All five band parameters are specified from the start**: `level`, `scale`, `aaSmoothness`, `aaStretch` and `dotRadius`, in
  every band, even where most stay at their defaults, to make fiddling easy.
- **Blend, not a hard switch, with a blend ratio of 0 acting as a hard switch**, so one mechanism covers both test modes.
- **The bands are two small logic classes, not ECS components**, so that other materials can use distance bands too (section 5.5):
  `DitherDistanceBand` (one row) and `DitherDistanceLadder` (the ordered collection, which does the blending). These names are
  provisional ("for now, at least"); renaming them later is fine. Rejected: `Manager` (house style reserves it for per-frame
  sync/spawn lifecycles), `Table` (sounds like an HTML tag), `BandItem` (says only that it is an element of a collection).

## 3. Where things stand

| Piece | State |
| --- | --- |
| Shaders in `shaders/`, textures in `assets/textures/` | done, committed |
| Test cubes use the SSD material | done, committed and pushed |
| Dither material cache singleton | done, committed and pushed |
| Planet material swapped to the cache's material | work in progress, uncommitted |
| Planet colours as `color1` / `color2` params (world JSON files updated) | work in progress, uncommitted |
| Camera distance to the surface, normalized by the radius | work in progress, uncommitted |
| `DitherDistanceBand` / `DitherDistanceLadder` classes, with blending and the overlap check | written, uncommitted (checked with a scratch script outside the repo) |
| Registration of the ladders in the dither context | not started |
| Applying a ladder from the planet (uniform writes in `methodUpdate`) | not started |

## 4. What the planet is, and the main risk

- One mesh. Its geometry comes from `Icosahedron.obj` through the model cache. That geometry is shared and deliberately never
  disposed.
- The OBJ has 20 faces and 22 UV coordinates (a Blender unwrap), so `vUv` exists and the shader runs.
- **UV density and seams are the main risk.** The shader derives its dot size from `dFdx(vUv)` / `dFdy(vUv)`. With 20 large
  triangles and separate UV islands, the UVs jump at every face edge. Where a 2x2 pixel block straddles an edge, the derivative
  spikes and produces a line of artifacts. Up close, edge pixels are a small fraction of each face. From far away the faces are a
  few pixels wide, so edge pixels dominate and the planet looks noisy.
- Consequence: **if the far look is caused by the seams, distance bands only hide it.** The real fix is a different UV strategy
  (section 8). The bands are still worth building, because they show which parameters matter and let us tell the two causes apart.

## 5. Distance bands: design

### 5.1 The distance

- Distance from the camera to the planet **surface**: the camera's **world** position (the camera is a child of `cameraPivot`,
  so `camera.position` is a local position and must not be used), `distanceTo` the planet centre, minus the radius.
- Divided by the radius, so that the band limits do not depend on the planet's size. This is the "normalized distance".
- Computed every frame in a private method of `EntityComponentPlanetModel` (`#methodUpdateCameraDistance`), with early returns
  while the camera or the planet centre is missing, and a reused scratch vector (no allocation per frame).

### 5.2 The ladder and its bands

A `DitherDistanceLadder` holds the bands, one `DitherDistanceBand` per row, ordered from near to far. The planet's ladder is
defined as a short constant (in `planet.js` to begin with) and registered with the dither context (section 5.5). Each band holds:

- `distanceMax`: the upper limit of the band, in planet radii. The last row uses `Infinity` (the default when it is left out).
- `level`, `scale`, `aaSmoothness`, `aaStretch`, `dotRadius`: named exactly like the options of the material factory
  (`createFractalMaterialFromSources`), so a row can be passed straight into the material creation, and band 0 can also supply the
  initial material parameters (one source of truth).

Starting values:

- **Band 0 equals what the planet renders with today**, so switching the system on does not change the near look:
  `level` 3, `scale` 3.5, `aaSmoothness` 1.5, `aaStretch` 0.125, `dotRadius` 0.8 (the factory defaults, which the planet gets
  because it passes none of them).
- About four bands (on the surface, near, far, very far), with placeholder limits of 0.5, 2 and 6 radii (10, 40 and 120 units for a
  radius of 20). These are to be tuned by flying around.
- Far bands begin as copies of band 0 with one or two values changed, for a clean A/B comparison. The first experiment changes only
  `level` and `aaSmoothness`.

The ladder's definition stays a constant for now. Moving it to the world JSON (per-planet values) is a possible later step.

### 5.3 Blending

**Vocabulary.** Every band except the last one owns a **tail/end "blend region"** (short: *tail region*): a stretch of distance
around the band's `distanceMax`, where its values blend into the next band's. The part of the band before that is its **normal
region**, where the band's own values are used unchanged. The tail region has a **lower bound** (the near end) and an **upper bound**
(the far end). The last band has no tail region. These terms replace the earlier "zone", "blend zone" and "edge" wording.

The tail region belongs to the *boundary above* the band, not to the band's own range. Band 0 therefore has a tail region too, even
though nothing lies below it: that region is the transition from band 0 to band 1, and it is evaluated by band 0's turn in the loop.
Each transition is evaluated exactly once, by the nearer of its two bands.

With limits 2 and 10 and a ratio of 0.5:

| distance | region | result |
| --- | --- | --- |
| 0 to 1.5 | normal region of band 0 | band 0 |
| 1.5 to 2.5 | tail region of band 0 | band 0 blending into band 1 |
| 2.5 to 7.5 | normal region of band 1 | band 1 |
| 7.5 to 12.5 | tail region of band 1 | band 1 blending into band 2 |
| above 12.5 | the last band | band 2 |

- The ladder takes a `blendRatio` (clamped to 0 to 1; default 0) that sets the **tail region's width as a ratio of the band's
  `distanceMax`**. The lower bound is `distanceMax * (1 - ratio / 2)` and the upper bound is `distanceMax * (1 + ratio / 2)`. A ratio
  fits better than a fixed width, because the far boundaries are much further apart.
- **A ratio of 0 is a hard switch**: both bounds equal `distanceMax`, so the tail region has no width, is never entered, and
  nothing divides by zero.
- Each transition is centred on its boundary, so the mix is 50% exactly at the limit.
- Per frame, `methodGetDitherParamsAtDistance(distance)` loops over the bands **except the last** and asks a private helper which
  region the distance is in (`EnumDistanceRegion`: `IsWithinNormalRegion`, `IsWithinTailRegion` or `IsOutsideRegion`):
  - normal region: return this band's own (frozen) values;
  - tail region: compute `alpha`, a 0 to 1 fraction across the tail region, and return a new object that blends this band into the
    next one;
  - outside: carry on to the next band.
  After the loop, the last band's own values apply (this also covers a single-band ladder, where the loop does not run).
- **The tail regions of neighbouring bands must not overlap.** `methodAddBand` runs a check after sorting: for each pair of
  neighbouring bands that both have a tail region, the upper bound of the first must be below the lower bound of the second. If not,
  it logs an error with the index, both bounds and the ratio. It only logs for now; it does not throw. A ratio of 1 with limits
  closer than about 3 times apart overlaps. An overlap would make the result jump, and it would leave no normal region between them.
- `scale`, `aaSmoothness`, `aaStretch` and `dotRadius` interpolate linearly. `scale` is an exponent in the shader, so a linear blend
  gives a smooth geometric change in dot density.
- `level` is an integer, so the interpolated value is rounded (`Math.round`). Between bands one level apart this flips at an alpha
  of 0.5, in the middle of the tail region. Between bands further apart it steps through the levels in between, with one visible
  pop per step.

### 5.4 Applying the values

- Write the effective values to the material's uniforms `uLevel`, `uScale`, `uAASmoothness`, `uAAStretch` and `uDotRadius`
  (their `.value`). No `needsUpdate` and no recompile.
- Never touch `lighting`: it is a compile-time `#define`, and changing it would recompile the program.
- There is no remembered band index: the values are a pure function of the distance. Writing five uniforms per frame is cheap;
  skipping the write when nothing changed is an optimization for later.
- Hysteresis is mostly unnecessary because the blend is continuous. Two exceptions, to add only if they show up while testing: the
  `level` flip at 0.5, and the hard-switch mode (ratio 0) at a limit.

### 5.5 The classes and where they live

- **`DitherDistanceBand`** holds one row (`distanceMax` plus the five values), with a getter for each. It builds one frozen params
  object in its constructor (`methodGetParamsObject`) and never changes afterwards. It does no blending itself: it is a class, not a
  plain object, to give it named getters and a place for later behaviour.
- **`DitherDistanceLadder`** holds the ordered array of bands, the `blendRatio`, and does all the work: given a number, it finds the
  region (section 5.3), blends where needed and returns the effective values (`methodGetDitherParamsAtDistance(distance)`). It is a
  pure function of the number, so one ladder can be shared by many objects with no per-object state. The blending (`#methodLerp`,
  `#methodGetBlendedParamsObject`), the region helpers (`#methodGetDistanceRegion`, `#methodGetAlpha`,
  `#methodGetTailRegionLowerBound` and `...UpperBound`) and the overlap check (`#methodCheckTailRegionOverlap`) are all private
  methods of the ladder. The ladder knows all the bands, their order and the ratio, so it is the only class that can decide which two
  bands are involved.
- **The ladder is unaware of what its number means.** For the planet it is the normalized distance to the surface (section 5.1);
  another object could pass something else. This is what makes it reusable across materials.
- **Neither is an ECS component.** They are plain logic classes, like `StateMachine`: plain domain names without the
  `EntityComponent` prefix, in a new folder `classes/dither/`, with a `snake_case` file name. **Both classes live in one file**
  (currently `dither_distance_band.js`; a name covering both, such as `dither_distance_ladder.js`, may be better). Several existing
  files hold related classes together (`planet.js`, `lighting.js`, `transcriber.js`, `test_objects.js`), and
  `NAMING_CONVENTIONS.md` has no one-class-per-file rule, so an earlier version of this plan that said so was wrong.
- **The dither context keeps the ladders by name**, like it keeps textures: a Map from a name (for example `"planet"`) to a
  ladder, with methods to register and get one. A convenience method there can apply a ladder to a material (material, ladder name,
  number): evaluate the ladder and write the uniforms. That keeps the knowledge of the uniform names in the one place that already
  knows the shader, and shrinks the planet's per-frame work to "compute the distance, call that method".
- **Naming doc:** by its own rule, `NAMING_CONVENTIONS.md` is updated in the same commit as the classes, with a line saying that
  non-component logic classes get plain domain names and live under `classes/`.
- The name `EntityComponentSingletonContextDitherMaterialCache` now describes less than its role. It stays for now; a separate
  bands singleton is the cleaner split if it grows.

## 6. Order of work

1. **Finish the planet material swap** (current work in progress). The flagged-for-deletion path now disposes a possibly-null
   material safely; the camera distance is in place; the world JSON files pass `color1` / `color2`.
2. **Look at the planet at normal settings.** First with `debugNormals` on, to confirm the 20 flat faces and the light direction;
   then off, to see the dither.
3. **The two classes and the blending are written** (sections 5.2 to 5.5). What remains: register the planet's ladder with the dither
   context, and apply it from the planet's `methodUpdate`. Add a debug log of the effective `level` and the distance whenever the
   `level` changes. Update `NAMING_CONVENTIONS.md` in the same commit.
4. **Fly and tune.** Compare ratio 0 (hard switch) and a blend, and change one parameter at a time.
5. **Decide the UV strategy if the seams are the cause** (section 8).
6. **Clean up and commit:** the commented-out `MeshStandardMaterial` block and the unused `#methodCreateColor` in `planet.js`.
7. **Verify the production build:** `npm run build` and `npm run preview`, because dev and build load assets differently (the
   textures are inlined and the `.frag` is emitted as a hashed asset).

## 7. How to judge the result

- **Normals first.** The factory's `debugNormals` option shows the view-space normals as colour and bypasses the dithering. Use it
  before judging the dither itself.
- **Expect large dots** on the coarse unwrap. Try the `scale` option before anything else.
- **Tell seams from aliasing apart:** artifacts that concentrate along the 20 face edges mean seams (UV problem, not a parameter
  problem). Shimmer across whole faces suggests minification aliasing, which a higher `aaSmoothness` should help.
- **Look at it from both ends:** a screenshot near the surface and one from far away, for each change.

## 8. If the seams are the cause: UV strategy options

- **Re-unwrap the model in Blender** with an even texel density and as few discontinuities as possible.
- **Generate UVs per face in code** (the same UV range on every face, derived from the face geometry).
- **Triplanar or object-space mapping** in the shader instead of the model's UVs. This changes the shader, which is currently a
  byte-identical copy of the seed's, so it is the most invasive option.

## 9. Open questions

- Does the checkerboard look acceptable on a planet as a placeholder? The texture's alpha channel doubles as a per-pixel dither
  mask, so a plain-white texture may suit a planet better.
- Does the directional light's shadow camera cover the planet at its current radius? The lit shader reads the shadow map.
- Are the planet's colours to come from the identity or biome data later (feeding `color1` / `color2`)?

## 10. Later, not in this plan

- New per-object textures, and the multiple-textures-per-object capability (possibly `import.meta.glob("../assets/textures/*.png")`
  inside the dither material cache).
- A shared "distance from the camera to a point" shorthand, in `SingletonContextEngine` or the base `EntityComponent`, once a second
  object needs distance bands (`TODO_ECS_PLANET.md`, item 31). The ladder classes themselves are already shared (section 5.5);
  this item is only about computing the distance.
- Giving other materials (the test cubes) their own ladders.
- The 3D HUD (deferred).
- The model cache has the same "a failed load stays cached" weakness that the shader and texture caches were fixed for; the same
  reset-on-failure `.catch` would apply.
- `md/DEPLOY_GITHUB_PAGES.md` still shows `../textures/` example paths (they are now `../assets/textures/`).

## 11. Caveats and things to consider

Collected from the design discussion (2026-11-17), so they are not forgotten. None of these is a known bug; they are decisions
taken and risks to watch.

### 11.1 Result objects: frozen, new, scratch, or out-parameter

- **A band builds its params object once, in its constructor, and freezes it** (`Object.freeze`). A band has getters and no
  setters, so its values never change after construction: there is nothing to keep in sync. The freeze is shallow, which is
  enough because every value is a plain number.
- **Blending never writes into a band's frozen object.** It reads the two neighbouring bands' objects as read-only inputs and
  writes the result to a different object. ES modules are strict, so assigning to a frozen property throws a `TypeError`: a
  mistake fails loudly at the line that made it.
- **The ladder's blend (`#methodGetBlendedParamsObject`) leaves both bands unchanged** and returns the blended values as a new
  object (it could also fill an object that is passed in). Outside a tail region the ladder returns a band's own frozen object, so a
  caller cannot change it by accident either.
- **New object versus scratch object.** A new object means one small allocation per call. A scratch object is created once
  (in the ladder's constructor, since plain classes have no `methodInitialize`) and overwritten on every call. The saving is one
  tiny object per frame, which the engine handles well; there is no measured problem.
- **Decision: start with the plain version** (return a new object). It is easier to log and inspect while tuning, and nothing can
  be misused. Adding a scratch object or an out-parameter later is a small change (the blend method's signature, plus one private
  field in the ladder) as long as nothing outside the ladder depends on how the result is made.
- **When to add it:** if profiling shows garbage-collection spikes, or if many consumers start calling ladders every frame. An
  out-parameter is then better than a hidden scratch field, because the caller owns the object and nothing is shared.

### 11.2 If a scratch object is ever used: the real hazard

- **Separate ladder instances never conflict**, since each owns its own scratch object.
- **Many consumers sharing one ladder** (ladders are registered by name in the dither context) is also fine, as long as each
  consumer uses the result **immediately**. JavaScript is single-threaded: one consumer writes its uniforms from the result before
  the next consumer calls the ladder.
- **The only hazard is a caller that keeps the result across another call** (storing the returned object in a field, or comparing
  it with last frame's values). The next call overwrites it. "Two callers in the same frame" is not the problem; holding on to the
  result is.
- **Make it impossible by construction:** let the dither context's apply method be the only caller of
  `methodGetDitherParamsAtDistance`. It evaluates and writes the uniforms in one step and never hands the object out. If something
  else needs the values (a debug display, say), it copies the five numbers.

### 11.3 Where trouble is actually likely (most likely first)

1. **The UV seams** (section 4). The biggest risk for the far look, and unrelated to the bands.
2. **A visible pop when `level` flips.** `level` is an integer and cannot blend; it sets the shader's grid resolution, so the
   pattern changes abruptly at the flip even while every other value blends smoothly. Not seen yet, so its severity is unknown.
   Possible mitigations: change `scale` in the opposite direction at the same boundary, or use a wider tail region (a higher
   `blendRatio`, within what the overlap check allows). Bands more than one level apart give one pop per level step.
3. **The shadow camera's coverage.** The lit shader reads the shadow map; check that the directional light's shadow camera covers a
   planet of radius 20 (also in section 9).
4. **Small edge cases in the distance.** A camera inside the planet gives a negative normalized distance (it just lands in the
   first band, which is fine); a radius of 0 divides by zero (a one-line check would cover it).

### 11.4 What is not worth worrying about

- **Per-frame cost:** a handful of uniform writes.
- **Sharing a ladder between consumers** (see 11.2).
- **A shared material:** every object builds its own material from the cache, so uniform values are per object even though the
  compiled program is shared.

### 11.5 Small code notes

- **`return` followed by a newline and then `{` is a syntax error** (automatic semicolon insertion makes `return` return
  `undefined`, and the `{` starts a block). To keep Allman braces, build the object in a named `const` on its own lines, then
  `return` the name. This is the form used for `methodGetParamsObject`.
- **The ladder sorts its bands inside `methodAddBand`**, so a band added at any time lands in near-to-far order. Two bands with
  an `Infinity` limit compare as equal and keep their given order.
- **`methodGetDitherParamsAtDistance` returns `undefined` only for an empty ladder.** Otherwise the last band's values apply beyond
  every other band's tail region, whatever its own `distanceMax` is, so the caller needs a null check only for an empty ladder. A
  `NaN` distance fails every comparison and also lands on the last band, so callers should not pass one.
- **Order inside `methodAddBand`:** push, then sort, then the overlap check (the check compares neighbours, so it needs the sorted
  order). The constructor reads `blendRatio` before it adds the bands, because the check needs the ratio.
- **The tail-region bound helpers return `undefined` for the last band** (index `length - 1`), which has no tail region. `methodGetBand` is a
  plain getter and returns any valid index, including the last.
- **The ladder's names are provisional** (`DitherDistanceBand`, `DitherDistanceLadder`); they can be renamed later.
