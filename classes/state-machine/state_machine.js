export class StateMachine
{
    //
    #currentState = null;
    #onEnterCallbacks = {};

    //
    constructor(initialState)
    {
        this.#currentState = initialState;
    }

    //
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

    //
    methodSetState(newState)
    {
        // alias function
        this.methodTransitionTo(newState);
    }
    methodTransitionTo(newState)
    {
        // early return
        if(this.#currentState == newState){return;}

        //
        const combinedKey = this.#currentState.toString() + "→" + newState.toString();

        //
        this.#currentState = newState;

        // invoke callback, if there is one
        // this syntax is not legible to me
        // would prefer to make it more readable
        this.#onEnterCallbacks[combinedKey]?.();
    }
}