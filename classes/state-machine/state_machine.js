export class StateMachine
{
    //
    #currentState = null;
    #prevState = null;
    #onEnterCallbacks = {};
    #onEnterCallbacksAny = [];

    //
    constructor(initialState)
    {
        this.#currentState = initialState;
    }

    //
    methodGetPrevState(){return this.#prevState;}
    methodGetCurrentState(){ return this.#currentState; }
    methodGetState(){ 
        // alias function
        return this.methodGetCurrentState();
    }
    // register handler
    methodRegisterHandler(prevState, newState, callback)
    {
        const combinedKey = prevState.toString() + "→" + newState.toString();

        this.#onEnterCallbacks[combinedKey] = callback;
    }
    methodRegisterHandlerOnAny(callback)
    {
        this.#onEnterCallbacksAny.push(callback);
    }

    //
    methodSetState(timeElapsed, timeDelta, newState)
    {
        // alias function
        this.methodTransitionTo(timeElapsed, timeDelta, newState);
    }
    methodTransitionTo(timeElapsed, timeDelta, newState)
    {
        // early return
        if(this.#currentState == newState){return;}

        //
        const combinedKey = this.#currentState.toString() + "→" + newState.toString();

        // first we backup the old state
        this.#prevState = this.#currentState;

        //
        this.#currentState = newState;

        // invoke callback, if there is one
        // this syntax is not legible to me
        // would prefer to make it more readable
        this.#onEnterCallbacks[combinedKey]?.(timeElapsed, timeDelta);

        // we can also have a callback in the array "any"; we try to invoke those as well
        for(const invokableCallback of this.#onEnterCallbacksAny)
        {
            if(invokableCallback == null){continue;}

            // I would have preferred invokableCallback.invoke()
            // but .invoke() is not a thing in JavaScript 🥲
            invokableCallback(timeElapsed, timeDelta, this.#prevState, newState);
        }
    }
}