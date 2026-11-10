// #region ECS
import { EntityComponent } from "../../../classes/ECS/entity_component.js";
// #endregion ECS
// #region enums
import { EnumModeVoiceTranscriber } from "../../../classes/enums.js";
// #endregion enums
import { EntityComponentVoiceTranscriber } from "../../voice/transcriber.js";

export class EntityComponentSingletonContextVoice extends EntityComponent
{
    // #region privates
    #mode = EnumModeVoiceTranscriber.None;
    //
    #isKeyHeld = false;
    #isKeyHeldPrevious = null;
    //
    #componentInstanceTranscriber = null;
    //
    #eventListenerHandlerOnKeyDown = null;
    #eventListenerHandlerOnKeyUp = null;
    // #endregion privates

    // #region constructor
    constructor(params)
    {
        super(params);
    }
    // #endregion constructor

    // #region lifecycle
    methodInitialize()
    {
        //
        console.log("() methodInitialize | EntityComponentSingletonContextVoice");

        //
        this.#componentInstanceTranscriber = new EntityComponentVoiceTranscriber();
        // attach to own parent (crazy stuff)
        this.methodGetParent().methodAddComponentWithName("EntityComponentVoiceTranscriber", this.#componentInstanceTranscriber);

        // #region broadcast registration
        this.methodRegisterMessageHandlerWithinEntity("voice.mode.set", (broadcastItem) =>
        {
            const modeToSet = broadcastItem.invokableHandlerValue;
            this.methodSetMode(modeToSet);
        });
        // #endregion broadcast registration

        // #region event listeners
        //
        this.#eventListenerHandlerOnKeyDown = (e) => this.methodEventOnKeyDown(e);
        this.#eventListenerHandlerOnKeyUp = (e) => this.methodEventOnKeyUp(e);
        //
        document.addEventListener('keydown', this.#eventListenerHandlerOnKeyDown, false);
        document.addEventListener('keyup', this.#eventListenerHandlerOnKeyUp, false);
        // #endregion event listeners
    }
    methodUpdate()
    {
        if(this.#isKeyHeld && !this.#isKeyHeldPrevious)
        {
            this.#componentInstanceTranscriber.methodStartRecording();
        }
        else if (!this.#isKeyHeld && this.#isKeyHeldPrevious)
        {
            this.#componentInstanceTranscriber.methodStopRecording();
        }

        this.#isKeyHeldPrevious = this.#isKeyHeld;
    }
    methodDispose()
    {
        // for event listeners on document/window, we need to store the function reference beforehand...
        // ...so that we can remove exactly that function instance...
        // ...whereas => or .bind(this) will erroneously create a NEW function instance
        document.removeEventListener('keydown', this.#eventListenerHandlerOnKeyDown, false);
        document.removeEventListener('keyup', this.#eventListenerHandlerOnKeyUp, false);
    }
    // #endregion lifecycle

    // #region event handlers
    methodEventOnKeyDown(e)
    {
        if(this.#mode === EnumModeVoiceTranscriber.None){return;}
        if(e.repeat){return;}

        if (e.code === "KeyV")
        {
            this.#isKeyHeld = true;
        }
    }
    methodEventOnKeyUp(e)
    {
        if (e.code === "KeyV")
        {
            this.#isKeyHeld = false;
        }
    }
    // #endregion event handlers

    // #region setters
    methodSetMode(mode)
    {
        // we check that our Enum actually has a mode of that name
        // if it does not, we early-return
        if(!this.methodGetIsModeValid(mode)){console.warn("non-existing mode: " + mode);return;}

        //
        this.#mode = mode;
        //
        this.#componentInstanceTranscriber.methodSetTranscriber(mode);
    }
    // #endregion setters

    // #region getters
    methodGetIsModeValid(mode)
    {
        // Object.values , not Object.keys ...for whatever reason
        return Object.values(EnumModeVoiceTranscriber).includes(mode);
    }
    methodGetMode()
    {
        return this.#mode;
    }
    // #endregion getters
}