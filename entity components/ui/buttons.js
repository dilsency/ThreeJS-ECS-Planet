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
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose()
    {
        // remove DOM element
        document.body.removeChild(this.#elementButton);
        // remove pointer, so that it can be garbage collected
        this.#elementButton = null;
    }
    // #endregion lifecycle

    // #region event listener handlers
    methodOnClickButton(e)
    {
        // we need to get EntityComponentContextInitialization (context_initialization.js)
        // that context entity-component holds .methodReturnToMainMenu

        // inline version : harder to read
        //this.methodGetEntityByName("InitializationContext")?.methodGetComponent("EntityComponentContextInitialization")?.methodReturnToMainMenu();

        // long version with returns; actually still hard to read
        // could also use .methodGetEnititiesByComponent or whatever
        const entityInitialization = this.methodGetEntityByName("InitializationContext");
        if(entityInitialization == null){return;}
        const entityComponentContextInitialization = entityInitialization.methodGetComponent("EntityComponentContextInitialization");
        if(entityComponentContextInitialization == null){return;}
        entityComponentContextInitialization.methodReturnToMainMenu();
    }
    // #endregion event listener handlers
}

//
export class EntityComponentButtonPointerLock extends EntityComponent
{
    // #region privates
    #params = null;

    //
    #elementButton = null;
    #isVisibleButton = true;

    // we need to store event listener handlers...
    // ...in order to be able to dispose of them
    #eventListenerHandlerOnPointerLockChange;
    #eventListenerHandlerOnPointerLockError;
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
        // we need to store event listener handlers...
        // ...in order to be able to dispose of them
        this.#eventListenerHandlerOnPointerLockChange = (e) => this.methodOnPointerLockChange(e)
        this.#eventListenerHandlerOnPointerLockError = (e) => this.methodOnPointerLockError(e);

        // attach those stored event listener handlers
        document.addEventListener("pointerlockchange", this.#eventListenerHandlerOnPointerLockChange, false);
        document.addEventListener("pointerlockerror", this.#eventListenerHandlerOnPointerLockError, false);

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
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose()
    {
        // remove DOM element
        document.body.removeChild(this.#elementButton);
        // remove pointer, so that it can be garbage collected
        this.#elementButton = null;

        // for event listeners on document/window, we need to store the function reference beforehand...
        // ...so that we can remove exactly that function instance...
        // ...whereas => or .bind(this) will erroneously create a NEW function instance

        document.removeEventListener("pointerlockchange", this.#eventListenerHandlerOnPointerLockChange, false);
        document.removeEventListener("pointerlockerror", this.#eventListenerHandlerOnPointerLockError, false);
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

    // #region event listener handlers
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
    // #endregion event listener handlers


}