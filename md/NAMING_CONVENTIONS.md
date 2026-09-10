# Naming & code conventions — ThreeJS-ECS-Planet

The in-repo record of the naming and structure conventions this codebase follows.
Many code comments point here ("see NAMING_CONVENTIONS.md"); this is that file.

This is the **project-specific** companion to the shared, cross-project write-up in
`~/Syncthing/🗣️ claude conversations/threejs/ECS_DESIGN_PATTERNS_THREEJS.md` — that doc
explains the *why* of the ECS patterns (Context components, Patterns A–C, hook methods,
method visibility); this doc is the concrete **house style** those patterns are written
in here. Where a rule has deeper rationale, it links there rather than restating it.

> Scope note: this documents conventions **as they exist in the code today**, so it can
> be trusted as a description, not an aspiration. When a convention changes, change it
> here in the same commit.

---

## 1. Members: `method`-prefixed methods, `#private` fields

- **Every method is prefixed `method`** — `methodInitialize`, `methodUpdate`,
  `methodGetScene`, `methodConfirm`, `methodGenerate`. Getters included:
  `methodGetCurrentPreset`, `methodGetIsConfirmed`. The prefix marks "this is a method"
  uniformly, so a call site always reads as `x.methodDoThing()`.
- **Fields are `#private`** with no `method` prefix — `#params`, `#cube`, `#listEntities`,
  `#isConfirmed`. The bare `#name` form distinguishes a field from a method at a glance.
- A few classes also expose C#-style accessor getters (`get keys()`, `get mouseX()`,
  `get Parent()`) alongside the `methodGetX` ones. These are secondary conveniences; the
  `methodGetX` form is the primary one.

## 2. Method visibility: default to `#private`, make public deliberately

JavaScript members are **public by default** (unlike C#, where `private` is the default).
So encapsulation must be opted into: **default every method to `#private`, and make it
public only when something outside the class actually calls it.** `#` is
runtime-enforced, so it's a real, checkable statement of "nothing external depends on
this".

A private method keeps the method marker: **`#methodBakeCubemap`**, not a bare
`#bakeCubemap` — one consistent form for "private method", distinct from a `#field`.

What **stays public**, and why:

- **The framework calls it** — the lifecycle hooks the EntityManager / Entity invoke from
  outside: `methodInitialize` / `methodUpdate` / `methodDispose`.
- **Another component calls it** — anything reached via
  `methodGetEntityByName(...).methodGetComponent("X").methodDoThing()`: the Context
  getters, the cross-component API.
- **A subclass overrides it** — the overridable **hook methods** (§7). A `#private`
  method is invisible to subclasses, not just outsiders, so a hook meant to be overridden
  **cannot** be private (privatizing `methodGetShape`/`methodGetTargetScene` would break
  `EntityComponentTestCubeHUD`).

What the default actually catches: **extracted internal helpers**, and the `methodOn*` /
`methodHandle*` handlers that are only ever invoked through a closure the class registered
on itself (§4). Ask of each method "who *outside* this class calls this?"; if the honest
answer is "nobody", it's `#private`. Full rationale: the "Method visibility" section of
the shared `ECS_DESIGN_PATTERNS_THREEJS.md`.

## 3. `#region` blocks structure both classes and functions

- **Classes** are divided with `// #region <name>` / `// #endregion <name>` pairs, in a
  consistent order: `privates`, `construct`, `lifecycle` (`methodInitialize` →
  `methodUpdate` → `methodDispose`), then `getters`, `setters`, `methods`, `handlers`,
  `registers`, `broadcast` as needed. Collapsing them turns a class into an outline.
- **Overridable hooks** get their own `// #region overridable hook methods` marker in
  both base and subclass (§7).
- **Functions** use the three-region layout (`precalculation` / `early-return` / `body`)
  where applicable — see the shared
  `design_principles_early_return_and_extract_method.md`.

## 4. Event handlers vs. message handlers: `methodOn*` vs `methodHandle*`

Two different notification sources, two different prefixes:

- **`methodOn*`** — DOM / window **event-listener** handlers: `methodOnClickButton`,
  `methodOnKeyDown`, `methodOnPointerLockChange`. When the listener is on `document` /
  `window`, **store the bound reference in a `#eventListenerHandlerOn*` field** and attach
  with it, so `methodDispose` can `removeEventListener` *exactly that instance*. A fresh
  arrow / `.bind` passed to `removeEventListener` is a silent no-op and a GC leak.
- **`methodHandle*`** — ECS **message-system** handlers registered via
  `methodRegisterMessageHandlerWithinEntity`: `methodHandleUpdatePosition`,
  `methodHandleUpdateRotations`. Registered through an in-class closure, so they may be
  `#private` (§2).

## 5. Message names describe what happened, not what to do

Messages broadcast through the ECS are named for the **event**, dotted and past-tense-ish
— `"update.position"`, `"update.rotation"`, `"initialization.confirmed"`,
`"initialization.returnedToMenu"` — never for the reaction (`"menu.hide"`). Each listener
decides its own response; the sender stays blind to who listens. (Shared doc: "Receivers
decide their own reaction".)

## 6. Class names: `EntityComponent` + role word + domain

Component classes are `EntityComponent<RoleWord><Domain>`, **role word first** so the
family clusters in sorting/autocomplete:

- **`Context`** — shared/derived state that exists to be *read* by others, with no
  per-frame behavior of its own: `EntityComponentContextEngine`,
  `EntityComponentContextInitialization`, `EntityComponentContextHUDLayout`.
- **`Manager`** — an ongoing **sync/spawn lifecycle**: `EntityComponentLightManager`
  (per-frame sync), and `RemotePlayerManager` when multiplayer returns.
- **`Controller`** — real-time **input-driven** behavior: `EntityComponentPlayerController`,
  `EntityComponentCameraControllerFirstPerson`.
- **Plain domain name** — everything that's just a thing in the world:
  `EntityComponentDirectionalLight`, `EntityComponentTestCube`, `EntityComponentSkybox`,
  `EntityComponentButtonPointerLock`.

Reserve `Context` / `Manager` / `Controller` for those exact roles; don't use them as
generic filler. Rationale and the "single-consumer Context is fine, conditionally" nuance
live in the shared doc.

## 7. Hook (template-method) methods

A reused base class exposes an **overridable hook** instead of forking, and subclasses
override it: `methodGetTargetScene`, `methodGetShape`, `methodGetColor1` (base
`EntityComponentTestCube` → subclass `EntityComponentTestCubeHUD`). Mark them with
`// #region overridable hook methods` in both base and every override. Hooks are the
reason such decision points **must be public** (§2). Don't add a shared superclass
speculatively — lift the hook up only when a genuine second consumer appears.

## 8. Entity names & component keys (strings)

- **Entities** are added with a string name via `methodAddEntity(entity, "Name")`.
  Context entities are named `"<Domain>Context"` — `"EngineContext"`,
  `"InitializationContext"`, `"EnvironmentContext"`, `"WorldLayoutContext"`,
  `"PlayerInitializationContext"`, `"LocalPlayerIdentityContext"`. Gameplay entities take
  a plain lowercase name — `"player"`, `"sun"`, `"MainMenu"`, `"WorldGenerator"`.
- **Components** are keyed by their **class-name string** via
  `methodAddComponentWithName("EntityComponentContextEngine", instance)`, and looked up by
  that same string. (A rarely-used `__suffix` form allows multiples of one class.)
- **Data-driven** entities/components come from JSON and are resolved through the
  registries — see `md/DATA_DRIVEN_WORLDS_AND_PREFABS.md`.

## 9. Parameters, iterators, booleans

- **Method parameters** are `param`-prefixed: `paramEntity`, `paramName`,
  `paramComponentName`, `paramMessage`, `paramInvokableHandlerName`.
- **Loop variables** are `iterator`- (for-of over an existing collection) or `iteration`-
  (over data being processed) prefixed: `iteratorEntity`, `iterationEntity`,
  `iterationEntityComponent`.
- **Booleans** read as predicates: `is*` / `has*` / `#toBeDeleted` — `isConfirmed`,
  `isVisibleButton`, `isArray`.

## 10. Files & folders

- **Files** are `snake_case.js` — `entity_component.js`,
  `camera_controller_first_person.js`, `world_generator.js`, `main_menu.js`.
- **Folders** group by concern: `classes/ECS/`, `classes/loading-from-json/`,
  `entity components/context/`, `entity components/generation/`, `entity components/ui/`.
  (Reorganizing the looser `entity components/*.js` into more concern-folders — e.g. an
  `environment/` for lighting + skybox, a `manager/` for cross-cutting sync components —
  is an open intent; decide the role-vs-domain axis before moving files.)

---

## Status

- Created 2026-09-10. Documents the conventions in force at that point, plus the
  "default to `#private`" visibility rule (§2), whose cross-project form was added the
  same day to the shared `ECS_DESIGN_PATTERNS_THREEJS.md`.
