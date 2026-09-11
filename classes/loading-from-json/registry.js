// note : this is only needed because these string-names need to be resolved at runtime

// registry.js and hydration.js are used to...
// ...turn a string name into a class reference
// we use registry to import each entity-component class, and then export them in a single object

// #region prefabs > entities

// name, and import, all entity-components that will be used by /data/worlds/
import { EntityComponentDirectionalLight } from "../../entity components/lighting.js";
import { EntityComponentTestCube } from "../../entity components/test_objects.js";
import { EntityComponentButtonPointerLock, EntityComponentButtonReturnToMainMenu } from "../../entity components/ui/buttons.js";
import { EntityComponentCameraControllerFirstPerson } from "../../entity components/camera_controller_first_person.js";
import { EntityComponentPlayerController } from "../../entity components/player_controller.js";
//
import { EntityComponentSkybox } from "../../entity components/environment/skybox.js";

// all prefabs should be imported here
import prefabPlayer from "../../data/prefabs/player.json";
import prefabSun from "../../data/prefabs/sun.json";

// #endregion prefabs > entities

// #region worlds > presets

// just for symmetry, let's do the same for worlds, even though it does not need to resolve at runtime
import worldDefault  from "../../data/worlds/worldDefault.json";
import worldB  from "../../data/worlds/worldB.json";

//
import worldDefaultPreset1 from "../../data/world-presets/worldDefaultPreset1.json";
import worldBPreset1 from "../../data/world-presets/worldBPreset1.json";

// #endregion worlds > world-presets

// #region worlds > world-presets

// worldPresets / presets are different
// although these are also fetched from a .json file ...
// ... they are ONLY used to iterate / enumerate / loop through
// never fetched by name
// therefore
// we store them in an array instead of an dictionary / object
export const worldPresetRegistry = 
[
    worldDefaultPreset1,
    worldBPreset1,
];

// if we have the string-name for the world, we use that here
export const worldRegistry = 
{
    "World Default": worldDefault,
    "World B": worldB,
};

// #endregion worlds > presets

// #region prefabs > entities

// if we have the string-name for the prefab, we use that here
export const prefabRegistry =
{
    "Player": prefabPlayer,
    "Sun": prefabSun,
};

// if have the string-name for the entity-component, we get its actual class from here
export const entityComponentRegistry =
{
    "EntityComponentDirectionalLight": EntityComponentDirectionalLight,
    "EntityComponentTestCube": EntityComponentTestCube,
    "EntityComponentButtonPointerLock": EntityComponentButtonPointerLock,
    "EntityComponentButtonReturnToMainMenu": EntityComponentButtonReturnToMainMenu,
    "EntityComponentCameraControllerFirstPerson": EntityComponentCameraControllerFirstPerson,
    "EntityComponentPlayerController": EntityComponentPlayerController,
    "EntityComponentSkybox": EntityComponentSkybox,
};

// #endregion prefabs > entities

// for more complicated entity-components
// those that are evaluated at runtime
export const builderRegisty = {};