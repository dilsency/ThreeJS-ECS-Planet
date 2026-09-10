// to update node.js
//  https://stackoverflow.com/a/10076029/32604643
//  tl;dr: n stable

// https://dilsency.github.io/ThreeJS-ECS-Planet/

// imports
// base
import * as THREE from "three";
// entity-component-system (ECS)
import {EntityManager} from "./classes/ECS/entity_manager.js";
import {Entity} from "./classes/ECS/entity.js";
import {EntityComponent} from "./classes/ECS/entity_component.js";
// context components , most important
import {EntityComponentContextEngine} from "./entity components/context/context_engine.js";
import {EntityComponentContextInitialization} from "./entity components/context/context_initialization.js";
// generator components
import {EntityComponentMainMenu} from "./entity components/ui/main_menu.js";
import {EntityComponentWorldGenerator} from "./entity components/generation/world_generator.js";
// context components , less important
import {EntityComponentContextHUDLayout, HUDCubeHorizontalAlignmentEnum} from "./entity components/context/context_hud_layout.js";
import {EntityComponentContextLocalPlayerIdentity} from "./entity components/context/context_local_player_identity.js";
import {EntityComponentContextWorldLayout} from "./entity components/context/context_world_layout.js";
import {EntityComponentContextPlayerInitialization} from "./entity components/context/context_player_initialization.js";
import {EntityComponentContextEnvironment} from "./entity components/context/context_environment.js";
// entity components
/*
import {EntityComponentCameraControllerFirstPerson} from "./entity components/camera_controller_first_person.js";
import {EntityComponentPlayerController} from "./entity components/player_controller.js";
import {EntityComponentTestCube} from "./entity components/test_objects.js";
import {EntityComponentTestCubeHUD} from "./entity components/test_objects.js";
import {EntityComponentBackgroundPlane} from "./entity components/test_objects.js";
import {EntityComponentButtonPointerLock} from "./entity components/ui/buttons.js";
import {EntityComponentButtonReturnToMainMenu} from "./entity components/ui/buttons.js";
import {EntityComponentDirectionalLight} from "./entity components/lighting.js";
import {EntityComponentDirectionalLightHUD} from "./entity components/lighting.js";
import {EntityComponentLightManager} from "./entity components/lighting.js";
*/



// bare minimum
var scene;
var sceneHUD;
var renderer;

var clock;
var clockTimeDelta = 0;
var clockTimeElapsed = 0;

var cameraPivot;
var camera;
var cameraHUD;

var cameraDirection;
var cameraPivotDirection;
var cameraFrustum;

// ECS
var entityManager;

//
var cube;

//
init();
function init()
{
    //
    function initBareMinimum()
    {
        //
        console.log("init bare minimum");

        //
        clock = new THREE.Clock();
        clock.start();

        //
        scene = new THREE.Scene();
        scene.environment = null;

        //
        sceneHUD = new THREE.Scene();
        sceneHUD.environment = null;

        //
        cameraPivot = new THREE.Object3D();
        cameraPivot.name = "cameraPivot";
        //cameraPivot.position.z = 5;
        scene.add(cameraPivot);
        camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

        //
        cameraHUD = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        sceneHUD.add(cameraHUD);

        //
        camera.up.set(0,1,0);

        camera.updateProjectionMatrix();
        cameraPivot.add(camera);
        cameraDirection = new THREE.Vector3();
        cameraPivotDirection = new THREE.Vector3();
        cameraFrustum = new THREE.Frustum();
        
        // default cam values
        camera.getWorldDirection(cameraDirection);
        cameraPivot.getWorldDirection(cameraPivotDirection);
        cameraFrustum.setFromProjectionMatrix(camera.projectionMatrix);

        //
        cameraHUD.up.set(0,1,0);
        cameraHUD.updateProjectionMatrix();

        //
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("webgl2");

        //
        renderer = new THREE.WebGLRenderer({ canvas, context });
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.domElement.id = "canvas";
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild( renderer.domElement );

        // Single source of truth for the "empty space" background color:
        // read once from index.html's own CSS rule
        // (`html,body,canvas#canvas{background-color:...}`) rather than
        // hardcoding the same value again here. Both the world scene's real
        // clear color (this) and the HUD panel behind cubeHUD (main.js's
        // componentPanelHUD, which used to fall back to its own hardcoded
        // sky-blue default) derive from this one read. See TODO.md, item 4.
        // Must run after appendChild() above so the element is actually in
        // the DOM and its id selector match is reliable.
        scene.background = new THREE.Color(getComputedStyle(canvas).backgroundColor);
    }

    //
    function initECS()
    {
        //
        console.log("init ECS");

        //
        entityManager = new EntityManager(null);
    }

    //
    // Builds the "EngineContext" entity before anything else - deliberately
    // its own step, not folded into initEntityComponents(), so the ordering
    // guarantee ("EngineContext exists before any component that might call
    // this.methodGetScene()/this.methodGetRenderer()") is visible at
    // init()'s own top-level call sequence rather than depending on this
    // being the first few statements inside a much larger function. See
    // BARE_MINIMUM_THREEJS_EXCEPTION_OR_NOT.md's "Ensuring EngineContext
    // initializes before everything else" section.
    function initEngineContext()
    {
        //
        console.log("init engine context");

        // this context component relates to the three.js bare minimums
        // scene, renderer, camera, etc.
        // it needs to be built before anything else

        // this allows us to refer to those bare minimum variables...
        // ...from any other component...
        // ...and we don't have to pass them around as parameters

        //
        const entityEngineContext = new Entity(null);
        entityManager.methodAddEntity(entityEngineContext, "EngineContext");
        entityEngineContext.methodAddComponentWithName("EntityComponentContextEngine", new EntityComponentContextEngine({scene: scene, sceneHUD: sceneHUD, renderer: renderer, camera: camera, cameraPivot: cameraPivot, cameraHUD: cameraHUD,}));
    }

    //
    // Builds EntityComponentContext*-family components (other than
    // EngineContext, which has its own initEngineContext() step above) that
    // need to exist before initEntityComponents(), since their consumers
    // read from them at their own construction time. Named generally
    // (rather than initLocalPlayerIdentity(), what this was originally
    // called, before EntityComponentContextWorldLayout below became the
    // second component built here) so any future ones can be added here
    // too, instead of each one getting its own narrowly-named initXxx()
    // function.
    //
    // - EntityComponentContextLocalPlayerIdentity (see
    //   entity components/context/context_local_player_identity.js): read
    //   by three different entities' components (the player's own network
    //   broadcast, cubeHUD, and the remote-player manager) at their own
    //   construction time.
    // - EntityComponentContextWorldLayout (see
    //   entity components/context/context_world_layout.js): the ground's
    //   real footprint, read by the ground's own EntityComponentTestCube
    //   construction and by player-spawn randomization, so the two can
    //   never drift out of sync.
    // - EntityComponentContextPlayerInitialization (see
    //   entity components/context/context_player_initialization.js): the
    //   local player's spawn position, self-looked-up by
    //   EntityComponentCameraControllerFirstPerson. Built after
    //   EntityComponentContextWorldLayout below, on purpose - it self-looks-up
    //   that component in its own methodInitialize(), so WorldLayout has to
    //   already exist by the time it runs.
    // - EntityComponentContextEnvironment (see
    //   entity components/context/context_environment.js): touch-vs-pointer
    //   and native-shell-vs-browser detection, self-looked-up by
    //   EntityComponentPeerConnectionUI (and, going forward, whatever
    //   touch-input component ends up needing the touch-primary check).
    function initContextComponents()
    {
        //
        console.log("init context components");

        // main menu
        const entityInitialization = new Entity(null);
        entityManager.methodAddEntity(entityInitialization, "InitializationContext");
        entityInitialization.methodAddComponentWithName("EntityComponentContextInitialization", new EntityComponentContextInitialization(null));

        //
        const entityLocalPlayerIdentity = new Entity(null);
        entityManager.methodAddEntity(entityLocalPlayerIdentity, "LocalPlayerIdentityContext");
        entityLocalPlayerIdentity.methodAddComponentWithName("EntityComponentContextLocalPlayerIdentity", new EntityComponentContextLocalPlayerIdentity(null));

        //
        const entityEnvironment = new Entity(null);
        entityManager.methodAddEntity(entityEnvironment, "EnvironmentContext");
        entityEnvironment.methodAddComponentWithName("EntityComponentContextEnvironment", new EntityComponentContextEnvironment(null));

        //
        const entityWorldLayout = new Entity(null);
        entityManager.methodAddEntity(entityWorldLayout, "WorldLayoutContext");
        entityWorldLayout.methodAddComponentWithName("EntityComponentContextWorldLayout", new EntityComponentContextWorldLayout(null));

        //
        const entityPlayerInitialization = new Entity(null);
        entityManager.methodAddEntity(entityPlayerInitialization, "PlayerInitializationContext");
        entityPlayerInitialization.methodAddComponentWithName("EntityComponentContextPlayerInitialization", new EntityComponentContextPlayerInitialization(null));
    }

    //
    function initEntityComponents()
    {
        //
        console.log("init Entities");

        // main menu
        const entityMainMenu = new Entity(null);
        entityManager.methodAddEntity(entityMainMenu, "MainMenu");
        entityMainMenu.methodAddComponentWithName("EntityComponentMainMenu", new EntityComponentMainMenu(null));

        // world generator
        // this lets us NOT specify entities and entity-components below
        // these will come from a .json file :)
        const entityWorldGenerator = new Entity(null);
        entityManager.methodAddEntity(entityWorldGenerator, "WorldGenerator");
        entityWorldGenerator.methodAddComponentWithName("EntityComponentWorldGenerator", new EntityComponentWorldGenerator(null));

        /*
        
        // Built by initContextComponents() above, before this function ran -
        // see entity components/context/context_world_layout.js.
        // (EntityComponentContextLocalPlayerIdentity is no longer fetched
        // here - every consumer self-looks it up now, see
        // BARE_MINIMUM_THREEJS_EXCEPTION_OR_NOT.md's "Player-identity hooks
        // on EntityComponentTestCube" section. Local player spawn position -
        // formerly resolved here too, via EntityComponentContextWorldLayout -
        // is likewise no longer fetched here: EntityComponentCameraControllerFirstPerson
        // self-looks-up EntityComponentContextPlayerInitialization itself now,
        // see entity components/context/context_player_initialization.js and
        // NAMING_CONVENTIONS.md's "A single consumer is fine, conditionally"
        // section.)
        const componentWorldLayout = entityManager.methodGetEntityByName("WorldLayoutContext").methodGetComponent("EntityComponentContextWorldLayout");


        //
        const entityA = new Entity(null);
        entityManager.methodAddEntity(entityA, "player");
        //
        // No EntityComponentCameraControllerFirstPersonInput/...InputTouch
        // construction here - EntityComponentCameraControllerFirstPerson
        // self-attaches whichever one it needs, in its own
        // methodInitialize() (see BARE_MINIMUM_THREEJS_EXCEPTION_OR_NOT.md's
        // "Pattern C: self-attaching sibling components" section).
        entityA.methodAddComponentWithName("EntityComponentCameraControllerFirstPerson", new EntityComponentCameraControllerFirstPerson());
        // No EntityComponentPlayerControllerInput/...InputTouch construction
        // here either - same self-attaching Pattern C as
        // EntityComponentCameraControllerFirstPerson above.
        entityA.methodAddComponentWithName("EntityComponentPlayerController", new EntityComponentPlayerController({cameraPivot: cameraPivot,}));
        
        //
        const entityLight = new Entity(null);
        entityManager.methodAddEntity(entityLight, "sun");
        const componentLightWorld = new EntityComponentDirectionalLight({position:new THREE.Vector3(5,8,5),target:new THREE.Vector3(0,0,0),});
        entityLight.methodAddComponentWithName("EntityComponentDirectionalLight", componentLightWorld);
        entityLight.methodAddComponentWithName("EntityComponentTestCube", new EntityComponentTestCube({name:"CubeG",lighting:true,positionOffset:{x:5,y:8,z:5},color1Texture:false,color2:0xffFF00,textureFile:'texture_checkerboard_alphamask.png',shape:5,}));

        //
        const entityC = new Entity(null);
        entityManager.methodAddEntity(entityC, "pointerLockButton");
        const componentPointerLockButton = new EntityComponentButtonPointerLock({document:document,});
        entityC.methodAddComponentWithName("EntityComponentButtonPointerLock", componentPointerLockButton);

        // sceneHUD

        const entityHUD = new Entity(null);
        entityManager.methodAddEntity(entityHUD, "hudPanel");

        // Solves cubeHUD's own position/yaw and the HUD panel's fit through
        // cameraHUD's actual projection - see
        // entity components/context/context_hud_layout.js for the full math and
        // design rationale (formerly a bare computeCubeHUDLayout() closure
        // here, see TODO.md item 5.2). Added first, before the cube/panel
        // themselves, since both need its output as constructor params.
        const componentHUDLayout = new EntityComponentContextHUDLayout(null);
        entityHUD.methodAddComponentWithName("EntityComponentContextHUDLayout", componentHUDLayout);

        const cubeHUDHorizontalAlignment = HUDCubeHorizontalAlignmentEnum.LEFT;

        let cubeHUDLayout = componentHUDLayout.methodComputeLayout(cubeHUDHorizontalAlignment);

        const componentPanelHUD = new EntityComponentBackgroundPlane({
            positionOffset:cubeHUDLayout.panelPositionOffset,
            size:cubeHUDLayout.panelSize,
            color: scene.background, // match the main scene's background instead of the class's own sky-blue default - see TODO.md, item 4
        });
        entityHUD.methodAddComponentWithName("EntityComponentBackgroundPlane", componentPanelHUD);

        // shape/color1/color2 are no longer passed here - EntityComponentTestCubeHUD
        // self-looks-up EntityComponentContextLocalPlayerIdentity itself now
        // (it has exactly one instantiation in the whole codebase, always the
        // local player) - see BARE_MINIMUM_THREEJS_EXCEPTION_OR_NOT.md's
        // "Player-identity hooks on EntityComponentTestCube" section.
        const componentCubeHUD = new EntityComponentTestCubeHUD({name:"model",
            positionOffset:cubeHUDLayout.positionOffset,
            size:componentHUDLayout.methodGetSize(),
            tiltFactor:componentHUDLayout.methodGetTiltFactor(),
            yawRadians:cubeHUDLayout.yawRadians,
            spin:false,
            lighting:true,
        });
        entityHUD.methodAddComponentWithName("EntityComponentTestCubeHUD", componentCubeHUD);

        //
        // Kept lit like the world scene's "sun" via EntityComponentLightManager below
        // rather than hardcoded matching params — initial position/target here only
        // matter until the first methodUpdate() tick synchronizes them. sceneHUD has
        // nothing worth casting/receiving a shadow map, so castShadow is off here.
        const entityLightHUD = new Entity(null);
        entityManager.methodAddEntity(entityLightHUD, "hudSun");
        entityLightHUD.methodAddComponentWithName("EntityComponentDirectionalLight", new EntityComponentDirectionalLightHUD({position:new THREE.Vector3(5,8,5),target:new THREE.Vector3(0,0,0),castShadow:false,}));
        entityLightHUD.methodAddComponentWithName("EntityComponentLightManager", new EntityComponentLightManager({
            source:null,//source:componentLightWorld,// we are making upcoming changes to world generation, so we null this for now
            // sourceReferencePoint is no longer passed here - EntityComponentLightManager
            // now fetches the world camera itself via methodGetCamera() (EngineContext)
            targetReferencePoint:componentCubeHUD, // HUD cube: the same offset is re-applied from here
            // facing the sun head-on should fully light the HUD cube's near (camera-facing)
            // side, not its far side — see EntityComponentLightManager's field comment.
            reverseDirection:true,
        }));

        */

    }

    //
    initBareMinimum();

    //
    initECS();
    initEngineContext();
    initContextComponents();
    initEntityComponents();

    //
    update();
}

function update()
{
    // must be first
    requestAnimationFrame((t) => {
        update();
      });

    //
    clockTimeDelta = clock.getDelta();
    clockTimeElapsed = clock.getElapsedTime();

    // https://threejs.org/manual/#en/responsive
    updateWindowSize();

    //
    updateEntityComponentSystem();

    // must be last
    // autoClear is reset to true here every frame: the previous frame left it
    // false (below), so without this the world pass would silently stop
    // clearing color/depth from the 2nd frame onward and scene.background
    // would never actually get drawn - HUD_DEPTH_CLEARING.md's "the world
    // scene's initial implicit clear... via autoClear's default true" only
    // actually held for frame 1 before this fix. See TODO.md, item 4.
    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.clearDepth(); // HUD always draws on top of `scene` — see HUD_DEPTH_CLEARING.md
    renderer.render(sceneHUD, cameraHUD);
}

function resizeRendererToMatchDisplaySize(renderer)
{
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
}

function updateWindowSize()
{
    if(resizeRendererToMatchDisplaySize(renderer))
    {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        // cameraHUD
        cameraHUD.aspect = canvas.clientWidth / canvas.clientHeight;
        cameraHUD.updateProjectionMatrix();
    }
}

function updateEntityComponentSystem()
{
    entityManager.methodUpdate(clockTimeElapsed, clockTimeDelta);
}