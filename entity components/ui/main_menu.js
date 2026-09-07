// imports
// base
import * as THREE from "three";
// ECS
import {EntityComponent} from "../../classes/ECS/entity_component.js";

export class EntityComponentMainMenu extends EntityComponent
{
    // #region privates
    #componentInitialization = null;
    #elementContainer = null;
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
        this.#componentInitialization = this.methodGetEntityByName("Initialization")?.methodGetComponent("EntityComponentContextInitialization");

        // we create one containing parent for the buttons
        // easier to hide
        this.#elementContainer = document.createElement("div");
        this.#elementContainer.style.position = "fixed";
        this.#elementContainer.style.display = "flex";
        this.#elementContainer.style.flexFlow = "row nowrap";
        this.#elementContainer.style.bottom = "30px";
        this.#elementContainer.style.left = "calc(50% - 90px)";
        this.#elementContainer.style.right = "calc(50% - 90px)";
        this.#elementContainer.style.minWidth = "90px";
        this.#elementContainer.style.minHeight = "45px";
        this.#elementContainer.style.background = "red";
        document.body.appendChild(this.#elementContainer);

        //
        var len = this.#componentInitialization.methodGetPresetCount();
        console.log(len);
        for(var i = 0; i < len; i++)
        {
            //
            var elementButton = document.createElement("button");

            //
            var presetName = this.#componentInitialization.methodGetPresetNameByIndex(i);
            elementButton.innerText = presetName;

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
            this.#elementContainer.appendChild(elementButton);
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
    methodUpdate()
    {
    }
    // #endregion lifecycle

    // #region methods
    methodOnClickButton(event, indexPreset)
    {
        //
        console.log("button clicked: index: " + indexPreset);
        
        //
        this.#componentInitialization.methodSetIndexPreset(indexPreset);

        // at the moment, each button also confirms
        this.methodOnClickButtonConfirm(event, indexPreset);
    }
    methodOnClickButtonConfirm(event, indexPreset)
    {
        // context component
        this.#componentInitialization.methodConfirm();

        // we use the message system to hide...
        // ...instead of doing it directly
        // the context component (initialization) above will do so
    }
    methodShow()
    {
        this.#elementContainer.style.display = "flex";
    }
    methodHide()
    {
        this.#elementContainer.style.display = "none";
    }
    // #endregion methods
}