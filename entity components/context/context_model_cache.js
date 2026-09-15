// imports
// ECS
import {EntityComponent} from "../../classes/ECS/entity_component.js";
// loaders
import { modelRegistry } from "../../classes/loading-from-json/registry.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

export class EntityComponentContextModelCache extends EntityComponent
{
    // #region privates
    // modelName -> Promise<THREE.BufferGeometry>
    #cache = new Map();
    // #endregion privates

    // #region construct
    constructor(params) {
        //
        super(params);
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize() { }
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose() { }
    // #endregion lifecycle

    // #region methods public
    methodGetModelGeometry(modelName)
    {
        // #region early return
        // if we already have the model
        // we can just return it
        if(this.#cache.has(modelName))
        {
            return this.#cache.get(modelName);
        }
        // #endregion early return

        //
        const promise = this.#methodLoadModelGeometry(modelName);
        this.#cache.set(modelName, promise);
        return promise;
    }
    // #endregion methods public

    // #region methods private
    async #methodLoadModelGeometry(modelName)
    {
        // we use our registry to get the loader
        // this also has the path
        const modelLoader = modelRegistry[modelName];

        // #region early return
        if(modelLoader == null){throw new Error("no model loader for ; " + modelName); }
        // #endregion early return

        //
        const url = await modelLoader();
        //
        const group = await new OBJLoader().loadAsync(url);

        // groups can have multiple meshes
        // but we know that our icosahedron model only has one mesh
        let geometry = this.#methodGetFirstMeshGeometryInGroup(group, modelName);

        // #region early return
        // we have not found a mesh in the group
        // and thus no geometry
        if(geometry == null){throw new Error("no geometry found in model ; " + modelName); }
        // #endregion early return

        //
        return geometry;
    }
    #methodGetFirstMeshGeometryInGroup(group, modelName)
    {
        let geometry = null;
        group.traverse((child) => { 
            
            if(geometry == null && child.isMesh)
            {
                geometry = child.geometry;
            }

         });
        return geometry;
    }
    // #endregion methods private
}