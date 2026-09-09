// imports
// base
import * as THREE from "three";
// ECS
import { EntityComponent } from "../../classes/ECS/entity_component.js";

//
export class EntityComponentButtonReturnToMainMenu extends EntityComponent
{
    // #region privates
    #elementButton = null;
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
        //
        this.#elementButton = document.createElement("button");
        this.#elementButton.innerText = "Return to Main Menu";
        this.#elementButton.style.position = "fixed";
        this.#elementButton.style.top = "0px";
        this.#elementButton.style.left = "0px";
        this.#elementButton.style.width = "90px";
        this.#elementButton.style.fontSize = "11px";
        this.#elementButton.addEventListener("click", ((e) => this.methodOnClickButton(e)));
        document.body.appendChild(this.#elementButton);
    }
    // #endregion lifecycle

    // #region event listeners
    methodOnClickButton(e)
    {
        // we need to get EntityComponentContextInitialization (context_initialization.js)
        // that context entity-component holds .methodReturnToMainMenu

        // inline version : harder to read
        //this.methodGetEntityByName("Initialization")?.methodGetComponent("EntityComponentContextInitialization")?.methodReturnToMainMenu();

        // long version with returns; actually still hard to read
        // could also use .methodGetEnititiesByComponent or whatever
        const entityInitialization = this.methodGetEntityByName("Initialization");
        if(entityInitialization == null){return;}
        const entityComponentContextInitialization = entityInitialization.methodGetComponent("EntityComponentContextInitialization");
        if(entityComponentContextInitialization == null){return;}
        entityComponentContextInitialization.methodReturnToMainMenu();
    }
    // #endregion event listeners
}

//
export class EntityComponentButtonPointerLock extends EntityComponent
{
    // #region privates
    #params = null;
    //
    #elementButton = null;
    #isVisibleButton = true;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        super(params);
        this.#params = params;
    }
    // #endregion construct

     // #region lifecycle
    methodInitialize()
    {
        //
        document.addEventListener("pointerlockchange", this.methodOnPointerLockChange.bind(this), false);
        document.addEventListener("pointerlockerror", this.methodOnPointerLockError.bind(this), false);

        //
        this.#elementButton = document.createElement("button");
        this.#elementButton.innerText = "PointerLock";
        this.#elementButton.style.position = "fixed";
        this.#elementButton.style.bottom = "0";
        this.#elementButton.style.left = "calc(50% - 45px)";
        this.#elementButton.style.right = "calc(50% - 45px)";
        this.#elementButton.style.width = "90px";
        this.#elementButton.style.fontSize = "11px";
        this.#elementButton.addEventListener("click", ((e) => this.methodOnClickButton(e)));
        document.body.appendChild(this.#elementButton);
    }

    methodUpdate(timeElapsed, timeDelta)
    {
    }
    // #endregion lifecycle

    // #region getters
    methodGetElementButton()
    {
        return this.#elementButton;
    }
    methodGetIsPointerLocked()
    {
        const res = (document.pointerLockElement == null || document.pointerLockElement == undefined || document.pointerLockElement !== this.methodGetRenderer().domElement);

        return !res;
    }
    // #endregion getters

    // #region event listeners
    async methodOnClickButton(e)
    {
        await this.methodGetRenderer().domElement.requestPointerLock();
    }

    methodOnPointerLockChange(e)
    {
        //
        const res = this.methodGetIsPointerLocked();
        if(!res)
        {
            this.#isVisibleButton = true;
            this.#elementButton.style.display = "block";
        }
        else {
            this.#isVisibleButton = false;
            this.#elementButton.style.display = "none";
        }
    }
    methodOnPointerLockError(e)
    {
        
    }
    // #endregion event listeners


}