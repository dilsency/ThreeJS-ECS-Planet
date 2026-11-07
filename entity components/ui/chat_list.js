// #region ECS
import { EntityComponent } from "../../classes/ECS/entity_component.js";
// #endregion ECS

export class EntityComponentChatList extends EntityComponent
{
    // #region privates
    #elementContainer = null;
    #elementChatList = null;
    // #endregion privates

    // #region constructor
    constructor(params)
    {
        super(params);
        console.log("EntityComponentChatList.constructor()");
    }
    // #endregion constructor

    // #region lifecycle
    methodInitialize()
    {
        console.log("EntityComponentChatList.methodInitialize()");
        //
        this.#elementContainer = document.createElement("div");
        this.#elementContainer.style.position = "fixed";
        this.#elementContainer.style.bottom = "2px";
        this.#elementContainer.style.left = "2px";
        this.#elementContainer.style.backgroundColor = "#00000060";
        this.#elementContainer.style.color = "#FFFFFF";
        document.body.appendChild(this.#elementContainer);

        //
        this.#elementChatList = document.createElement("div");
        this.#elementChatList.style.fontSize = "10px";
        this.#elementChatList.style.lineHeight = "10px";
        this.#elementChatList.style.marginBottom = "-8px";
        this.#elementContainer.appendChild(this.#elementChatList);

        //
        for(var i = 0; i < 10; i++)
        {
            this.#methodAddChatMessage({"text": "chat message " + i});
        }

        //
        console.log("EntityComponentChatList.methodInitialize() done");
    }
    methodUpdate(timeElapsed, timeDelta)
    {
    }
    methodDispose()
    {
        //
        document.body.removeChild(this.#elementContainer);

        //
        this.#elementContainer = null;
        this.#elementChatList = null;
    }
    // #endregion lifecycle

    // #region private methods
    #methodAddChatMessage(message)
    {
        const elementChatMessage = document.createElement("div");
        elementChatMessage.innerText = message.text;
        this.#elementChatList.appendChild(elementChatMessage);

        elementChatMessage.style.marginBottom = "8px";
    }
    // #endregion private methods
}