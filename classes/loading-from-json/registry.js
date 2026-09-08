// registry.js and hydration.js are used to...
// ...turn a string name into a class reference
// we use registry to import each entity-component class, and then export them in a single object

// name, and import, all entity-components that will be used by /data/worlds/
import { EntityComponentDirectionalLight } from "../../entity components/lighting.js";
import { EntityComponentTestCube, EntityComponentButtonPointerLock } from "../../entity components/test_objects.js";
import { EntityComponentCameraControllerFirstPerson } from "../../entity components/camera_controller_first_person.js";
import { EntityComponentPlayerController } from "../../entity components/player_controller.js";

// and then we export them
export const entityComponentRegistry =
{
    "EntityComponentDirectionalLight": EntityComponentDirectionalLight,
    "EntityComponentTestCube": EntityComponentTestCube,
    "EntityComponentButtonPointerLock": EntityComponentButtonPointerLock,
    "EntityComponentCameraControllerFirstPerson": EntityComponentCameraControllerFirstPerson,
    "EntityComponentPlayerController": EntityComponentPlayerController,
};

// for more complicated entity-components
// those that are evaluated at runtime
export const builderRegisty = {};