// #region ECS
import { EntityComponent } from "../../classes/ECS/entity_component.js";
// #endregion ECS

export class EntityComponentChatList extends EntityComponent
{
    // #region privates
    #elementContainer = null;
    #elementChat = null;
    //
    #listChatMessageElements = [];
    //
    #listChatMessages = [];
    #listChatMessagesMax = 10;
    //
    #timeLifeDefault = 5;
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
        const timeElapsed = this.methodGetTimeElapsed();

        //
        this.#elementContainer = document.createElement("div");
        this.#elementContainer.style.position = "fixed";
        this.#elementContainer.style.zIndex = "100";
        this.#elementContainer.style.top = "50%";
        this.#elementContainer.style.transform = "translateY(-50%)";
        this.#elementContainer.style.left = "2px";
        this.#elementContainer.style.backgroundColor = "#00000060";
        this.#elementContainer.style.color = "#FFFFFF";
        document.body.appendChild(this.#elementContainer);

        //
        this.#elementChat = document.createElement("div");
        this.#elementChat.style.fontSize = "10px";
        this.#elementChat.style.lineHeight = "10px";
        this.#elementChat.style.marginBottom = "-8px";
        this.#elementContainer.appendChild(this.#elementChat);

        //
        this.#methodAddChatMessage(
            {
                "text": "Chat list initiated!",
                "timeSpawned": timeElapsed,
                "timeLife": 10,
            }
        );

        // #region handler registration
        this.methodRegisterMessageHandlerWithinEntity("chat.message", (broadcastItem) =>
        {
            console.log("broadcast received : chat.message");

            if(broadcastItem.invokableHandlerValue == null){return;}
            if(broadcastItem.invokableHandlerValue["text"] == null){return;}

            const message = {
                "username": broadcastItem.invokableHandlerValue["username"],
                "text": broadcastItem.invokableHandlerValue["text"],
                "timeSpawned": broadcastItem.invokableHandlerValue["timeSpawned"],
                "timeLife": broadcastItem.invokableHandlerValue["timeLife"],
                "timeSpan": broadcastItem.invokableHandlerValue["timeSpan"],
            };

            // add time, if none exists
            if(message["timeSpawned"] == null)
            {
                message["timeSpawned"] = this.methodGetTimeElapsed();
            }
            if(message["timeLife"] == null)
            {
                message["timeLife"] = this.#timeLifeDefault;
            }

            // check that text is actually a string
            if(!(typeof message["text"] === 'string'))
            {
                message["text"] = String(message["text"]);
            }

            // we could use different methods based on which input data we have
            // for example
            // a notice from the game should probably be a white color, no username, no time data except lifespan
            // whereas
            // a warning would be similar, but yellow
            // whereas
            // a message from a user to other users, would be colored differently, and have a username
            // whereas
            // a "message" by a user that acts as a Command, would not have a username
            this.#methodAddChatMessage(message);
        });
        // #endregion handler registration

        //
        console.log("EntityComponentChatList.methodInitialize() done");
    }
    methodUpdate()
    {
        // time object replaces time parameters
        const timeElapsed = this.methodGetTimeElapsed();

        //
        const len = this.#listChatMessages.length;

        // reverse loop through list
        for(var i = (len - 1); i >= 0; i--)
        {
            const timeExpires = this.#listChatMessages[i]["timeSpawned"] + this.#listChatMessages[i]["timeLife"];
            if(timeExpires < timeElapsed)
            {
                // delete chat message here
                this.#methodRemoveChatMessageByIndex(i);
            }
        }
    }
    methodDispose()
    {
        //
        document.body.removeChild(this.#elementContainer);

        //
        this.#elementContainer = null;
        this.#elementChat = null;

        //
        this.#listChatMessages = [];
        this.#listChatMessageElements = [];
    }
    // #endregion lifecycle

    // #region private methods
    #methodAddChatMessage(message)
    {
        // #region format time stamps
        // note :
        // timeSpawned and timeLife are set manually by us, in seconds
        // timeSpan is calculated from two performance.now() , and they will be measured in milliseconds

        var timeSpawned = "-";
        var timeSpawnedEnd = "-";
        var timeSpan = "-";
        if(message["timeSpawned"] != null)
        {
            // unit : seconds
            timeSpawned = message["timeSpawned"].toFixed(1);
        }
        if(message["timeSpawned"] != null && message["timeLife"] != null)
        {
            // unit : seconds
            timeSpawnedEnd = ((message["timeSpawned"] + message["timeLife"])).toFixed(1);
        }
        if(message["timeSpan"] != null)
        {
            // unit : milliseconds
            timeSpan = (message["timeSpan"] / 1000).toFixed(1);
        }
        // #endregion format time stamps

        const elementChatMessage = document.createElement("div");
        elementChatMessage.title = (timeSpawned + " / " + timeSpawnedEnd + " : " + timeSpan);
        elementChatMessage.style.marginBottom = "8px";
        this.#elementChat.appendChild(elementChatMessage);

        //
        elementChatMessage.textContent = "";
        if(message["username"] != null && message["username"].length >= 2)
        {
            elementChatMessage.textContent += (message["username"] + ": ");
        }
        elementChatMessage.textContent += message["text"];

        this.#listChatMessages.push(message);
        this.#listChatMessageElements.push(elementChatMessage);

        //
        if (this.#listChatMessages.length > this.#listChatMessagesMax)
        {
            this.#methodRemoveChatMessageByIndex(0);
        }
    }
    #methodRemoveChatMessageByIndex(index)
    {
        //
        if (index >= 0 && index < this.#listChatMessages.length)
        {
            //
            this.#listChatMessages.splice(index, 1);
            //
            const messageElement = this.#listChatMessageElements.splice(index, 1)[0];
            this.#elementChat.removeChild(messageElement);            
        }
    }
    // #endregion private methods
}