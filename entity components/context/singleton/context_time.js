// #region ECS
import { EntityComponent } from "../../../classes/ECS/entity_component.js";
// #endregion ECS

export class EntityComponentSingletonContextTime extends EntityComponent
{
    // #region privates
    //
    #timeElapsed = 0.0;
    #timeDelta = 0.0;
    // an inactive browser tab would have an enormous timeDelta; we will clamp it
    #timeDeltaMax = 0.2;
    //
    #timeElapsedGame = 0.0;
    #timeDeltaGame = 0.0;
    //
    #timeScale = 1.0;
    //
    #isPaused = false;
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
    }
    methodUpdate(timeElapsed, timeDelta)
    {
    }
    methodDispose()
    {
    }
    // #endregion lifecycle

    // #region setters
    methodSetTime(timeElapsed, timeDelta)
    {
        //
        this.#timeElapsed = timeElapsed;

        //
        this.#timeDelta = Math.min(timeDelta, this.#timeDeltaMax);

        //
        this.#timeDeltaGame = this.#isPaused ? 0.0 : (this.#timeDelta * this.#timeScale);
        this.#timeElapsedGame += this.#timeDeltaGame;
    }
    methodUpdateTime(timeElapsed, timeDelta){this.methodSetTime(timeElapsed, timeDelta);}
    methodSetTimeScale(timeScale) { this.#timeScale = Math.max(0.0, timeScale); }

    methodSetIsPaused(isPaused) { this.#isPaused = isPaused; }
    methodPause() { this.methodSetIsPaused(true); }
    methodUnpause() { this.methodSetIsPaused(false); }
    methodTogglePause() { this.methodSetIsPaused(!this.#isPaused); }
    // #endregion setters

    // #region public methods : ?
    methodPrint()
    {
        const logObject = {};
        logObject["isPaused"] = this.#isPaused;
        logObject["timeElapsed"] = this.#timeElapsed;
        logObject["timeDelta"] = this.#timeDelta;
        logObject["timeElapsedGame"] = this.#timeElapsedGame;
        logObject["timeDeltaGame"] = this.#timeDeltaGame;
        logObject["timeScale"] = this.#timeScale;
        console.log(logObject);
    }
    // #endregion public methods : ?

    // #region getters
    methodGetTimeElapsed(){return this.#timeElapsed;}
    methodGetTimeDelta(){return this.#timeDelta;}
    methodGetTimeElapsedGame(){return this.#timeElapsedGame;}
    methodGetTimeDeltaGame(){return this.#timeDeltaGame;}

    methodGetTimeScale(){return this.#timeScale;}
    methodGetIsPaused(){return this.#isPaused;}
    // #endregion getters
}