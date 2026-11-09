// ECS
import { EntityComponent } from "../../classes/ECS/entity_component.js";
//
import { EnumStateGravity } from "../../classes/enums.js";

export class EntityComponentDebugSnapshot extends EntityComponent
{
    // #region privates
    // lazy
    #hasOnLazyLoadInit = false;
    //
    #eventListenerHandlerOnKeyDown = null;
    //
    #componentInstancePlanetFaces = null;
    #componentInstanceGravity = null;
    #componentInstanceVelocity = null;
    #componentInstanceCamera = null;
    //
    #planet = null;
    //
    #consoleStringResult = null;
    #consoleObjectResult = null;
    //
    #windowFunctionDebugSnapshot = null;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        //
        super(params);

        // reminder that params.planet is just a $ref
        if(params.planet != null){this.#planet = params.planet;}
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize()
    {
        if(!import.meta.env.DEV){return;}

        // we need to store event listener handlers...
        // ...in order to be able to dispose of them
        this.#eventListenerHandlerOnKeyDown = (e) => this.methodOnKeyDown(e);

        //
        document.addEventListener('keydown', this.#eventListenerHandlerOnKeyDown, false);

        // store, so that we can dispose later
        this.#windowFunctionDebugSnapshot = () => this.methodOnKeyPrint();

        // this lets us invoke the function from the browser console
        window.debugSnapshot = this.#windowFunctionDebugSnapshot;

        //
        this.#consoleStringResult = "";
    }
    methodUpdate()
    {
        // #region lazy
        this.#methodOnLazyLoadInit();
        if(!this.#hasOnLazyLoadInit){return;}
        // #endregion lazy
    }
    methodDispose()
    {
        // for event listeners on document/window, we need to store the function reference beforehand...
        // ...so that we can remove exactly that function instance...
        // ...whereas => or .bind(this) will erroneously create a NEW function instance
        document.removeEventListener('keydown', this.#eventListenerHandlerOnKeyDown, false);

        //
        if(window.debugSnapshot === this.#windowFunctionDebugSnapshot)
        {
            delete window.debugSnapshot;
        }
    }
    // #endregion lifecycle

    // #region lazy
    #methodOnLazyLoadInit()
    {
        // #region lazy early return
        if(this.#hasOnLazyLoadInit){return;}
        // #endregion lazy early return

        // #region resolve
        // reminder that this.#planetResolved is actually the component ...PlanetFaces
        const isPlanetResolvedAndReady = this.#methodResolvePlanet();
        if(isPlanetResolvedAndReady != true){return;}
        // #endregion resolve

        // #region dependent
        this.#componentInstanceGravity = this.methodGetComponent("EntityComponentGravity");
        if(this.#componentInstanceGravity == null){return;}
        this.#componentInstanceVelocity = this.methodGetComponent("EntityComponentVelocity");
        if(this.#componentInstanceVelocity == null){return;}
        this.#componentInstanceCamera = this.methodGetComponent("EntityComponentCameraControllerFirstPerson");
        if(this.#componentInstanceCamera == null){return;}
        // #endregion dependent

        // #region independent
        // #endregion independent

        // #region spawn
        // #endregion spawn

        // #region lazy end
        this.#hasOnLazyLoadInit = true;
        // #endregion lazy end
    }
    #methodResolvePlanet()
    {
        // this.#planet is set by the constructor params

        // #region early return
        if(this.#planet == null){return;}
        if(this.#planet["$ref"] == null){return;}
        // #endregion early return

        // we have ourselves a param of the special type $ref
        // we use this to find the planet we belong to

        // 
        this.#componentInstancePlanetFaces = this.methodGetEntityByName(this.#planet["$ref"]["entity"])?.methodGetComponent(this.#planet["$ref"]["component"]);

        // #region early return
        if(this.#componentInstancePlanetFaces == null){return;}
        if(!this.#componentInstancePlanetFaces.methodGetIsReady()){console.log("we resolved the planet, but the planet itself hasn't parsed its triangles yet");return;}
        // #endregion early return

        return true;
    }
    // #endregion lazy

    // #region event listener handlers
    methodOnKeyDown(e)
    {
        switch (e.keyCode)
        {
            case 80: // letter p
                this.methodOnKeyPrint();
                //e.preventDefault();
                break;
            case 77: // letter m
                this.methodOnKeyCycleModeDirUpTransition();
                //e.preventDefault();
                break;
        }
    }
    // #endregion event listener handlers

    // #region event handlers
    methodOnKeyCycleModeDirUpTransition()
    {
        // early return
        if(!this.#hasOnLazyLoadInit){return;}

        //
        const returnValueMode = this.#componentInstanceCamera.methodCycleModeDirUpTransition();
    }
    methodOnKeyPrint()
    {
        // early return
        if(!this.#hasOnLazyLoadInit){return;}

        //
        this.methodComposeConsoleLog();
        this.methodConsoleLog();

        // we need to return the variable as well
        return this.#consoleObjectResult;
    }
    // #endregion event handlers

    // #region a
    methodComposeConsoleLog()
    {
        // reset
        this.#consoleObjectResult = {};
        
        // #region consts
        const currentPosition = this
            .methodGetPosition()
                .clone();

        const gravityState = this.#componentInstanceGravity
            .methodGetState();

        const planetCenter = this.#componentInstancePlanetFaces
            .methodGetPlanetCenter();

        const planetRadius = this.#componentInstancePlanetFaces
            .methodGetPlanetRadius();

        const planetInradius = this.#componentInstancePlanetFaces
            .methodGetPlanetInradius();

        const currentFaceIndex = this.#componentInstanceGravity
            .methodGetFaceIndex();
            
        const nearestFaceIndex = this.#componentInstancePlanetFaces
            .methodGetNearestFaceWithIndex(currentFaceIndex, currentPosition, planetCenter);

        const mostAlignedFaceIndex = this.#componentInstancePlanetFaces
            .methodGetMostAlignedFace(currentPosition, planetCenter);

        const dirUpGravity = this.#componentInstanceGravity
            .methodGetDirUpFromGravity()
                .clone();

        const dirUpEntity = this
            .methodGetDirUp()
                .clone();

        const dirUpVisual = this.#componentInstanceCamera
            .methodGetVisualDirUp()
                .clone();

        const cameraYaw = this.#componentInstanceCamera
            .methodGetYaw()
                .clone();

        const velocity = this.#componentInstanceVelocity
            .methodGetVelocity()
                .clone();

        const dotEntityVSGravity = dirUpEntity.dot(dirUpGravity);
        const dotVisualVSGravity = dirUpVisual.dot(dirUpGravity);
        // #endregion consts

        // #region add fields
        this.#consoleObjectResult["_0_gravityState"] =
            gravityState;

        if(gravityState == EnumStateGravity.Falling)
        {
            this.#consoleObjectResult["_0_gravityStateFallingSubstate"] =
                this.#componentInstanceGravity
                    .methodGetSubstateFalling();
        }

        this.#consoleObjectResult["_0_modeDirUpTransition"] =
            this.#componentInstanceCamera
                .methodGetModeDirUpTransition()
        ;

        this.#consoleObjectResult["_1_currentPosition"] =
            this.methodVec3Rounding(
                currentPosition
            )
        ;

        this.#consoleObjectResult["_1_planetRadius"] =
            planetRadius
                .toFixed(2)
        ;

        this.#consoleObjectResult["_1_planetInradius"] =
            planetInradius
                .toFixed(2)
        ;

        this.#consoleObjectResult["_1_distanceToPlanetCenter"] =
             this.#componentInstancePlanetFaces
                .methodGetDistanceToPlanetCenter(currentPosition)
                    .toFixed(2);

        this.#consoleObjectResult["_1_currentFaceIndex"] = currentFaceIndex;

        this.#consoleObjectResult["_1_distanceToPlanetFace"] =
             this.#componentInstancePlanetFaces
                .methodGetDistanceToPlanetFace(currentPosition, currentFaceIndex)
                    .toFixed(2);

        this.#consoleObjectResult["_1_isCurrentFaceWithinWalls"] =
            (
                this.#componentInstancePlanetFaces
                    .methodGetIsWithinWalls(currentPosition, currentFaceIndex)
            ? "Y" : "N")
        ;

        this.#consoleObjectResult["_1_isCurrentFaceAboveFloor"] =
            (    
                this.#componentInstancePlanetFaces
                    .methodGetIsAboveFloor(currentPosition, currentFaceIndex)
            ? "Y" : "N")
        ;

        if(currentFaceIndex != nearestFaceIndex)
        {
            this.#consoleObjectResult["_1_nearestFaceIndex"] = nearestFaceIndex;

            this.#consoleObjectResult["_1_distanceToPlanetFaceNearest"] =
                this.#componentInstancePlanetFaces
                    .methodGetDistanceToPlanetFace(currentPosition, nearestFaceIndex)
                        .toFixed(2);

            this.#consoleObjectResult["_1_isNearestFaceWithinWalls"] =
                (
                    this.#componentInstancePlanetFaces
                        .methodGetIsWithinWalls(currentPosition, nearestFaceIndex)
                ? "Y" : "N")
            ;

            this.#consoleObjectResult["_1_isNearestFaceAboveFloor"] =
                (
                    this.#componentInstancePlanetFaces
                        .methodGetIsAboveFloor(currentPosition, nearestFaceIndex)
                ? "Y" : "N")
            ;
        }

        if(nearestFaceIndex != mostAlignedFaceIndex)
        {
            this.#consoleObjectResult["_1_mostAlignedFaceIndex"] = mostAlignedFaceIndex;

            this.#consoleObjectResult["_1_distanceToPlanetFaceMostAligned"] =
                this.#componentInstancePlanetFaces
                    .methodGetDistanceToPlanetFace(currentPosition, mostAlignedFaceIndex)
                        .toFixed(2);

            this.#consoleObjectResult["_1_isMostAlignedFaceWithinWalls"] =
                (
                    this.#componentInstancePlanetFaces
                        .methodGetIsWithinWalls(currentPosition, mostAlignedFaceIndex)
                ? "Y" : "N")
            ;

            this.#consoleObjectResult["_1_isMostAlignedFaceAboveFloor"] =
                (
                    this.#componentInstancePlanetFaces
                        .methodGetIsAboveFloor(currentPosition, mostAlignedFaceIndex)
                ? "Y" : "N")
            ;
        }

        this.#consoleObjectResult["_2_dirUpGravity"] =
            this.methodVec3Rounding(
                dirUpGravity
            )
        ;

        this.#consoleObjectResult["_2_dirUpEntity"] =
            this.methodVec3Rounding(
                dirUpEntity
            )
        ;

        this.#consoleObjectResult["_2_dirUpVisual"] =
            this.methodVec3Rounding(
                dirUpVisual
            )
        ;

        this.#consoleObjectResult["_2_dotEntityVSGravity"] =
            dotEntityVSGravity.toFixed(2)
        ;
        
        if(dotEntityVSGravity <= 0.9)
        {
            this.#consoleObjectResult["_2_dotEntityVSGravityWarning"] = "dotEntityVSGravity too far off!";
        }

        this.#consoleObjectResult["_2_dotVisualVSGravity"] =
            dotVisualVSGravity.toFixed(2)
        ;
        
        if(dotVisualVSGravity <= 0.9)
        {
            this.#consoleObjectResult["_2_dotVisualVSGravityWarning"] = "dotVisualVSGravity too far off!";
        }

        this.#consoleObjectResult["_2_transitionRemainingAngles"] =
            this.#componentInstanceCamera
                .methodGetTransitionRemainingAngle()
                    .toFixed(2);

        this.#consoleObjectResult["_3_cameraPitch"] =
            this.#componentInstanceCamera
                .methodGetPitch()
                    .toFixed(2);

        this.#consoleObjectResult["_3_cameraYaw"] =
            this.methodVec3Rounding(
                cameraYaw
            )
        ;

        this.#consoleObjectResult["_3_velocity"] =
            this.methodVec3Rounding(
                velocity
            )
        ;

        this.#consoleObjectResult["_3_velocityScalarAlongUp"] =
            this.#componentInstanceVelocity
                .methodGetVelocityAlongAxisScalar(dirUpGravity)
                    .toFixed(2)
        ;

        this.#consoleObjectResult["_3_velocityAlongUp"] =
            this.methodVec3Rounding(
                this.#componentInstanceVelocity
                    .methodGetVelocityAlongAxis(dirUpGravity)
            )
        ;

        this.#consoleObjectResult["_3_velocityAcrossUp"] =
            this.methodVec3Rounding(
                this.#componentInstanceVelocity
                    .methodGetVelocityAcrossAxis(dirUpGravity)
            )
        ;
        // #endregion add fields
    }
    methodVec3Rounding(vec3)
    {
        const res = vec3.clone();
        res.x = Number(res.x.toFixed(2));
        res.y = Number(res.y.toFixed(2));
        res.z = Number(res.z.toFixed(2));
        return res;
    }
    methodComposeConsoleLogOLD()
    {
        // reset the message
        this.#consoleStringResult = "";

        //
        const currentPosition = this
            .methodGetPosition().clone();
        this.#consoleStringResult += "\n\tposition : " + this.methodVec3ToString(currentPosition);

        //
        const currentGravityState = this.#componentInstanceGravity
            .methodGetState();
        this.#consoleStringResult += "\n\tcurrent gravity state : \n\t\t" + currentGravityState;

        //
        const distanceToPlanetCenter = this.#componentInstancePlanetFaces
                .methodGetDistanceToPlanetCenter(currentPosition);
        this.#consoleStringResult += "\n\tdistance to planet center : \n\t\t" + distanceToPlanetCenter.toFixed(2);

        //
        const currentFaceIndex = this.#componentInstanceGravity
            .methodGetFaceIndex();
        this.#consoleStringResult += "\n\tcurrent face index : \n\t\t" + currentFaceIndex;

        //
        const distanceToPlanetFace = this.#componentInstancePlanetFaces
                .methodGetDistanceToPlanetFace(currentPosition, currentFaceIndex);
        this.#consoleStringResult += "\n\tdistance to current planet face : \n\t\t" + distanceToPlanetFace.toFixed(2);
        
        //
        const isCurrentFaceWithinWalls = this.#componentInstancePlanetFaces
                .methodGetIsWithinWalls(currentPosition, currentFaceIndex);
        this.#consoleStringResult += "\n\tis within walls of current planet face : \n\t\t" + (isCurrentFaceWithinWalls ? "Y" : "N");
        
        //
        const isCurrentFaceAboveFloor = this.#componentInstancePlanetFaces
                .methodGetIsAboveFloor(currentPosition, currentFaceIndex);
        this.#consoleStringResult += "\n\tis above floor of current planet face : \n\t\t" + (isCurrentFaceAboveFloor ? "Y" : "N");

        //
        const nearestFaceIndex = this.#componentInstanceGravity
            .methodGetNearestFaceIndex();

        //
        if(currentFaceIndex != nearestFaceIndex)
        {
            //
            this.#consoleStringResult += "\n\tnearest face index : \n\t\t" + nearestFaceIndex;

            //
            const distanceToPlanetFaceNearest = this.#componentInstancePlanetFaces
                    .methodGetDistanceToPlanetFace(currentPosition, nearestFaceIndex);
            this.#consoleStringResult += "\n\tdistance to nearest planet face : \n\t\t" + distanceToPlanetFaceNearest.toFixed(2);
        
            //
            const isNearestFaceWithinWalls = this.#componentInstancePlanetFaces
                    .methodGetIsWithinWalls(currentPosition, nearestFaceIndex);
            this.#consoleStringResult += "\n\tis within walls of nearest planet face : \n\t\t" + (isNearestFaceWithinWalls ? "Y" : "N");
            
            //
            const isNearestFaceAboveFloor = this.#componentInstancePlanetFaces
                    .methodGetIsAboveFloor(currentPosition, nearestFaceIndex);
            this.#consoleStringResult += "\n\tis above floor of nearest planet face : \n\t\t" + (isNearestFaceAboveFloor ? "Y" : "N");
        }

        //
        const dirUpGravity = this.#componentInstanceGravity
                .methodGetDirUpFromGravity();
        this.#consoleStringResult += "\n\tgravity dir up : " + this.methodVec3ToString(dirUpGravity);

        //
        const dirUpEntity = this
                .methodGetDirUp();
        this.#consoleStringResult += "\n\tentity dir up : " + this.methodVec3ToString(dirUpEntity);

        //
        const dirUpVisual = this
                .methodGetVisualDirUp();
        this.#consoleStringResult += "\n\visual dir up : " + this.methodVec3ToString(dirUpVisual);

        //
        const transitionRemainingAngles = this.#componentInstanceCamera
            .methodGetTransitionRemainingAngle();
        this.#consoleStringResult += "\n\ttransition remaining angles : \n\t\t" + transitionRemainingAngles.toFixed(2);

        //
        const cameraPitch = this.#componentInstanceCamera
            .methodGetPitch();
        this.#consoleStringResult += "\n\tcamera pitch : \n\t\t" + cameraPitch.toFixed(2);

        //
        const cameraYaw = this.#componentInstanceCamera
            .methodGetYaw();
        this.#consoleStringResult += "\n\tcamera yaw : " + this.methodVec3ToString(cameraYaw);

        //
        const velocity = this.#componentInstanceVelocity
                .methodGetVelocity();
        this.#consoleStringResult += "\n\tvelocity : " + this.methodVec3ToString(velocity);

        //
        const velocityAlongUp = this.#componentInstanceVelocity
                .methodGetVelocityAlongAxis(dirUpGravity);
        this.#consoleStringResult += "\n\tvelocity along up : " + this.methodVec3ToString(velocityAlongUp);

        //
        const velocityAcrossUp = this.#componentInstanceVelocity
                .methodGetVelocityAcrossAxis(dirUpGravity);
        this.#consoleStringResult += "\n\tvelocity across up : " + this.methodVec3ToString(velocityAcrossUp);

    }
    methodVec3ToString(vec3)
    {
        return "\n\t\t.x\t" + vec3.x.toFixed(2) + "\n\t\t.y\t" + vec3.y.toFixed(2) + "\n\t\t.z\t" + vec3.z.toFixed(2) + "";
    }
    methodConsoleLog()
    {
        //
        console.log(this.#consoleObjectResult);

        //
        console.log("[SNAPSHOT]", JSON.stringify(this.#consoleObjectResult));
    }
    // #endregion a
}