// ECS architecture
// https://keep.google.com/u/0/#NOTE/1VZcHow6i1CL34hbKCEnhdlomP1MtBxrzssvUT4wwMWJLCXrubqAjogXsTz7MCC4

// should not be used on its own
// this class should always be extended from
// unlike entity, which instances are created from the base class every time

export class EntityComponent
{
    #params = null;
    #parent = null;

    #toBeDeleted = false;

    constructor()
    {
        //
        //super(params);
        this.#parent = null;
    }

    // #region getters

    methodGetEntityByName(paramName)
    {
        return this.#parent.methodGetEntityByName(paramName);
    }
    methodGetEntitiesWithComponent(paramComponentName, paramEntityNameToExclude)
    {
        return this.#parent.methodGetEntitiesWithComponent(paramComponentName, paramEntityNameToExclude);
    }
    methodGetComponent(paramComponentName)
    {
        return this.#parent.methodGetComponent(paramComponentName);
    }
    methodGetParent(){return this.#parent;}

    // Spawn/remove whole entities at runtime, forwarded through this
    // component's Entity (this.#parent) to the EntityManager. Used by
    // EntityComponentWorldGenerator to build the world on confirm and tear it
    // down on return-to-menu; components could only look entities up before,
    // never add/remove them. Create the Entity, add it (optionally named),
    // then attach components to the reference you created.
    methodAddEntity(paramEntity, paramEntityName)
    {
        return this.#parent.methodAddEntity(paramEntity, paramEntityName);
    }
    methodRemoveEntity(paramEntity)
    {
        return this.#parent.methodRemoveEntity(paramEntity);
    }

    // #region getters : shorthand : SingletonContextEngine
    methodGetScene()
    {
        return this.methodGetCachedContextEngine()?.methodGetScene();
    }
    methodGetSceneHUD()
    {
        return this.methodGetCachedContextEngine()?.methodGetSceneHUD();
    }
    methodGetRenderer()
    {
        return this.methodGetCachedContextEngine()?.methodGetRenderer();
    }
    methodGetCamera()
    {
        return this.methodGetCachedContextEngine()?.methodGetCamera();
    }
    methodGetCameraPivot()
    {
        return this.methodGetCachedContextEngine()?.methodGetCameraPivot();
    }
    methodGetCameraHUD()
    {
        return this.methodGetCachedContextEngine()?.methodGetCameraHUD();
    }
    // #endregion getters : shorthand : SingletonContextEngine

    // #region component instance cache
    #componentInstanceEngine = null;
    methodGetCachedContextEngine()
    {
        if(this.#componentInstanceEngine == null)
        {
            this.#componentInstanceEngine =
                this.methodGetEntityByName("SingletonContextEngine")
                    ?.methodGetComponent("EntityComponentSingletonContextEngine");
        }
        return this.#componentInstanceEngine;
    }
    #componentInstanceTime = null;
    methodGetCachedContextTime()
    {
        if(this.#componentInstanceTime == null)
        {
            this.#componentInstanceTime =
                this.methodGetEntityByName("SingletonContextTime")
                    ?.methodGetComponent("EntityComponentSingletonContextTime");
        }
        return this.#componentInstanceTime;
    }
    // #endregion component instance cache

    // #region getters : shorthand : SingletonContextTime
    methodGetTimeElapsed(){return this.methodGetCachedContextTime()?.methodGetTimeElapsed();}
    methodGetTimeDelta(){return this.methodGetCachedContextTime()?.methodGetTimeDelta();}
    methodGetTimeElapsedGame(){return this.methodGetCachedContextTime()?.methodGetTimeElapsedGame();}
    methodGetTimeDeltaGame(){return this.methodGetCachedContextTime()?.methodGetTimeDeltaGame();}
    // #endregion getters : shorthand : SingletonContextTime

    // #region getters : delegate to parent

    methodGetName(){return this.#parent.methodGetName();}
    methodGetPosition(){return this.#parent.methodGetPosition();}
    methodGetDirUp(){return this.#parent.methodGetDirUp();}
    methodGetDirFacing(){return this.#parent.methodGetDirFacing();}

    // #endregion getters : delegate to parent

    //
    methodGetIsFlaggedForDeletion()
    {
        return this.#toBeDeleted;
    }
    methodGetIsThisOrParentFlaggedForDeletion()
    {
        if(this.#toBeDeleted){return true;}
        return this.#parent.methodGetIsFlaggedForDeletion();
    }
    // #endregion getters

    // #region setters

    methodSetParent(paramParent){this.#parent = paramParent;}

    // setters, but actually for the parent

    methodSetPosition(paramPosition) { this.#parent.methodSetPosition(paramPosition); }
    methodSetDirUp(paramDirUp) { this.#parent.methodSetDirUp(paramDirUp); }
    methodSetDirFacing(paramDirFacing) { this.#parent.methodSetDirFacing(paramDirFacing); }
    // outdated?
    methodSetRotations(paramRotationA, paramRotationADelta, paramRotationB, paramRotationBDelta)
    {
        this.#parent.methodSetRotations(paramRotationA, paramRotationADelta, paramRotationB, paramRotationBDelta);
    }

    //
    methodFlagForDeletion()
    {
        this.#toBeDeleted = true;
    }
    // #endregion setters

    // #region registers
    methodRegisterMessageHandlerWithinEntity(paramInvokableHandlerName, paramInvokableHandlerValue)
    {
        this.#parent.methodRegisterMessageHandlerWithinEntity(paramInvokableHandlerName, paramInvokableHandlerValue);
    }
    // #endregion registers

    // #region lifecycle
    methodInitialize()
    {
        //console.log("entity component initialized: base class");
    }
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose() {}
    // #endregion lifecycle

    // #region broadcasting
    methodSendMessageWithinEntity(paramMessage)
    {
        this.#parent.methodSendMessageWithinEntity(paramMessage);
    }
    methodSendMessageToEntitiesWithComponent(paramComponentName, paramMessage, paramEntityNameToExclude)
    {
        this.#parent.methodSendMessageToEntitiesWithComponent(paramComponentName, paramMessage, paramEntityNameToExclude);
    }
    // #endregion broadcasting
}
