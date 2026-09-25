import * as THREE from "three";
import {EntityComponent} from "../../classes/ECS/entity_component.js";
/*
import {debugOverlaySetLine} from "./temp_debug_overlay.js"; // TEMPORARY - see that file's header comment
*/

// Double-tap timing/distance thresholds, and the max time+movement a touch
// can have and still count as a single "tap" rather than a drag/long-press -
// module-level since they're plain constants, not per-instance state.
// Seconds, not milliseconds - EntityComponentPlayerControllerInputTouch
// measures elapsed time via methodUpdate()'s own timeDelta (the ECS's
// per-frame clock, in seconds), not performance.now() - see
// INPUT_METHODS.md's "Timing source for gesture detection" section.
const DOUBLE_TAP_MAX_INTERVAL_SECONDS = 0.3;
const DOUBLE_TAP_MAX_DISTANCE_PX = 40;
const TAP_MAX_DURATION_SECONDS = 0.25;
const TAP_MAX_MOVEMENT_PX = 20;

export class EntityComponentPlayerControllerInput extends EntityComponent
{
    #params = null;
    #keys = null;
    constructor(params)
    {
        super(params);
        this.#params = params;
    }
    get keys() {return this.#keys;}
    methodInitialize()
    {
        this.#keys =
        {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
            jump: false,
        };
        document.addEventListener('keydown', (e) => this.methodEventOnKeyDown(e), false);
        document.addEventListener('keyup', (e) => this.methodEventOnKeyUp(e), false);
    }
    methodEventOnKeyDown(e)
    {
        switch (e.keyCode)
        {
            case 81: // letter q
                this.#keys.up = true;
                break;
            case 87: // letter w
                this.#keys.forward = true;
                break;
            case 65: // letter a
                this.#keys.left = true;
                break;
            case 69: // letter e
                this.#keys.down = true;
                break;
            case 83: // letter s
                this.#keys.backward = true;
                break;
            case 68: // letter d
                this.#keys.right = true;
                break;
            case 32: // spacebar
                this.#keys.jump = true;
                break;
        }
    }
    methodEventOnKeyUp(e)
    {
        switch (e.keyCode)
        {
            case 81: // letter q
                this.#keys.up = false;
                break;
            case 87: // letter w
                this.#keys.forward = false;
                break;
            case 69: // letter e
                this.#keys.down = false;
                break;
            case 65: // letter a
                this.#keys.left = false;
                break;
            case 83: // letter s
                this.#keys.backward = false;
                break;
            case 68: // letter d
                this.#keys.right = false;
                break;
            case 32: // spacebar
                this.#keys.jump = false;
                break;
        }
    }
}

// Touch equivalent of EntityComponentPlayerControllerInput - only forward
// movement has a touch gesture so far: double-tap-and-hold. The second tap
// of a double-tap starts walking forward, which continues for as long as
// that same finger (tracked by touch identifier, not e.touches[0] - an
// unrelated second finger touching down/lifting shouldn't affect this)
// stays on the screen, regardless of whether it moves -
// EntityComponentCameraControllerFirstPersonInputTouch keeps driving
// camera-look from the same touch independently, via its own touchmove
// listener, so aiming while walking isn't paused. backward/left/right/up/down
// have no touch equivalent yet and stay permanently false;
// EntityComponentPlayerController still reads them unconditionally, so the
// fields have to exist regardless.
export class EntityComponentPlayerControllerInputTouch extends EntityComponent
{
    #params = null;
    #keys = null;

    // Tracks whichever touch is currently a candidate for being "tap 1" of
    // a future double-tap. #candidateElapsedSeconds accumulates via
    // methodUpdate()'s timeDelta while that touch hasn't ended yet.
    #candidateTouchIdentifier = null;
    #candidateStartX = null;
    #candidateStartY = null;
    #candidateElapsedSeconds = 0;

    // The most recently completed tap, matched against the NEXT touchstart
    // to detect a double-tap. null whenever no completed tap is currently
    // waiting for a possible second tap - either because none has happened
    // yet, or because methodUpdate() already expired the window.
    #pendingTapElapsedSeconds = null;
    #pendingTapX = null;
    #pendingTapY = null;

    // Whichever touch is currently driving forward movement (the second tap
    // of a double-tap) - null when not walking.
    #walkingTouchIdentifier = null;

    constructor(params)
    {
        super(params);
        this.#params = params;
    }
    get keys() {return this.#keys;}
    methodInitialize()
    {
        this.#keys =
        {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
        };

        // document only, not also window - see
        // EntityComponentCameraControllerFirstPersonInputTouch's own comment
        // on this: this class also computes state by tracking/diffing
        // across events rather than reading something the browser
        // pre-computes per event, so double-registering risks the same kind
        // of silent corruption caught there.
        //
        // {passive: false} on touchstart so methodEventOnTouchStart() below
        // can call e.preventDefault() - see that method's own comment for
        // why (a held, stationary touch arms the browser's own long-press
        // gesture on a timer, which this needs to preempt before it fires).
        document.addEventListener('touchstart', (e) => this.methodEventOnTouchStart(e), {passive: false});
        document.addEventListener('touchend', (e) => this.methodEventOnTouchEnd(e));
        document.addEventListener('touchcancel', (e) => this.methodEventOnTouchEnd(e));
    }

    methodUpdate(timeElapsed, timeDelta)
    {
        // Advances the tap-timing accumulators using the ECS's own
        // per-frame clock instead of an independent performance.now()
        // sample - see INPUT_METHODS.md's "Timing source for gesture
        // detection" section for why (one clock source for "how much time
        // has passed" everywhere, at the cost of up to ~1 frame of slop,
        // negligible against thresholds measured in hundreds of ms).
        if(this.#candidateTouchIdentifier != null)
        {
            this.#candidateElapsedSeconds += timeDelta;
        }
        if(this.#pendingTapElapsedSeconds != null)
        {
            this.#pendingTapElapsedSeconds += timeDelta;
            if(this.#pendingTapElapsedSeconds > DOUBLE_TAP_MAX_INTERVAL_SECONDS)
            {
                this.#pendingTapElapsedSeconds = null; // window expired
            }
        }
    }

    methodEventOnTouchStart(e)
    {
        // Must preventDefault() here - see
        // EntityComponentCameraControllerFirstPersonInputTouch.methodEventOnTouchStart()'s
        // comment for why a held touch needs this called up front, before
        // the browser's own long-press gesture timer gets a chance to fire
        // and start silently swallowing this touch's events (exactly the
        // "double-tap-and-hold to walk" gesture this class implements).
        e.preventDefault();

        for(const touch of e.changedTouches)
        {
            this.methodHandleNewTouch(touch);
        }
    }

    methodHandleNewTouch(touch)
    {
        // Is this the second tap of a double-tap? If so, start walking -
        // and don't also track it as a fresh tap candidate below, since
        // it's already been consumed as the second half of a pair. The
        // time-window check already happened in methodUpdate() above
        // (which nulls #pendingTapElapsedSeconds out once it's too old),
        // so only distance needs checking here.
        if(this.#pendingTapElapsedSeconds != null)
        {
            const distanceFromPendingTap = Math.hypot(touch.clientX - this.#pendingTapX, touch.clientY - this.#pendingTapY);
            if(distanceFromPendingTap <= DOUBLE_TAP_MAX_DISTANCE_PX)
            {
                this.#walkingTouchIdentifier = touch.identifier;
                this.#keys.forward = true;
                this.#pendingTapElapsedSeconds = null;
                //debugOverlaySetLine("player", `WALKING START id=${touch.identifier}`); // TEMPORARY
                return;
            }
        }

        this.#candidateTouchIdentifier = touch.identifier;
        this.#candidateStartX = touch.clientX;
        this.#candidateStartY = touch.clientY;
        this.#candidateElapsedSeconds = 0;
        //debugOverlaySetLine("player", `tap candidate id=${touch.identifier} walking=${this.#walkingTouchIdentifier}`); // TEMPORARY
    }

    methodEventOnTouchEnd(e)
    {
        for(const touch of e.changedTouches)
        {
            this.methodHandleTouchEnd(touch);
        }
    }

    methodHandleTouchEnd(touch)
    {
        // Stop walking only when the SPECIFIC touch driving it lifts - an
        // unrelated second finger lifting shouldn't stop movement, and this
        // same touch may have moved a lot by now (aiming the camera while
        // walking), which is expected and doesn't disqualify it.
        if(this.#walkingTouchIdentifier === touch.identifier)
        {
            this.#walkingTouchIdentifier = null;
            this.#keys.forward = false;
            //debugOverlaySetLine("player", `WALKING STOP id=${touch.identifier}`); // TEMPORARY
            return; // a touch that just drove walking isn't itself a tap candidate
        }

        if(this.#candidateTouchIdentifier !== touch.identifier){debugOverlaySetLine("player", `touchend id=${touch.identifier} (not tracked)`); return;} // TEMPORARY
        const candidateElapsedSeconds = this.#candidateElapsedSeconds;
        this.#candidateTouchIdentifier = null;

        // Only counts as a completed tap - and therefore a candidate "tap 1"
        // for a future double-tap - if it was quick and didn't move much;
        // otherwise it was a drag/long-press, not a tap.
        const distanceFromStart = Math.hypot(touch.clientX - this.#candidateStartX, touch.clientY - this.#candidateStartY);
        //if(candidateElapsedSeconds > TAP_MAX_DURATION_SECONDS || distanceFromStart > TAP_MAX_MOVEMENT_PX){debugOverlaySetLine("player", `tap rejected (elapsed=${candidateElapsedSeconds.toFixed(2)}s dist=${distanceFromStart.toFixed(0)}px)`); return;} // TEMPORARY

        this.#pendingTapElapsedSeconds = 0;
        this.#pendingTapX = touch.clientX;
        this.#pendingTapY = touch.clientY;
        //debugOverlaySetLine("player", `tap completed id=${touch.identifier}, waiting for 2nd`); // TEMPORARY
    }
}

export class EntityComponentPlayerController extends EntityComponent
{
    // #region privates
    #params = null;
    #keys = null;
    // #region privates

    // lazy
    #hasOnLazyLoadInit = false;

    // #region unresolved privates
    #cameraPivot = null;
    // #endregion unresolved privates

    // #region component instances : lazy loaded
    #componentInstanceInput = null;
    #componentInstanceCameraControllerFirstPerson = null;
    #componentInstanceGravity = null;
    #componentInstanceVelocity = null;
    // #endregion component instances : lazy loaded

    constructor(params)
    {
        super(params);
        this.#params = params;
    }

    // #region lifecycle

    methodInitialize()
    {
        // Self-attaches its own Input sibling instead of receiving it from
        // main.js - same "Pattern C" as
        // EntityComponentCameraControllerFirstPerson (see
        // BARE_MINIMUM_THREEJS_EXCEPTION_OR_NOT.md's "Pattern C:
        // self-attaching sibling components" section). Which concrete class
        // gets attached depends on EntityComponentSingletonContextEnvironment's
        // touch-primary detection, but main.js never needs to know that.
        const componentEnvironment = this.methodGetEntityByName("SingletonContextEnvironment")?.methodGetComponent("EntityComponentSingletonContextEnvironment");
        const componentInput = componentEnvironment.methodGetIsTouchPrimary()
            ? new EntityComponentPlayerControllerInputTouch()
            : new EntityComponentPlayerControllerInput();
        this.methodGetParent().methodAddComponentWithName("EntityComponentPlayerControllerInput", componentInput);
    }

    methodUpdate()
    {
        // #region lazy
        this.#methodOnLazyLoadInit();
        if(!this.#hasOnLazyLoadInit){return;}
        // #endregion lazy


        // #region body

        // at this point, we have resolved:
        //  * the cameraPivot
        //  * the entity-component instance of first person camera
        //  * the entity-component instance of input
        //  * the entity-component instance of velocity
        //  * the entity-component instance of gravity

        // does input need to be refereshed each frame???
        //this.#componentInstanceInput = this.methodGetComponent("EntityComponentPlayerControllerInput");

        // a result variable
        // we modify this
        // and then .SetPosition in the end
        const positionResult = new THREE.Vector3();
        positionResult.copy(this.#cameraPivot.position);
        
        // we can use this index to determine if we should move in the first place
        // and also
        // the polarity
        var indexMovingOnForwardBackwardAxis = 0;
        if(this.#componentInstanceInput.keys.forward == true) {indexMovingOnForwardBackwardAxis = 1;}
        else if(this.#componentInstanceInput.keys.backward == true) {indexMovingOnForwardBackwardAxis = -1;}
        if(indexMovingOnForwardBackwardAxis != 0)
        {
            positionResult.addScaledVector(this.#componentInstanceCameraControllerFirstPerson.directionForwardNonvertical, 0.05 * indexMovingOnForwardBackwardAxis);
            //this.#cameraPivot.position.addScaledVector(componentInstanceCameraControllerFirstPerson.directionForwardNonvertical, 0.05 * indexMovingOnForwardBackwardAxis);
        }



        // we can use this index to determine if we should move in the first place
        // and also
        // the polarity
        var indexMovingOnLeftRightAxis = 0;
        if(this.#componentInstanceInput.keys.left == true) {indexMovingOnLeftRightAxis = 1;}
        else if(this.#componentInstanceInput.keys.right == true) {indexMovingOnLeftRightAxis = -1;}
        if(indexMovingOnLeftRightAxis != 0)
        {
            positionResult.addScaledVector(this.#componentInstanceCameraControllerFirstPerson.directionRightNonvertical, 0.05 * indexMovingOnLeftRightAxis);
            //this.#cameraPivot.position.addScaledVector(componentInstanceCameraControllerFirstPerson.directionRightNonvertical, 0.05 * indexMovingOnLeftRightAxis);
        }

        //
        if(this.#componentInstanceInput.keys.up == true)
        {
            positionResult.addScaledVector(this.methodGetDirUp(), 0.05);
            // outdated : we don't want to travel straight up anymore
            // we want to travel in the CURRENT up direction, which is able to change
            //positionResult.y += 0.05;
        }
        else if(this.#componentInstanceInput.keys.down == true)
        {
            positionResult.addScaledVector(this.methodGetDirUp(), -0.05);
            // outdated : we don't want to travel straight up anymore
            // we want to travel in the CURRENT up direction, which is able to change
            //positionResult.y -= 0.05;
        }

        //
        if(this.#componentInstanceInput.keys.jump == true)
        {
            this.methodExecuteActionJump();
        }

        // if we are currently jumping
        // we need to eventually transition to falling
        this.methodShouldJumpingTransitionToFalling();

        // early return: we don't do anything if we don't have anything
        const isSameX = (this.#cameraPivot.position.x == positionResult.x);
        const isSameY = (this.#cameraPivot.position.y == positionResult.y);
        const isSameZ = (this.#cameraPivot.position.z == positionResult.z);
        if (isSameX && isSameY && isSameZ) { return; }

        // we simply set the position once, at the end
        // this radiates to all entity_components that has registered that event
        this.methodSetPosition(positionResult);


        // #endregion body

    }

    // #endregion lifecycle

    methodExecuteActionJump()
    {
        // we need the gravity 
        if(this.#componentInstanceGravity == null){return;}

        // if we are not in the landed state
        // we cannot jump
        if(this.#componentInstanceGravity.methodGetState() != "Landed"){return;}

        // we also need the velocity component
        if(this.#componentInstanceVelocity == null){return;}

        // get planet face's up-direction first
        const dir = this.#componentInstanceGravity.methodGetCurrentFaceNormal().clone();
        // we first nullify velocity on the gravity "axis"
        this.#componentInstanceVelocity.methodNullifyGravity(
            dir
        );

        // we now change state
        // this should avoid some jank with gravity trying to pull us down
        this.#componentInstanceGravity.methodTransitionTo("Jumping");

        // we scale the direction by our intended speed
        const scaledDir = dir.multiplyScalar(100.0);
        // then we apply upwards speed, along the gravity "axis"
        this.#componentInstanceVelocity.methodAddToVelocity(scaledDir.x, scaledDir.y, scaledDir.z);
    }

    //
    methodShouldJumpingTransitionToFalling()
    {
        //
        if(this.#componentInstanceGravity == null){return;}
        if(this.#componentInstanceGravity.methodGetState() != "Jumping"){return;}
        if(this.#componentInstanceVelocity == null){return;}

        // we get gravity "axis" direction
        const dir = this.#componentInstanceGravity.methodGetCurrentFaceNormal().clone();
        // we use it to check if our velocity along the axis is 0 or negative
        const isGravityAxisVelocityZeroOrNeg = this.#componentInstanceVelocity.methodGetIsVelocityAlongAxisZeroOrNegative(dir);
        // we double-check that we are in the right state, too
        if(this.#componentInstanceGravity.methodGetState() == "Jumping" && isGravityAxisVelocityZeroOrNeg)
        {
            // if so
            // change state to falling again
            this.#componentInstanceGravity.methodTransitionTo("Falling");
        }
    }

    // #region resolve methods
    #methodOnLazyLoadInit()
    {
        // #region lazy
        if(this.#hasOnLazyLoadInit){return;}
        // #endregion lazy

        // #region body

        // we know that SingletonContextEngine exists
        // and that cameraPivot is in there
        // so we can get it from there

        // this "bubbles" up to the parent method in the base class EntityComponent in entity_component.js
        // and the method there does the lookup of camera pivot via SingletonContextEngine for us
        // just a shorthand, basically
        this.#cameraPivot = this.methodGetCameraPivot();

        //
        this.#componentInstanceInput = this.methodGetComponent("EntityComponentPlayerControllerInput");
        if(this.#componentInstanceInput == null){return;}
        this.#componentInstanceCameraControllerFirstPerson = this.methodGetComponent("EntityComponentCameraControllerFirstPerson");
        if(this.#componentInstanceCameraControllerFirstPerson == null){return;}
        this.#componentInstanceGravity = this.methodGetComponent("EntityComponentGravity");
        if(this.#componentInstanceGravity == null){return;}
        this.#componentInstanceVelocity = this.methodGetComponent("EntityComponentVelocity");
        if(this.#componentInstanceVelocity == null){return;}

        // #endregion body

        // finally, we update the flag so that we don't have to do this again
        // must be at the very end
        this.#hasOnLazyLoadInit = true;
    }
    // #endregion resolve methods
}