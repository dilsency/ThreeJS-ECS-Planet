# Scale when needed — deferred scaling decisions & their upgrade paths

> A register of things built the **simple way on purpose**, each paired with the
> **trigger** that says "now it's worth upgrading" and the **upgrade** to make (ready to
> paste). Keeps YAGNI honest: we don't build the scalable version up front, but we don't
> lose the plan either. (This is where the "don't over-build, but record the growth path"
> instinct from the shared `design_principles_*` notes gets written down per decision.)
>
> **Format per entry:** what's simple now → the trigger → the upgrade.

---

## Model registry: hand-listed lazy map → `import.meta.glob`

**Now (simple).** `modelRegistry` in `classes/loading-from-json/registry.js` is a
hand-listed map of `name → lazy loader function`, one line per model — matching the
explicit style of the other registries (`entityComponentRegistry`, `prefabRegistry`,
`worldRegistry`). Lazy like those are eager: each value is a function that dynamic-imports
the model's URL on demand, so an unused world never fetches its `.obj`.

```js
export function modelIcosahedron() {
    return import("../../assets/models/Icosahedron.obj?url").then((module) => module.default);
}
export const modelRegistry = {
    "Icosahedron": modelIcosahedron,
};
```

**Trigger.** Hand-listing becomes tedious or error-prone — enough models that adding a
line (and a matching loader function) per file is a chore, or `.obj` files get dropped in
by non-code contributors who shouldn't have to edit `registry.js`.

**Upgrade.** Auto-collect the folder with Vite's `import.meta.glob` (still lazy — each
model stays its own on-demand chunk), re-keyed from the glob's full paths to bare names:

```js
const modelGlob = import.meta.glob("../../assets/models/*.obj", { query: "?url", import: "default", eager: false });
export const modelRegistry = Object.fromEntries(
    Object.entries(modelGlob).map(([path, loader]) => [path.split("/").pop().replace(/\.obj$/, ""), loader])
);
```

`planet.js` is unchanged either way — `await modelRegistry[name]()` resolves to the URL in
both. **Trade-off:** the glob's path-scan + re-key reads alien next to the hand-written
registries, so it earns its keep only once the hand-list is genuinely unwieldy. Same
tooling note as always: a fully-dynamic `import()` path won't bundle — the glob (or a
literal path) is what keeps Vite splitting the chunk.

---

## Face lookup: full scan → adjacency-table neighbor search

**Now (simple).** `EntityComponentPlanetFaces`'s `getNearestFace`/`isWithinFace` queries
(gravity slice) scan every face on the planet each time they're asked "which face is this
point over" - for the icosahedron's 20 faces, that's 20 cheap `Plane.distanceToPoint()`
calls (dot product + a constant, no `sqrt`) plus up to 60 wall-plane checks worst case.
Trivial cost at this face count, even called every frame by several gravity-tracking
entities at once.

**Trigger.** Face count grows enough that a full scan per query actually profiles as
slow - a subdivided icosphere with hundreds/thousands of faces, or many simultaneous
gravity-tracking entities each doing their own full scan every frame.

**Upgrade.** Build a `faceIndex → neighboring faceIndex[]` adjacency table once, during
the same lazy parse that already builds `#faceEdgeData`/`#planesFloor`/`#planesWall` -
classify pairs by how many of their 3 corner points they share (within a small epsilon;
the icosahedron geometry is non-indexed, so there's no shared-vertex index to read this
off directly - see the `#geometry.index == null` gotcha from Piece 2b): **2 shared
corners = direct (edge) neighbor, 1 shared corner = diagonal (corner-only) neighbor, 0 =
unrelated.** For a regular icosahedron each face has exactly **3 direct neighbors** (one
per edge) and **6 diagonal neighbors** (two per corner - every vertex is shared by 5
faces total, so each corner has 4 other faces on it: 2 already counted as direct via that
corner's two edges, 2 more sharing only that corner). Kept as two separate parallel
arrays rather than one nested `[direct[], diagonal[]]` structure, matching the existing
`#faceCenters`/`#faceNormals` and `#faceEdgeData`/`#planesWall` convention of naming each
kind of per-face data its own array instead of encoding meaning positionally. Search
`[faceCurrent, ...directNeighbors]` first (diagonal neighbors mainly matter if you also
want to react to touching a face only at a corner, e.g. a corner-straddling collision
check, not typical "which face is under me" tracking).

**Correctness caveat - this is not a drop-in replacement for the full scan.** A
neighbors-only search can miss the real answer whenever the tracked point moves (or is
placed) further than one face away since the last check: a teleport, the initial spawn,
or movement fast/laggy enough to cross two face boundaries between checks. The safe
upgrade is "neighbors first, fall back to a full scan if the point isn't within
`faceCurrent` or any of its neighbors" - never silently wrong when the small-movement
assumption doesn't hold, just slower on the rare frame it doesn't.

```js
// faceNeighborsDirect[i] = the 3 edge-sharing neighbors of face i.
// faceNeighborsDiagonal[i] = the 6 corner-only-sharing neighbors of face i.
// Requires each face's world-space corner points captured during parse as
// this.#faceCorners[i] = [aWorld, bWorld, cWorld].
#faceNeighborsDirect = [];
#faceNeighborsDiagonal = [];

#methodBuildFaceAdjacency()
{
    const epsilonSquared = 0.0001 * 0.0001;
    const methodPointsMatch = (a, b) => a.distanceToSquared(b) < epsilonSquared;
    const methodCountSharedCorners = (cornersA, cornersB) =>
    {
        var count = 0;
        for(const a of cornersA)
        {
            for(const b of cornersB)
            {
                if(methodPointsMatch(a, b)){count++; break;}
            }
        }
        return count;
    };

    for(var i = 0; i < this.methodGetFaceCount(); i++)
    {
        this.#faceNeighborsDirect[i] = [];
        this.#faceNeighborsDiagonal[i] = [];
        for(var j = 0; j < this.methodGetFaceCount(); j++)
        {
            if(i == j){continue;}
            const sharedCornerCount = methodCountSharedCorners(this.#faceCorners[i], this.#faceCorners[j]);
            if(sharedCornerCount === 2){this.#faceNeighborsDirect[i].push(j);}
            else if(sharedCornerCount === 1){this.#faceNeighborsDiagonal[i].push(j);}
            // sharedCornerCount === 0 - unrelated face, not stored
        }
    }
}
methodGetFaceNeighborsDirect(index){ return this.#faceNeighborsDirect[index]; }
methodGetFaceNeighborsDiagonal(index){ return this.#faceNeighborsDiagonal[index]; }
```

One-time cost at parse: 20×19 face pairs × up to 9 corner-distance checks each ≈ 3,400
comparisons - still trivial, just not something to build before the trigger above is real.
A cheap self-check once built: every face should report exactly 3 direct and 6 diagonal
neighbors - anything else means the epsilon or corner-matching logic needs a look.

---

## Related deferred decisions (already recorded in their own docs)

Same "simple now, upgrade on a trigger" shape, noted where they live:

- **Worlds: hand-listed imports → `import.meta.glob`** once there are many —
  `DATA_DRIVEN_WORLDS_AND_PREFABS.md` §7 step 4. (The direct precedent for the model
  entry above.)
- **`overrideParams` shallow merge → deep merge**, only if a real nested-param case
  appears — `DATA_DRIVEN_WORLDS_AND_PREFABS.md` §8 ("Still open").
- **Planet face-parse recompute each world → a results cache**, only if it ever profiles
  as slow — `ECS_CONVERSION_PLAN.md` ("Generation is a generate/teardown pair").

*(Add new entries here as more "simple now, scale later" choices are made.)*
