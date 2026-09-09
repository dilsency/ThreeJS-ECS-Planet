// note : this is only needed because these string-names need to be resolved at runtime

// registry.js and hydration.js are used to...
// ...turn a string name into a class reference
// we use registry to import each entity-component class, and then export them in a single object

// name, and import, all entity-components that will be used by /data/worlds/
import { EntityComponentDirectionalLight } from "../../entity components/lighting.js";
import { EntityComponentTestCube } from "../../entity components/test_objects.js";
import { EntityComponentButtonPointerLock, EntityComponentButtonReturnToMainMenu } from "../../entity components/ui/buttons.js";
import { EntityComponentCameraControllerFirstPerson } from "../../entity components/camera_controller_first_person.js";
import { EntityComponentPlayerController } from "../../entity components/player_controller.js";

// all prefabs should be imported here
import prefabPlayer from "../../data/prefabs/player.json";
import prefabSun from "../../data/prefabs/sun.json";

// just for symmetry, let's do the same for worlds, even though it does not need to resolve at runtime
import worldDefault  from "../../data/worlds/default.json";
import worldB  from "../../data/worlds/worldB.json";

// if we have the string-name for the world, we use that here
export const worldRegistry = 
{
    "Default": worldDefault,
    "World B": worldB,
}

// if we have the string-name for the prefab, we use that here
export const prefabRegistry =
{
    "Player": prefabPlayer,
    "Sun": prefabSun,
}

// if have the string-name for the entity-component, we get its actual class from here
export const entityComponentRegistry =
{
    "EntityComponentDirectionalLight": EntityComponentDirectionalLight,
    "EntityComponentTestCube": EntityComponentTestCube,
    "EntityComponentButtonPointerLock": EntityComponentButtonPointerLock,
    "EntityComponentButtonReturnToMainMenu": EntityComponentButtonReturnToMainMenu,
    "EntityComponentCameraControllerFirstPerson": EntityComponentCameraControllerFirstPerson,
    "EntityComponentPlayerController": EntityComponentPlayerController,
};

// for more complicated entity-components
// those that are evaluated at runtime
export const builderRegisty = {};