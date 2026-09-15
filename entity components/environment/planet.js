// imports
// base
import * as THREE from "three";
// ECS
import {EntityComponent} from "../../classes/ECS/entity_component.js";

//
export class EntityComponentPlanet extends EntityComponent {
    // #region privates
    #params = null;
    //
    #mesh = null;
    #geometry = null;
    // params.model is string, representing the name of the model to load
    #model = null;
    #radius = 1.0;
    #color = "#FFFFFF";
    // #endregion privates

    // #region construct
    constructor(params) {
        //
        super(params);
        //
        this.#params = params;
        // again, params.model is string, representing the name of the model to load
        if(params.model != null){ this.#model = params.model; }
        if(params.radius != null){ this.#radius = params.radius; }
        if(params.color != null){ this.#color = params.color; }
    }
    // #endregion construct

    // #region lifecycle
    async methodInitialize() {
        // #region early return
        // we don't have a model to load; exit
        if(this.#model == null){ return; }
        // #endregion early return

        // #region get component
        const entityComponentModelCache = this.methodGetEntityByName("SingletonContextModelCache")?.methodGetComponent("EntityComponentSingletonContextModelCache");
        // #endregion get component

        // #region early return
        if(entityComponentModelCache == null){console.error("no entity component");return;}
        // #endregion early return

        // #region body
        this.#geometry = await entityComponentModelCache.methodGetModelGeometry(this.#model);
        // #endregion body

        // #region early return
        // since we have used "await"
        // we could have lost our geometry already (asynchronously)
        // due to "teardown" or disposal
        // so what we do is check if this is flagged for disposal / deletion / teardown
        // and if so, we nope out
        if(this.methodGetIsThisOrParentFlaggedForDeletion()){return;}
        // #endregion early return

        // #region body
        //
        const material = new THREE.MeshStandardMaterial();
        material.color = new THREE.Color(this.#color);
        material.flatShading = true;
        //
        this.#mesh = new THREE.Mesh(this.#geometry, material);
        this.#mesh.scale.setScalar(this.#radius);
        this.#mesh.castShadow = true;
        this.#mesh.receiveShadow = true;
        //
        this.methodGetScene().add(this.#mesh);
        // #endregion body
    }
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose()
    {
        // #region early return
        // we don't have a mesh to dispose; exit
        if(this.#mesh == null){ return; }
        // #endregion early return

        // #region body
        //
        this.methodGetScene().remove(this.#mesh);
        //
        this.#mesh.material.dispose();
        // remove pointer as well
        this.#mesh = null;
        // we do NOT dispose of geometry
        // we cache it for a reason, after all
        // #endregion body
    }
    // #endregion lifecycle

    // #region getters
    methodGetGeometry() { return this.#geometry; }
    methodGetRadius() { return this.#radius; }
    // #endregion getters
}
