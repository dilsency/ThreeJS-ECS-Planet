// imports
// base
import * as THREE from "three";
// ECS
import {EntityComponent} from "../../classes/ECS/entity_component.js";

export class EntityComponentMainMenu extends EntityComponent
{
    // #region privates
    #componentInstanceInitialization = null;
    #elementTitle = null;
    #elementButtonContainer = null;
    #listElementButtons = [];
    // #endregion privates

    // #region construct
    constructor(params)
    {
        super(params);
        //this.#params = params;
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize()
    {
        // context component, get, once
        this.#componentInstanceInitialization = this.methodGetEntityByName("SingletonContextInitialization")?.methodGetComponent("EntityComponentSingletonContextInitialization");

        //
        this.#elementTitle = document.createElement("div");
        this.#elementTitle.style.position = "fixed";
        this.#elementTitle.style.top = "calc(50% - 45px - 45px - 10px)";
        this.#elementTitle.style.bottom = "calc(50% - 45px)";
        this.#elementTitle.style.left = "calc(50% - 90px)";
        this.#elementTitle.style.right = "calc(50% - 90px)";
        this.#elementTitle.style.minWidth = "90px";
        this.#elementTitle.style.minHeight = "45px";
        this.#elementTitle.innerText = "Pick your starting location";
        document.body.appendChild(this.#elementTitle);

        // we create one containing parent for the buttons
        // easier to hide
        this.#elementButtonContainer = document.createElement("div");
        this.#elementButtonContainer.style.position = "fixed";
        this.#elementButtonContainer.style.display = "flex";
        this.#elementButtonContainer.style.flexFlow = "row nowrap";
        this.#elementButtonContainer.style.top = "calc(50% - 45px)";
        this.#elementButtonContainer.style.bottom = "calc(50% - 45px)";
        this.#elementButtonContainer.style.left = "calc(50% - 90px)";
        this.#elementButtonContainer.style.right = "calc(50% - 90px)";
        this.#elementButtonContainer.style.minWidth = "90px";
        this.#elementButtonContainer.style.minHeight = "45px";
        this.#elementButtonContainer.style.background = "red";
        document.body.appendChild(this.#elementButtonContainer);

        //
        var len = this.#componentInstanceInitialization.methodGetPresetCount();
        
        //
        console.log("number of presets to loop through");
        console.log("\t" + len);

        //
        for(var i = 0; i < len; i++)
        {
            //
            var elementButton = document.createElement("button");

            //
            var presetName = this.#componentInstanceInitialization.methodGetPresetNameByIndex(i);
            elementButton.innerText = presetName;

        //
        console.log("preset name at index: " + i);
        console.log("\t" + presetName);

            //
            elementButton.style.width = "90px";
            elementButton.style.fontSize = "11px";

            // necessary to capture the current value of i for the event listener closure
            // let is block-scoped, var is function-scoped
            // with let, we capture the current iteration's value
            // this wouldn't be the case with var
            // it would always capture the final value
            let iterationIndex = i;
            elementButton.addEventListener("click", ((e) => this.methodOnClickButton(e, iterationIndex)));

            //
            this.#elementButtonContainer.appendChild(elementButton);
            this.#listElementButtons.push(elementButton);
        }

        // #region message system handler registration
        this.methodRegisterMessageHandlerWithinEntity("initialization.confirmed",
            (paramMessage) => this.methodHide()
        );
        this.methodRegisterMessageHandlerWithinEntity("initialization.returnedToMenu",
            (paramMessage) => this.methodShow()
        );
        // #endregion message system handler registration
    }
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose()
    {
        //
        document.body.removeChild(this.#elementTitle);
        document.body.removeChild(this.#elementButtonContainer);
    }
    // #endregion lifecycle

    // #region methods
    methodOnClickButton(event, indexPreset)
    {
        //
        console.log("button clicked: index: " + indexPreset);
        
        //
        this.#componentInstanceInitialization.methodSetIndexPreset(indexPreset);

        // at the moment, each button also confirms
        this.methodOnClickButtonConfirm(event, indexPreset);
    }
    methodOnClickButtonConfirm(event, indexPreset)
    {
        // context component
        this.#componentInstanceInitialization.methodConfirm();

        // we use the message system to hide...
        // ...instead of doing it directly
        // the context component (initialization) above will do so
    }
    methodShow()
    {
        this.#elementTitle.style.display = "block";
        this.#elementButtonContainer.style.display = "flex";
    }
    methodHide()
    {
        this.#elementTitle.style.display = "none";
        this.#elementButtonContainer.style.display = "none";
    }
    // #endregion methods
}

export class EntityComponentLoadingScreen extends EntityComponent
{
    // #region privates
    #componentInstanceInitialization = null;
    #elementBase = null;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        super(params);
        //this.#params = params;
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize()
    {
        // context component, get, once
        this.#componentInstanceInitialization = this.methodGetEntityByName("SingletonContextInitialization")?.methodGetComponent("EntityComponentSingletonContextInitialization");

        //
        this.#elementBase = document.createElement("div");
        this.#elementBase.style.display = "none";
        this.#elementBase.style.pointerEvents = "none";
        this.#elementBase.style.position = "fixed";
        this.#elementBase.style.zIndex = "100";
        this.#elementBase.style.backgroundColor = "#7fcceb";
        this.#elementBase.style.top = "0";
        this.#elementBase.style.bottom = "0";
        this.#elementBase.style.left = "0";
        this.#elementBase.style.right = "0";
        this.#elementBase.style.width = "100vw";
        this.#elementBase.style.height = "100vh";
        this.#elementBase.innerText = "loading...";
        document.body.appendChild(this.#elementBase);

        // #region message system handler registration
        this.methodRegisterMessageHandlerWithinEntity("initialization.waiting",
            (paramMessage) => this.methodShow()
        );
        this.methodRegisterMessageHandlerWithinEntity("initialization.ready",
            (paramMessage) => 
                {
                    console.log("ready!");
                    this.methodOnReady(paramMessage);
                }
        );
        // #endregion message system handler registration
    }
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose()
    {
        //
        document.body.removeChild(this.#elementBase);
    }
    // #endregion lifecycle

    // #region methods
    methodShow()
    {
        this.#elementBase.style.display = "block";
        this.#elementBase.style.pointerEvents = "auto";
    }
    methodHide()
    {
        this.#elementBase.style.display = "none";
        this.#elementBase.style.pointerEvents = "none";
    }
    // #endregion methods

    // #region a
    methodOnReady(paramMessage)
    {
        this.methodHide();
        console.log("initialization ready!");

        // use the message system to broadcast
        
        // ...
    }
    // #endregion a
}