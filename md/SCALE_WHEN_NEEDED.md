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
