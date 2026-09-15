// imports
// ECS
import {EntityComponent} from "../../../classes/ECS/entity_component.js";

// Owns the local player's one-time spawn position, self-looking-up
// EntityComponentSingletonContextWorldLayout for the ground's bounds rather than
// exposing that dependency to its own consumer
// (EntityComponentCameraControllerFirstPerson, which just asks "where do I
// start" via methodGetSpawnPosition() below, the same way it already
// self-looks-up camera/cameraPivot/scene from SingletonContextEngine). Built with
// exactly one consumer in mind from the start - see NAMING_CONVENTIONS.md's
// "A single consumer is fine, conditionally" section for the two conditions
// that justify an EntityComponentSingletonContext* component without multiple
// consumers (streamlines main.js; encapsulates its one consumer), and
// TODO.md item 6's sub-item 6 for the fuller history. Also the first
// EntityComponentSingletonContext* component to itself depend on another one
// (EntityComponentSingletonContextWorldLayout) via the same self-lookup mechanism,
// rather than being depended upon only by non-Context consumers.
export class EntityComponentSingletonContextPlayerInitialization extends EntityComponent
{
    // #region bare minimum

    #spawnPosition = null;

    // #endregion bare minimum

    // #region lifecycle

    methodInitialize()
    {
        // Relies on EntityComponentSingletonContextWorldLayout already existing -
        // both are built by main.js's initContextComponents(), with
        // WorldLayout added first, before initEntityComponents() ever runs.
        const componentWorldLayout = this.methodGetEntityByName("SingletonContextWorldLayout")?.methodGetComponent("EntityComponentSingletonContextWorldLayout");
        this.#spawnPosition = componentWorldLayout.methodGetRandomSpawnPositionXZ();
    }

    // #endregion lifecycle

    // #region getters

    methodGetSpawnPosition(){return this.#spawnPosition;}

    // #endregion getters
}
