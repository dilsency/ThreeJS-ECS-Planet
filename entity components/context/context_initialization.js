// imports
// base
import * as THREE from "three";
// ECS
import {EntityComponent} from "../../classes/ECS/entity_component.js";

class InitPreset {
    // #region privates
    #presetName = "Default";
    #planetSize = 1.0;
    #playerInitialPlanetFaceIndex = 0;
    #playerInitialPlanetFaceOffsetVertical = 1.0;
    #playerInitialPlanetFaceOffsetHorizontal = new THREE.Vector2(0.0, 0.0);
    // #endregion privates


    // #region constructor
    constructor (args)
    {
        // #region early return
        if(args == null){return;}
        // #endregion early return

        // #region body
        if(args.presetName != undefined){
            this.#presetName = args.presetName;
        }
        if(args.planetSize != undefined){
            this.#planetSize = args.planetSize;
        }
        if(args.playerInitialPlanetFaceIndex != undefined){
            this.#playerInitialPlanetFaceIndex = args.playerInitialPlanetFaceIndex;
        }
        if(args.playerInitialPlanetFaceOffsetVertical != undefined){
            this.#playerInitialPlanetFaceOffsetVertical = args.playerInitialPlanetFaceOffsetVertical;
        }
        if(args.playerInitialPlanetFaceOffsetHorizontal != undefined){
            this.#playerInitialPlanetFaceOffsetHorizontal = args.playerInitialPlanetFaceOffsetHorizontal;
        }
        // #endregion body
    }
    // #endregion constructor

    // #region getters
    methodGetPresetName(){
        return this.#presetName;
    }
    methodGetPlanetSize(){
        return this.#planetSize;
    }
    methodGetPlayerInitialPlanetFaceIndex(){
        return this.#playerInitialPlanetFaceIndex;
    }
    methodGetPlayerInitialPlanetFaceOffsetVertical(){
        return this.#playerInitialPlanetFaceOffsetVertical;
    }
    methodGetPlayerInitialPlanetFaceOffsetHorizontal(){
        return this.#playerInitialPlanetFaceOffsetHorizontal;
    }
    // #endregion getters
}

export class EntityComponentContextInitialization extends EntityComponent
{
    // #region privates
    #listPresets = [];
    #indexPreset = 0;
    #isConfirmed = false;
    // #endregion privates

    // #region lifecycle

    methodInitialize()
    {
        //
        this.#indexPreset = 0;

        //
        this.#listPresets = [];
        this.#listPresets.push(new InitPreset({
            "presetName": "Default",
            "planetSize": 1.0,
            "playerInitialPlanetFaceIndex": 0,
            "playerInitialPlanetFaceOffsetVertical": 1.0,
            "playerInitialPlanetFaceOffsetHorizontal": new THREE.Vector2(0.0, 0.0)
        }));
        this.#listPresets.push(new InitPreset({
            "presetName": "Alternative",
            "planetSize": 1.2,
            "playerInitialPlanetFaceIndex": 1,
            "playerInitialPlanetFaceOffsetVertical": 5.0,
            "playerInitialPlanetFaceOffsetHorizontal": new THREE.Vector2(0.0, 0.0)
        }));
    }

    // #endregion lifecycle

    // #region getters
    methodGetPresetByIndex(indexPreset){
        // #region early return
        // out of range
        if(indexPreset < 0 || indexPreset >= this.#listPresets.length){return null;}
        // #endregion early return

        return this.#listPresets[indexPreset];
    }
    methodGetPresetCount(){
        return this.#listPresets.length;
    }
    methodGetIndexPreset(){
        return this.#indexPreset;
    }
    methodGetCurrentPreset(){
        return this.#listPresets[this.#indexPreset];
    }
    methodGetPresetName(){
        return this.methodGetCurrentPreset().methodGetPresetName();
    }
    methodGetPresetNameByIndex(indexPreset){
        var preset = this.methodGetPresetByIndex(indexPreset);
        return (preset == null) ? "" : preset.methodGetPresetName();
    }
    methodGetIsConfirmed(){
        return this.#isConfirmed;
    }
    methodGetPlanetSize(){
        return this.methodGetCurrentPreset().methodGetPlanetSize();
    }
    methodGetPlayerInitialPlanetFaceIndex(){
        return this.methodGetCurrentPreset().methodGetPlayerInitialPlanetFaceIndex();
    }
    methodGetPlayerInitialPlanetFaceOffsetVertical(){
        return this.methodGetCurrentPreset().methodGetPlayerInitialPlanetFaceOffsetVertical();
    }
    methodGetPlayerInitialPlanetFaceOffsetHorizontal(){
        return this.methodGetCurrentPreset().methodGetPlayerInitialPlanetFaceOffsetHorizontal();
    }
    // #endregion getters

    // #region setters
    methodSetIndexPreset(indexPreset){
        // #region early return
        // you cannot change, if you have confirmed
        if(this.#isConfirmed){return;}
        // out of range
        if(indexPreset < 0 || indexPreset >= this.#listPresets.length){return;}
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