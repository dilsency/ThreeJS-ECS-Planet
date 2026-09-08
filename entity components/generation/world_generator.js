// imports
// base
import * as THREE from "three";
// ECS
import {Entity} from "../../classes/ECS/entity.js";
import {EntityComponent} from "../../classes/ECS/entity_component.js";

// data : worlds
import worldDefault from "../../data/worlds/default.json";

// JSON loading
import { hydrateParams } from "../../classes/loading-from-json/hydration.js";
import { entityComponentRegistry } from "../../classes/loading-from-json/registry.js";

export class EntityComponentWorldGenerator extends EntityComponent
{
    // #region privates
    #listEntities = [];
    // #endregion privates

    // #region lifecycle
    constructor(params)
    {
        super(params);
    }
    methodInitialize()
    {
        // #region message system handler registration
        this.methodRegisterMessageHandlerWithinEntity("initialization.confirmed",
            (paramMessage) => this.methodGenerate(paramMessage)
        );
        this.methodRegisterMessageHandlerWithinEntity("initialization.returnedToMenu",
            (paramMessage) => this.methodTeardown(paramMessage)
        );
        // #endregion message system handler registration
    }
    // #endregion lifecycle

    // #region methods
    methodGenerate(paramMessage)
    {
        //
        console.log("() methodGenerate");
        console.log(paramMessage);

        //
        console.log(worldDefault.entities);

        // javascript version of for-each/foreach loop
        for(const iterationEntity of worldDefault.entities)
        {
            // "extract method" pattern
            this.methodCreateAndAddNewEntity(iterationEntity);
        }
    }
    methodCreateAndAddNewEntity(iterationEntity)
    {
        const newEntity = new Entity();

        // will "bubble up" / "passthrough" to the EntityManager
        this.methodAddEntity(newEntity, iterationEntity.name);

        // build entity-components

        // javascript version of for-each/foreach loop
        for(const iterationEntityComponent of iterationEntity.components)
        {
            // "extract method" pattern
            this.methodCreateAndAddNewEntityComponent(newEntity, iterationEntityComponent);
        }

        // then, we add our new entity to our list of entitites in the world
        this.#listEntities.push(newEntity);
    }
    methodCreateAndAddNewEntityComponent(newEntity, iterationEntityComponent)
    {
        // we need to evaluate the class of the component first
        // we use the registry.js to look-up the classes
        const ClassOfComponent = entityComponentRegistry[iterationEntityComponent.type];

        // #region early return
        if(ClassOfComponent == null){throw new Error(`methodGenerate: unknown component type "${iterationEntityComponent.type}"`);}
        // #endregion early return

        // next...
        // ...we "hydrate" our parameters...
        // ...meaning we convert them from strings to their actual types
        // the "??" means "if left is null, then this instead"
        const hydratedParams = hydrateParams(iterationEntityComponent.params ?? {});

        // finally, we add the entity-component to our entity...
        // ...using the ClassOfComponent we evaluated earlier...
        // ...as well as our params, that we just "hydrated"
        newEntity.methodAddComponentWithName(iterationEntityComponent.type, new ClassOfComponent(hydratedParams));
    }
    methodTeardown(paramMessage)
    {
        console.log("() methodTeardown");
        console.log(paramMessage);
    }
    // #endregion methods
}