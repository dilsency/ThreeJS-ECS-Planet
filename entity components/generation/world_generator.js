// imports
// base
import * as THREE from "three";
// ECS
import {Entity} from "../../classes/ECS/entity.js";
import {EntityComponent} from "../../classes/ECS/entity_component.js";

// JSON loading
import { hydrateParams } from "../../classes/loading-from-json/hydration.js";
import { entityComponentRegistry } from "../../classes/loading-from-json/registry.js";
import { prefabRegistry } from "../../classes/loading-from-json/registry.js";
import { worldRegistry } from "../../classes/loading-from-json/registry.js";
import { worldPresetRegistry } from "../../classes/loading-from-json/registry.js";

export class EntityComponentWorldGenerator extends EntityComponent
{
    // #region privates
    #componentInitialization = null;
    #componentEngine = null;
    #listEntities = [];
    // #endregion privates

    // #region construct
    constructor(params)
    {
        super(params);
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize()
    {
        // context components, get, once
        this.#componentInitialization = this.methodGetEntityByName("InitializationContext")?.methodGetComponent("EntityComponentContextInitialization");
        this.#componentEngine = this.methodGetEntityByName("EngineContext")?.methodGetComponent("EntityComponentContextEngine");

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

        // we need to use the registry to get the current world
        // previously, this was hard-coded

        // we do this by FIRST getting the preset

        //
        const currentPreset = this.#componentInitialization.methodGetCurrentPreset();
        console.log("currentPreset");
        console.log("\t" + currentPreset);
        console.log("currentPreset.name");
        console.log("\t" + currentPreset.name);
        console.log("currentPreset.world");
        console.log("\t" + currentPreset.world);

        // #region early return
        if(currentPreset == null || currentPreset.world == null){return;}
        // #endregion early return

        // with the preset in hand, we have the string-name of the current world
        // so we need to get that world

        //
        const currentWorld = worldRegistry[currentPreset.world];

        //
        console.log("currentWorld");
        console.log("\t" + currentWorld);
        //
        console.log("currentWorld.name");
        console.log("\t" + currentWorld.name);
        //
        console.log("Object.keys(currentWorld)");
        console.log("\t" + Object.keys(currentWorld));
        //
        console.log("currentWorld.entities");
        console.log("\t" + currentWorld.entities);

        // #region early return
        if(currentWorld == null || currentWorld.entities == null){return;}
        // #endregion early return

        // let's change the base/default background color accordingly
        this.#componentEngine.methodSetSceneColorFromHex(currentWorld.backgroundColor);

        // let's populate the world with our entities

        //
        // javascript version of for-each/foreach loop of an array, not object
        for(const iterationEntity of currentWorld.entities)
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

        // reminder : .components represents an array, not an object
        
        // we FIRST need to get the list of entity-components that are attached to a prefab
        // if iterationEntity is not a prefab (it will not have the .prefab property) ...
        // ... or if the we are indeed a prefab but that prefab does not have any entity-components ...
        // ...we will either way have an empty object/list
        // otherwise our object/list will consist of the entity-components associated with that prefab
        var listEntityComponentsPrefab = [];
        if(iterationEntity.prefab != null)
        {
            // we first grab the actual prefab
            // then grab the .components from that prefab
            // using registry -> prefabs
            const prefab = prefabRegistry[iterationEntity.prefab];
            // error handling / early return
            if(prefab == null){throw new Error("unknown prefab: " + iterationEntity.prefab);}
            //
            listEntityComponentsPrefab = prefab.components;
        }
        
        // now, we create a merged list, using the JavaScript non-destructive "spread" operation
        // from both the entity-components associated with a prefab (if any) ...
        // ... and the .components property of the iterationEntity
        // this is what allows our prefabs to have additional entity-components besides the one pre-defined
        // (reminder that ?? is the operator for "if null then this instead")
        const listEntityComponents = [ ...listEntityComponentsPrefab , ...(iterationEntity.components ?? []) ];

        // javascript version of for-each/foreach loop of an array, not object
        for(const iterationEntityComponent of listEntityComponents)
        {
            // "extract method" pattern
            this.methodCreateAndAddNewEntityComponent(newEntity, iterationEntityComponent, iterationEntity.overrideParams);
        }

        // then, we add our new entity to our list of entitites in the world
        this.#listEntities.push(newEntity);
    }
    methodCreateAndAddNewEntityComponent(newEntity, iterationEntityComponent, iterationEntityOverrideParams)
    {
        // we need to evaluate the class of the component first
        // we use the registry.js to look-up the classes
        const ClassOfComponent = entityComponentRegistry[iterationEntityComponent.type];

        // #region early return
        if(ClassOfComponent == null){throw new Error(`methodGenerate: unknown component type "${iterationEntityComponent.type}"`);}
        // #endregion early return

        // reminder : .params represents an object, not an array

        // before we hydrate our parameters
        // we need to override them...
        // IF we have the overrideParams property

        // this can be written much more concise, but I wouldn't be able to read it as easily
        const paramsBase = iterationEntityComponent.params ?? {};
        var paramsOverride = {};
        if(iterationEntityOverrideParams != null)
        {
            // we get the override parameters...
            // ...by passing in the Class name of the entity-component
            // because override parameters always start with that as the key
            paramsOverride = iterationEntityOverrideParams[iterationEntityComponent.type];
        }
        // we need to "shallow copy" so that we do not make permanent unwanted alterations
        // using the JavaScript non-destructive "spread" operation, this can be done
        // we then get both the base parameters, and the override parameters, in the same list
        // the order of the spread operation is important; the latter will override the former : "last write wins"
        const paramsMerged = {...paramsBase, ...paramsOverride};

        // next...
        // ...we "hydrate" our parameters...
        // ...meaning we convert them from strings to their actual types
        // the "??" means "if left is null, then this instead"
        const hydratedParams = hydrateParams(paramsMerged);

        // finally, we add the entity-component to our entity...
        // ...using the ClassOfComponent we evaluated earlier...
        // ...as well as our params, that we just "hydrated"
        newEntity.methodAddComponentWithName(iterationEntityComponent.type, new ClassOfComponent(hydratedParams));
    }
    methodTeardown(paramMessage)
    {
        // here, we need to loop through all of our components
        // and flag them all for deletion
        // pretty simple, actually

        // JavaScript version of a for-each loop
        for(const iteratorEntity of this.#listEntities)
        {
            //
            iteratorEntity.methodFlagForDeletion();
        }

        // with the knowledge that all of our entities will be deleted ...
        // ... we can remove pointer, so that it can be garbage collected
        this.#listEntities = [];
        // it will be garbage collected even if it is = []; instead of = null;
        // but we will re-use it again later, so we can let it be an empty list

        // we also reset the background color
        this.#componentEngine.methodResetSceneColor();
    }
    // #endregion methods
}