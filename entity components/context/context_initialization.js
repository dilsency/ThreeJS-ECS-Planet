// imports
// base
import * as THREE from "three";
// ECS
import {EntityComponent} from "../../classes/ECS/entity_component.js";
import { worldPresetRegistry } from "../../classes/loading-from-json/registry.js";

export class EntityComponentContextInitialization extends EntityComponent
{
    // #region privates
    #listPresets = [];
    #indexPreset = 0;
    #lengthPresets = 0;
    #isConfirmed = false;
    // #endregion privates

    // #region lifecycle

    methodInitialize()
    {
        //
        this.#indexPreset = 0;

        // we want to get the presets from our existing registry and .json files

        // worldPresetRegistry is an array, not a dictionary (unlike the other registries)
        this.#listPresets = worldPresetRegistry;
        //this.#listPresets = Object.values(worldPresetRegistry);
        this.#lengthPresets = this.#listPresets.length;

        //
        console.log("this.#listPresets");
        console.log("\t" + this.#listPresets);

        //
        console.log("this.#listPresets[0]");
        console.log("\t" + this.#listPresets[0]);
        //
        console.log("this.methodGetCurrentPreset()");
        console.log("\t" + this.methodGetCurrentPreset());
        //
        console.log("this.methodGetPresetName()");
        console.log("\t" + this.methodGetPresetName());
    }
    // #endregion lifecycle

    // #region getters
    methodGetPresetByIndex(indexPreset){
        // #region early return
        // out of range
        if(indexPreset < 0 || indexPreset >= this.#lengthPresets){return null;}
        // #endregion early return

        //
        return this.#listPresets[indexPreset];
    }
    methodGetPresetCount(){
        return this.#lengthPresets;
    }
    methodGetIndexPreset(){
        return this.#indexPreset;
    }
    methodGetCurrentPreset(){
        //
        return this.methodGetPresetByIndex(this.#indexPreset);
    }
    methodGetPresetName(){
        //
        return this.methodGetPresetNameByIndex(this.#indexPreset);
    }
    methodGetPresetNameByIndex(indexPreset){
        var preset = this.methodGetPresetByIndex(indexPreset);
        // #region early return
        if(preset == null){return;}
        // #endregion early return

        //
        return preset.name;
    }
    methodGetIsConfirmed(){
        return this.#isConfirmed;
    }
    // #endregion getters

    // #region setters
    methodSetIndexPreset(indexPreset){
        // #region early return
        // you cannot change, if you have confirmed
        if(this.#isConfirmed){return;}
        // out of range
        if(indexPreset < 0 || indexPreset >= this.#lengthPresets){return;}
        // #endregion early return

        this.#indexPreset = indexPreset;
    }
    // #endregion setters

    // #region methods
    methodConfirm(){
        // #region early return
        if(this.#isConfirmed){return;}
        // #endregion early return
        this.#isConfirmed = true;

        // use the message system to broadcast

        // both to MainMenu
        this.methodSendMessageToEntitiesWithComponent("EntityComponentMainMenu", {
            "invokableHandlerName": "initialization.confirmed",
            "invokableHandlerValue": null
        });
        // and to WorldGenerator
        this.methodSendMessageToEntitiesWithComponent("EntityComponentWorldGenerator", {
            "invokableHandlerName": "initialization.confirmed",
            "invokableHandlerValue": null
        });
    }
    methodReturnToMainMenu()
    {
        // #region early return
        if(this.#isConfirmed == false){return;}
        // #endregion early return

        this.#isConfirmed = false;

        // use the message system to broadcast

        // both to MainMenu
        this.methodSendMessageToEntitiesWithComponent("EntityComponentMainMenu", {
            "invokableHandlerName": "initialization.returnedToMenu",
            "invokableHandlerValue": null
        });
        // and to WorldGenerator
        this.methodSendMessageToEntitiesWithComponent("EntityComponentWorldGenerator", {
            "invokableHandlerName": "initialization.returnedToMenu",
            "invokableHandlerValue": null
        });
    }
    // #endregion methods
}