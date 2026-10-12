import * as THREE from "three";
import {EntityComponent} from "../../classes/ECS/entity_component.js";
/*
import {debugOverlaySetLine} from "./temp_debug_overlay.js"; // TEMPORARY - see that file's header comment
*/

export class EntityComponentCameraControllerFirstPersonInputMK extends EntityComponent
{
    // #region privates
    #params = null;
    #keys = null;
    #mouseX = null;
    #mouseY = null;

    // we need to store event listener handlers...
    // ...in order to be able to dispose of them
    #eventListenerHandlerOnKeyDown;
    #eventListenerHandlerOnKeyUp;
    #eventListenerHandlerOnMouseMove;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        super(params);
        this.#params = params;
    }
    // #endregion construct

    // #region getters
    get keys() {return this.#keys;}
    get mouseX(){return this.#mouseX;}
    get mouseY(){return this.#mouseY;}
    // #endregion getters

    // #region lifecycle
    methodInitialize()
    {
        //
        this.#keys =
        {
            up: false,
            down: false,
            left: false,
            right: false,
            reset: false,
            updirection: false,
        };

        // we need to store event listener handlers...
        // ...in order to be able to dispose of them
        this.#eventListenerHandlerOnKeyDown = (e) => this.methodOnKeyDown(e)
        this.#eventListenerHandlerOnKeyUp = (e) => this.methodOnKeyUp(e);
        this.#eventListenerHandlerOnMouseMove = (e) => this.methodOnMouseMove(e);

        // attach those stored event listener handlers
        document.addEventListener('keydown', this.#eventListenerHandlerOnKeyDown, false);
        document.addEventListener('keyup', this.#eventListenerHandlerOnKeyUp, false);
        document.addEventListener('mousemove', this.#eventListenerHandlerOnMouseMove, false);

        // Redundant: keydown/keyup/mousemove all bubble from document up to
        // window, so the document listeners above already see every one of
        // these events - adding the same handler on window as well just
        // fires it a second time per event. Harmless for the boolean key
        // flags here (setting `true`/`false` twice is a no-op), but this is
        // exactly the double-registration anti-pattern GOTCHAS.md warns
        // about ("don't register the same listener on document AND window -
        // it double-fires and corrupts any value computed by diffing across
        // events"), which would bite methodOnMouseMove() if it ever moved
        // from reading e.movementX/e.movementY (browser-precomputed) to
        // computing its own delta by diffing across events. Left commented
        // out rather than deleted so the earlier "improve reliability in
        // production builds" reasoning stays visible if window-only focus
        // turns out to matter after all.
        //window.addEventListener('keydown', this.#eventListenerHandlerOnKeyDown, false);
        //window.addEventListener('keyup', this.#eventListenerHandlerOnKeyUp, false);
        //window.addEventListener('mousemove', this.#eventListenerHandlerOnMouseMove, false);
    }
    methodDispose()
    {
        // for event listeners on document/window, we need to store the function reference beforehand...
        // ...so that we can remove exactly that function instance...
        // ...whereas => or .bind(this) will erroneously create a NEW function instance

        document.removeEventListener('keydown', this.#eventListenerHandlerOnKeyDown, false);
        document.removeEventListener('keyup', this.#eventListenerHandlerOnKeyUp, false);
        document.removeEventListener('mousemove', this.#eventListenerHandlerOnMouseMove, false);

        // matches the window.addEventListener calls commented out above in methodInitialize()
        //window.removeEventListener('keydown', this.#eventListenerHandlerOnKeyDown, false);
        //window.removeEventListener('keyup', this.#eventListenerHandlerOnKeyUp, false);
        //window.removeEventListener('mousemove', this.#eventListenerHandlerOnMouseMove, false);
    }
    // #endregion lifecycle

    // #region event listener handlers
    methodOnKeyDown(e)
    {
        switch (e.keyCode)
        {
            case 38: // arrow up
                this.#keys.up = true;
                // browsers require arrow keys specifically to .preventDefault(), otherwise they are treated as page scrolling
                e.preventDefault();
                break;
            case 40: // arrow down
                this.#keys.down = true;
                // browsers require arrow keys specifically to .preventDefault(), otherwise they are treated as page scrolling
                e.preventDefault();
                break;
            case 37: // arrow left
                this.#keys.left = true;
                // browsers require arrow keys specifically to .preventDefault(), otherwise they are treated as page scrolling
                e.preventDefault();
                break;
            case 39: // arrow right
                this.#keys.right = true;
                // browsers require arrow keys specifically to .preventDefault(), otherwise they are treated as page scrolling
                e.preventDefault();
                break;
            case 90: // key z
                this.#keys.reset = true;
                break;
            case 88: // key x
                this.#keys.updirection = true;
                break;
        }
    }
    methodOnKeyUp(e)
    {
        switch (e.keyCode)
        {
            case 38: // arrow up
                this.#keys.up = false;
                break;
            case 40: // arrow down
                this.#keys.down = false;
                break;
            case 37: // arrow left
                this.#keys.left = false;
                break;
            case 39: // arrow right
                this.#keys.right = false;
                break;
            case 90: // key z
                this.#keys.reset = false;
                break;
            case 88: // key x
                this.#keys.updirection = false;
                break;
        }
    }
    methodOnMouseMove(e)
    {
        this.#mouseX = e.movementX;
        this.#mouseY = e.movementY;
    }
    // #region event listener handlers

    // #region methods
    methodResetMouse()
    {
        //
        this.#mouseX = 0;
        this.#mouseY = 0;
    }
    methodResetKeys()
    {
        //
        this.#keys.up = false;
        this.#keys.down = false;
        this.#keys.left = false;
        this.#keys.right = false;
        this.#keys.updirection = false;
    }
    // #endregion methods
}

// Touch equivalent of EntityComponentCameraControllerFirstPersonInput -
// exposes the exact same shape (keys/mouseX/mouseY/methodResetMouse()) so
// EntityComponentCameraControllerFirstPerson doesn't need to know which of
// the two is actually attached (see BARE_MINIMUM_THREEJS_EXCEPTION_OR_NOT.md's
// "Pattern C: self-attaching sibling components" section for how that
// choice gets made). No touch equivalent for the arrow-key nudge/reset
// behavior yet - keys stays permanently all-false, since there's no
// keyboard on a touch device; EntityComponentCameraControllerFirstPerson
// still reads it unconditionally, so the field has to exist regardless.
// Only the first touch point drives look - no pinch/multi-finger gestures
// in this first pass.
export class EntityComponentCameraControllerFirstPersonInputTouch extends EntityComponent
{
    // #region privates
    #params = null;
    #keys = null;
    #mouseX = null;
    #mouseY = null;
    #lastTouchX = null;
    #lastTouchY = null;

    // we need to store event listener handlers...
    // ...in order to be able to dispose of them
    #eventListenerHandlerOnTouchStart;
    #eventListenerHandlerOnTouchMove;
    #eventListenerHandlerOnTouchEnd;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        super(params);
        this.#params = params;
    }
    // #endregion construct

    // #region getters
    get keys() {return this.#keys;}
    get mouseX(){return this.#mouseX;}
    get mouseY(){return this.#mouseY;}
    // #endregion getters

    // #region lifecycle
    methodInitialize()
    {
        //
        this.#keys =
        {
            up: false,
            down: false,
            left: false,
            right: false,
            reset: false,
        };
        this.#mouseX = 0;
        this.#mouseY = 0;

        // we need to store event listener handlers...
        // ...in order to be able to dispose of them
        this.#eventListenerHandlerOnTouchStart = (e) => this.methodOnTouchStart(e);
        this.#eventListenerHandlerOnTouchMove = (e) => this.methodOnTouchMove(e);
        this.#eventListenerHandlerOnTouchEnd = (e) => this.methodOnTouchEnd(e);


        // document only, deliberately NOT also window (unlike
        // EntityComponentCameraControllerFirstPersonInput's keydown/keyup
        // listeners) - touch events are dispatched based on which element
        // was actually touched and bubble up through the DOM tree, so a
        // document-level listener already catches every one of them;
        // there's no cross-target focus ambiguity here the way there is for
        // keyboard events (see that class's own comment). Registering on
        // window too would mean this class's own delta computation runs
        // twice per real event (both catch the same bubbled event) - each
        // touchmove computes its delta from a stored last-position field
        // (not an already-computed browser delta like e.movementX), so a
        // second run immediately after the first would just recompute a
        // delta of 0 against the position the first run just moved to,
        // discarding the real one before EntityComponentCameraControllerFirstPerson's
        // methodUpdate() ever gets a chance to read it.
        //
        // {passive: false} so methodOnTouchMove() below can call
        // e.preventDefault() - touch listeners default to passive (unable
        // to preventDefault()) for scroll performance, and without this,
        // dragging to look around would also scroll/pinch-zoom the page
        // underneath it.

        // attach those stored event listener handlers
        document.addEventListener('touchstart', this.#eventListenerHandlerOnTouchStart, {passive: false});
        document.addEventListener('touchmove', this.#eventListenerHandlerOnTouchMove, {passive: false});
        document.addEventListener('touchend', this.#eventListenerHandlerOnTouchEnd, {passive: false});
        document.addEventListener('touchcancel', this.#eventListenerHandlerOnTouchEnd, {passive: false});
    }
    methodDispose()
    {
        // for event listeners on document/window, we need to store the function reference beforehand...
        // ...so that we can remove exactly that function instance...
        // ...whereas => or .bind(this) will erroneously create a NEW function instance
        document.removeEventListener('touchstart', this.#eventListenerHandlerOnTouchStart, {passive: false});
        document.removeEventListener('touchmove', this.#eventListenerHandlerOnTouchMove, {passive: false});
        document.removeEventListener('touchend', this.#eventListenerHandlerOnTouchEnd, {passive: false});
        document.removeEventListener('touchcancel', this.#eventListenerHandlerOnTouchEnd, {passive: false});
    }
    // #endregion lifecycle

    // #region event listener handlers
    methodOnTouchStart(e)
    {
        const touch = e.touches[0];
        //debugOverlaySetLine("cam", `touchstart touches=${e.touches.length} id=${touch?.identifier} pos=${touch?.clientX},${touch?.clientY}`); // TEMPORARY
        if(touch == null){return;}

        // Must preventDefault() here, not just in methodOnTouchMove()
        // below - a held, stationary touch arms the browser's own
        // long-press gesture (context menu/text-selection callout) on a
        // timer, and once that fires mid-hold it silently stops delivering
        // touchmove to page listeners at all, which preventDefault() in
        // touchmove is already too late to prevent. Calling it here instead
        // tells the browser up front that this touch is fully handled by
        // the page, before that timer ever gets a chance to fire.
        e.preventDefault();

        this.#lastTouchX = touch.clientX;
        this.#lastTouchY = touch.clientY;
    }

    methodOnTouchMove(e)
    {
        const touch = e.touches[0];
        //if(touch == null){debugOverlaySetLine("cam", "move: no touch[0]"); return;} // TEMPORARY
        //if(this.#lastTouchX == null || this.#lastTouchY == null){debugOverlaySetLine("cam", `move: no lastTouch (id=${touch.identifier})`); return;} // TEMPORARY // no prior touchstart to diff against

        e.preventDefault();

        // Delta since the last touchmove/touchstart - mirrors
        // e.movementX/e.movementY's "moved since last event" semantics for
        // mouse (see EntityComponentCameraControllerFirstPersonInput.methodOnMouseMove()
        // above), just computed by hand since touch events carry absolute
        // coordinates, not a ready-made delta.
        this.#mouseX = touch.clientX - this.#lastTouchX;
        this.#mouseY = touch.clientY - this.#lastTouchY;

        this.#lastTouchX = touch.clientX;
        this.#lastTouchY = touch.clientY;

        //debugOverlaySetLine("cam", `touches=${e.touches.length} id=${touch.identifier} dx=${this.#mouseX} dy=${this.#mouseY}`); // TEMPORARY
    }

    methodOnTouchEnd(e)
    {
        // Clears tracking so the next touchstart doesn't diff against a
        // stale position left over from this now-ended touch.
        this.#lastTouchX = null;
        this.#lastTouchY = null;
        //debugOverlaySetLine("cam", `touchend touches=${e.touches.length} (cleared)`); // TEMPORARY
    }
    // #endregion event listener handlers

    // #region methods
    methodResetMouse()
    {
        //
        this.#mouseX = 0;
        this.#mouseY = 0;
    }
    methodResetKeys()
    {
        //
        this.#keys.up = false;
        this.#keys.down = false;
        this.#keys.left = false;
        this.#keys.right = false;
    }
    // #endregion methods
}

export class EntityComponentCameraControllerFirstPerson extends EntityComponent
{
    // #region privates
    // scene/camera/cameraPivot used to be constructor params - now resolved
    // once (see methodInitialize()) via SingletonContextEngine (see
    // BARE_MINIMUM_THREEJS_EXCEPTION_OR_NOT.md) and cached here, since this
    // component reads and mutates camera/cameraPivot every single
    // methodUpdate() call - a fresh methodGetCamera()/methodGetCameraPivot()
    // lookup 60 times/sec would be wasteful, and the cached reference never
    // goes stale since neither object is ever replaced with a different one
    // after construction, only mutated in place.
    #scene = null;
    #camera = null;
    #cameraPivot = null;

    // we accumulate the pitch (up-down rotation)
    // we do this to stop overshooting at 90 degrees
    #pitch = 0;

    //
    #directionForward = null;
    #directionForwardNonvertical = null;
    #directionRight = null;
    #directionRightNonvertical = null;
    
    //
    #gravityTransitionAxis = null;
    #gravityTransitionRemainingAngle = 0;
    #gravityTransitionAngularSpeed = Math.PI;
    #gravityTransitionAngularSpeedMin = Math.PI;
    #gravityTransitionAngularSpeedMax = Math.PI * 4;

    // lazy
    #hasOnLazyLoadInit = false;
    // mandatory components
    #componentInstanceInput = null;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        super(params);
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize()
    {
        //
        this.methodInitializeAttachment();
        
        //
        this.#scene = this.methodGetScene();
        this.#camera = this.methodGetCamera();
        this.#cameraPivot = this.methodGetCameraPivot();

        //
        this.#directionForward = new THREE.Vector3(0,0,-1);
        this.#directionForwardNonvertical = new THREE.Vector3(0,0,-1);
        this.#directionRight = new THREE.Vector3(1,0,0);
        this.#directionRightNonvertical = new THREE.Vector3(1,0,0);

        // once at start, we update perpendiculars
        this.methodUpdatePerpendiculars(false);

        // register handlers

        this.methodRegisterMessageHandlerWithinEntity('update.position', (paramMessage) => { this.methodHandleUpdatePosition(paramMessage); });
        //this.methodRegisterMessageHandlerWithinEntity('update.rotations', (paramMessage) => { this.methodHandleUpdateRotations(paramMessage); });
    }
    methodUpdate(timeElapsed, timeDelta)
    {
        // #region lazy
        this.#methodOnLazyLoadInit();
        if(!this.#hasOnLazyLoadInit){return;}
        // #endregion lazy

        // sort of early return
        // if reset is pressed we don't need to do anything below
        if(this.#componentInstanceInput.keys.reset == true)
        {
            //
            this.#methodResetCameraRotation();
            //
            this.#componentInstanceInput
                .methodResetMouse();
            this.#componentInstanceInput
                .methodResetKeys();
            // the reset key probably shouldn't reset dirUp in the future, but let's try for now
            this.methodSetDirUp(new THREE.Vector3(0,1,0));
            //
            return;
        }

        // #region up-direction
        /*
        if(componentInstanceInput.keys.updirection == true)
        {
            const componentInstanceGravity = this.methodGetComponent("EntityComponentGravity");
            const gravityDir = componentInstanceGravity?.methodGetGravityDir();
            if(gravityDir == null){console.error("no gravity dir to update to");return;}
            this.methodSetDirUp(gravityDir, false);
        }
        */
        // #endregion up-direction

        // #region up-direction transition
        this.methodUpdateUpDirectionTransition(timeElapsed, timeDelta);
        // #endregion up-direction transition

        // speeds
        var speedX = 0;
        var speedY = 0;

        // keyboard support
        if(this.#componentInstanceInput.keys.left){speedX = 0.02;}
        else if(this.#componentInstanceInput.keys.right){speedX = -0.02;}
        else {speedX = this.#componentInstanceInput.mouseX * -0.001;}
        //
        if(this.#componentInstanceInput.keys.up){speedY = 0.02;}
        else if(this.#componentInstanceInput.keys.down){speedY = -0.02;}
        else{speedY = this.#componentInstanceInput.mouseY * -0.001;}

        // clear the mouse deltas, always! will lead to severe bugs otherwise
        this.#componentInstanceInput.methodResetMouse();
        // just the mouse though; not the keys
        //this.#componentInstanceInput.methodResetKeys();

        // early return: we don't do anything if we don't have anything
        if(speedX == 0 && speedY == 0){return;}

        // #region pitch

        // orientation independent

        // we first accumulate the pitch (up-down rotation)
        // and then we clamp it, to prevent overshooting
        this.#pitch = THREE.MathUtils.clamp(this.#pitch + speedY, -Math.PI / 2, Math.PI / 2);
        // then we apply it
        this.#camera.rotation.x = this.#pitch;

        // #endregion pitch

        // #region yaw

        // orientation dependent

        // this is apparently fine
        // though it informs how we set rotations elsewhere
        // basically after we do this
        // we will be unable to directly set .rotation.y = yaw
        // because yaw could exceed +- pi
        // so we need to .rotation.set(0,yaw,0) instead
        // very hard to figure out without help
        // more on this in the GOTCHAS .md file

        //
        this.#cameraPivot.rotateOnWorldAxis(this.methodGetDirUp(), speedX);

        // outdated : this would have been fine if up-direction could not be changed (but it can be)
        //this.#cameraPivot.rotateY(speedX);

        // #endregion yaw


        // IF we want to broadcast to other components that we have changed rotation

        //
        const resultRotationCamera = new THREE.Quaternion().copy(this.#camera.quaternion);
        const resultRotationCameraPivot = new THREE.Quaternion().copy(this.#cameraPivot.quaternion);

        // in order to broadcast to other components that we have changed rotation
        this.methodSetRotations(resultRotationCameraPivot, speedX, resultRotationCamera, speedY);

        // when we are done with using mouse
        // we reset it
        this.#componentInstanceInput.methodResetMouse();
        // just reset the mouse; not the keys
        //this.#componentInstanceInput.methodResetKeys();

        // update perpendiculars
        this.methodUpdatePerpendiculars(false);
    }

    //
    methodInitializeAttachment()
    {
        // "Pattern C"

        //
        const componentEnvironment = this.methodGetEntityByName("SingletonContextEnvironment")?.methodGetComponent("EntityComponentSingletonContextEnvironment");
        const componentInput = componentEnvironment.methodGetIsTouchPrimary()
            ? new EntityComponentCameraControllerFirstPersonInputTouch()
            : new EntityComponentCameraControllerFirstPersonInputMK()
        ;
        
        //
        this.methodGetParent()
            .methodAddComponentWithName
            (
                "EntityComponentCameraControllerFirstPersonInput",
                componentInput
            );
    }

    //
    #methodOnLazyLoadInit()
    {
        // #region lazy early return
        if(this.#hasOnLazyLoadInit){return;}
        // #endregion lazy early return

        // #region resolve
        // #endregion resolve

        // #region dependent
        this.#componentInstanceInput = this.methodGetComponent("EntityComponentCameraControllerFirstPersonInput");
        if(this.#componentInstanceInput == null){return;}
        // #endregion dependent

        // #region independent
        // #endregion independent

        // #region spawn
        // #endregion spawn

        // #region lazy end
        this.#hasOnLazyLoadInit = true;
        // #endregion lazy end
    }

    //
    methodOnFallingDistanceChanged(index)
    {
        // alias function
        this.methodSetGravityTransitionAngularSpeed(index);
    }
    methodSetGravityTransitionAngularSpeed(index)
    {
        // todo : just change this ONCE depending on the gravity distance?

        // depending on the distance from the planet
        switch(index){
            case 0:
                this.#gravityTransitionAngularSpeed = this.#gravityTransitionAngularSpeedMax;
                break;
            case 1:
                this.#gravityTransitionAngularSpeed = this.#gravityTransitionAngularSpeedMin;
                break;
            case 2:
                this.#gravityTransitionAngularSpeed = this.#gravityTransitionAngularSpeedMin;
                break;
        }
    }
    methodUpdateUpDirectionTransition(timeElapsed, timeDelta)
    {
        // #region early return
        if(this.#gravityTransitionRemainingAngle <= 0){return;}
        // #endregion early return

        // #region body

        // this would run every frame
        // we can instead just change this ONCE in gravity?
        //methodSetGravityTransitionAngularSpeed();

        // calculate the step size to take
        // in radian angles
        const angleStep =
            Math.min(
                this.#gravityTransitionRemainingAngle,
                this.#gravityTransitionAngularSpeed * timeDelta
            );

        // then we rotate the cameraPivot
        // by that angleStep
        // (we calculated the transition direction (pivot?) to rotate around earlier)
        this.#cameraPivot.rotateOnWorldAxis(
            this.#gravityTransitionAxis,
            angleStep
        );

        // now we reduce our remaining angles by that step
        this.#gravityTransitionRemainingAngle -= angleStep;

        // #endregion body
    }
    // #endregion lifecycle

    // #region getters
    get directionForward(){return this.#directionForward;}
    get directionForwardNonvertical(){return this.#directionForwardNonvertical;}
    get directionRightNonvertical(){return this.#directionRightNonvertical;}

    // For network sync (see MULTIPLAYER_TOPOLOGY_AND_SYNC.md). Exposes each
    // object's own quaternion rather than a derived yaw/pitch scalar pair -
    // the real facing direction the local player sees is
    // cameraPivot.quaternion (parent) composed with camera.quaternion
    // (child), and sending each object's actual quaternion stays correct
    // regardless of how their rotation logic evolves, unlike extracting
    // yaw/pitch Euler components, which only worked because cameraPivot
    // currently only ever rotates on Y and camera only ever rotates on X
    // (see TODO.md's now-resolved item 3 for the full reasoning).
    methodGetPosition(){return this.#cameraPivot.position;}
    methodGetCameraPivotQuaternion(){return this.#cameraPivot.quaternion;}
    methodGetCameraQuaternion(){return this.#camera.quaternion;}

    // #endregion getters

    // move... somewhere
    #methodGetVisualDirUp()
    {
        // we don't need the current planet-face's normal direction
        // we need the actual live up direction of the cameraPivot

        // this is because we need to account for mid-transition changes
        
        // if we were to just take the current planet-face's normal direction
        // we would undershoot or overshoot

        //
        return new THREE.Vector3(0, 1, 0).applyQuaternion(this.#cameraPivot.quaternion);

        // old & outdated, below
        // because it just takes the current planet-face's normal direction
        // which doesn't account for mid-transition changes
        // this.methodGetDirUp();
    }

    // #region setters
    methodSetDirUpWithoutTransition(paramDirUp, paramDebug)
    {
        //
        const visualDirUp = this.#methodGetVisualDirUp();
        var angle = visualDirUp.angleTo(paramDirUp);

        //
        this.#gravityTransitionAxis =
            new THREE.Vector3()
                .crossVectors(visualDirUp, paramDirUp);


        // if we have a useable size
        // "the cross-product is non-zero"
        // we can just normalize it, and use our angle calculated previously
        if(this.#gravityTransitionAxis.lengthSq() > 1e-12)
        {
            this.#gravityTransitionAxis.normalize();
        }
        // we have an error check to make
        // antiparallel
        // if the current up-direction is exactly parallell to the new up-direction...
        // ...things may go wrong
        // in this case the "cross product is around zero"
        // but we need to check the dot product to find out which of case it is:
        // parallel or opposite
        else if(visualDirUp.dot(paramDirUp) < 0)
        {
            // we have checked that cross product is about zero, and the dot product is negative
            // this is the direct opposite direction to the up-direction
            // we don't want to use this; instead, we get another direction
            // we pick one that is perpendicular

            // here, we need ANY direction that is NOT parallel to visualDirUp
            var referenceDirection = null;
            if(Math.abs(visualDirUp.x) < 0.9)
            {
                referenceDirection = new THREE.Vector3(1,0,0);
            }
            else
            {
                referenceDirection = new THREE.Vector3(0,1,0);
            }

            // then we override transition axis
            this.#gravityTransitionAxis.crossVectors(visualDirUp, referenceDirection).normalize();
            // and we set an angle
            angle = Math.PI;
        }

        /*
        const axis =
            new THREE.Vector3()
                .crossVectors(visualDirUp, paramDirUp)
                .normalize();
        */
        //const axis = paramDirUp.clone();

        // do a manual, direct rotation
        // this would otherwise be done every frame in methodUpdate() , via methodUpdateUpDirectionTransition()
        
        this.#cameraPivot.rotateOnWorldAxis(
            this.#gravityTransitionAxis,
            angle
        );
        
        // we have modified cameraPivot's rotation/quaternion directly
        // as such
        // we need to ensure that we do not have any remaining transitional rotation
        // we therefore reset the "remaining angle"
        this.#gravityTransitionRemainingAngle = 0;

        //
        super.methodSetDirUp(paramDirUp);
        this.methodUpdatePerpendiculars(paramDebug);
    }
    methodSetDirUp(paramDirUp, paramDebug)
    {
        //
        const visualDirUp = this.#methodGetVisualDirUp();

        // the cross product creates a perpendicular / orthogonal vector to those
        // what this will accomplish, I do not know
        // perhaps if we see this as an axis to rotate our up around, this makes more sense
        // and it does, yay
        this.#gravityTransitionAxis =
            new THREE.Vector3()
                .crossVectors(visualDirUp, paramDirUp)
                .normalize();

        // how many degrees we have left to rotate / transition
        this.#gravityTransitionRemainingAngle = visualDirUp.angleTo(paramDirUp);

        // we update our perpendiculars immediately
        // this will cause our movement to be accurate immediately
        // but our up direction will not be immediate ; this is to prevent snapping
        // (reminder that we need the base class version, which is why we use super. instead of this.)
        super.methodSetDirUp(paramDirUp);
        this.methodUpdatePerpendiculars(paramDebug);
    }
    methodSetDirUpOLD(paramDirUp, paramDebug)
    {
        // pitfall : we can't .setFromUnitVectors() directly on #cameraPivot.quaternion
        // this is because #cameraPivot.quaternion already holds data
        // so we create a new delta quaternion that we do .setFromUnitVectors() on
        // second big change : we apply it to #cameraPivot.quaternion via .premultiply() specifically
        // .multiply() is similar to .rotateOnAxis()
        // whereas
        // .premultiply() is similar to .rotateOnWorldAxis()

        // this is all noted in the GOTCHAS.md file.

        //
        const delta = new THREE.Quaternion().setFromUnitVectors(this.methodGetDirUp(), paramDirUp);
        //
        this.#cameraPivot.quaternion.premultiply(delta);

        // super. is to make sure we use the base class version
        super.methodSetDirUp(paramDirUp);
        this.methodUpdatePerpendiculars(paramDebug);
    }
    methodSetDirFacing(paramDirFacing)
    {
        console.log("() methodSetDirFacing");
        return;
    }
    // #endregion setters

    // #region methods public
    methodUpdatePerpendiculars(paramDebug)
    {
        // we use the cross product
        // of our camera's forward direction
        // and the current up direction
        // to get the right direction

        // update directionForward
        // with our camera's current direction
        this.#camera.getWorldDirection(this.#directionForward);

        // #region directionForward with no vertical component

        //
        this.methodUpdatePerpendicularsForward(paramDebug);

        // #endregion directionForward with no vertical component

        // when will we use the unformatted version of directionRight? idk, but here it is
        this.#directionRight.crossVectors(this.methodGetDirUp(), this.#directionForward);
        this.#directionRightNonvertical.crossVectors(this.methodGetDirUp(), this.#directionForwardNonvertical);
    }
    methodUpdatePerpendicularsForward(paramDebug)
    {
        // fallback value
        // if we were to overshoot during a transition
        // (untested if this is actually needed, for now)
        const directionForwardNonverticalPrev = this.#directionForwardNonvertical.clone();

        // instead of using camera forward (the pitch)
        // (this is what we were doing in the ...OLD version of this method)
        // we will use the cameraPivot forward (the yaw)
        this.#directionForwardNonvertical.set(0,0,-1);
        this.#directionForwardNonvertical.applyQuaternion(this.#cameraPivot.quaternion);
        //
        const amountOfVectorThatIsPointingUp = this.#directionForwardNonvertical.dot(this.methodGetDirUp());
        this.#directionForwardNonvertical.addScaledVector(this.methodGetDirUp(), -amountOfVectorThatIsPointingUp);

        // this fallback value is only used during a camera up-direction transition
        // we have concluded that looking directly down, or directly up...
        // ...does no longer cause an error that needs a fallback
        this.methodUpdatePerpendicularsForwardPreventOvershoot(paramDebug, directionForwardNonverticalPrev);
    }
    methodUpdatePerpendicularsForwardPreventOvershoot(paramDebug, directionForwardNonverticalPrev)
    {
        // we check
        // if the cameraPivot's forward (the yaw) is too close to directly up
        // this can cause an erroneous flip in the "W"/"S" movement direction

        // this fallback value is only used during a camera up-direction transition
        // we have concluded that looking directly down, or directly up...
        // ...does no longer cause an error that needs a fallback
        if(this.#directionForwardNonvertical.length() < 1e-6)
        {
            this.#directionForwardNonvertical.copy(directionForwardNonverticalPrev);
        }
        else
        {
            this.#directionForwardNonvertical.normalize();
        }
    }
    methodUpdatePerpendicularsForwardOLD(paramDebug)
    {
        //
        // TEMPORARY DIAGNOSTIC (see perpendicular-overshoot-when-aiming-down.md) : remember last frame's
        // result so we can detect a sudden flip
        const directionForwardNonverticalPrev = this.#directionForwardNonvertical.clone();

        this.#directionForwardNonvertical.copy(this.#directionForward);
        // this gets our current up direction, and zeroes it out
        this.#directionForwardNonvertical.addScaledVector(this.methodGetDirUp(), -this.#directionForward.dot(this.methodGetDirUp()));

        this.#directionForwardNonvertical.normalize();
    }
    methodLookInDirection(direction)
    {
        // early return: our direction is too small
        // just skip
        const epsilon = 1e-6;
        const magnitude = direction.length();
        if(magnitude < epsilon) { return; }


        // test!

        // (1) tilt so that Y becomes up
        // (2) apply a yaw
        // (3) set the pitch
        // (4) update perpendiculars

        //
        const normalizedDirection = direction.clone().normalize();

        //
        const upDirection = this.methodGetDirUp().clone();

        // the problem:
        // we need horizontalLength (or horizontalLengthSquared)
        // if up-direction is just .y , then this is .x and .z
        // but up-direction is VARIABLE, it will change frequently
        // we therefore need a perpendicular vector to the up-direction
        // and this will be the horizontal vector
        // (to clarify, specifically the right direction of the CURRENT horizontal plane aligned with the CURRENT up-direction)
        // the cross product will get us this perpendicular vector
        //const perpendicularDirectionRight = new THREE.Vector3().crossVectors(normalizedDirection, upDirection);
        // we now need the length of this perpendicular vector
        // this is the horizontal length
        //const horizontalLengthSquared = perpendicularDirectionRight.lengthSq();

        // if our lengthSquared is too small, we are pointing directly up or down
        // and we can early-return
        // otherwise the results are too noisy and unstable
        //const epsilon = 1e-6;
        //if(horizontalLengthSquared < epsilon)
        //{
        //    return;
        //}

        // we apparently need the forward direction (of the horizontal plane)
        // what we had above is the rightward direction (of the horizontal plane)

        // .projectOnPlane() has been explained to me as doing
        // take one direction, and remove from it another direction
        // directionThatWeWantToRemoveFrom.projectOnPlane(directionThatWeWantToRemove)

        // this is also the "reverse" of updatePerpendiculars()
        // there, we are already facing the correct direction, and we rotate other attached directions to match
        // here, we are NOT facing the correct direction, but we know what we want to face
            // "find the quaternion that turns (0,0,-1) into the forward direction."
            // "That’s what the basis-vector version does."

        const perpendicularDirectionForward = normalizedDirection.clone().projectOnPlane(upDirection);

        const horizontalLengthSquared = perpendicularDirectionForward.lengthSq();

        // .normalize() has a side effect when the vector points directly up or down
        // it becomes very noisy and unstable
        // we ONLY normalize our forward direction vector when we do NOT point as such
        // and we use the lengthSquared to determine this;
        // if we are above zero or a very small number, we are safe

        const hasHorizontalPart = horizontalLengthSquared >= epsilon;

        // we can't early return here
        // since we need to do pitch regardless of if we do yaw or not

        // we could make them separate functions though, hehehehehehe
        this.#methodLookInDirectionYaw(upDirection, hasHorizontalPart, perpendicularDirectionForward);
        this.#methodLookInDirectionPitch(upDirection, normalizedDirection, horizontalLengthSquared);

        //
        this.methodUpdatePerpendiculars(false);
    }
    #methodLookInDirectionYaw(upDirection, hasHorizontalPart, perpendicularDirectionForward)
    {
        // #region header

        // early return
        if(!hasHorizontalPart){return;}

        // we are safe to normalize our forward direction vector
        // if we had done it earlier...
        // ...it might have been noisy and unstable...
        // ...since the forward direction vector might have been pointing directly up or down
        // but at this point we have ensured that it does not
        perpendicularDirectionForward.normalize();

        // #endregion header

        // #region body

        // this turns the base-up (.y == 1) into our actual upDirection
        // so this works
        // but it would only be useful in an outdated version
        //const yawQuaternion= new THREE.Quaternion()
        //    .setFromUnitVectors(
        //        new THREE.Vector3(0, 1, 0),
        //        upDirection
        //    )
        //;

        // the old version assumed .x and .y constitutes the horizontal plane
        // this would have only been the case if we used the base-up (.y == 1)
        // we do not
        //const horizontalAngle = Math.atan2(
        //    -perpendicularDirectionForward.x,
        //    -perpendicularDirectionForward.z
        //);

        // this is apparently also outdated
        // .setFromAxisAngle().premultiply() will actually tilt our rotation axis FIRST
        // so even though we use upDirection, that direction will also be tilted
        //this.#cameraPivot.quaternion
        //    .setFromAxisAngle(
        //        upDirection,
        //        horizontalAngle
        //    )
        //    .premultiply(yawQuaternion);


        // our new version
        // instead of angles, we only use directions

        //
        const directionBackwards = perpendicularDirectionForward.clone().negate();

        // cross product returns a perpendicular vector, mind you, which is the "horizontal" direction
        const directionRightwards = new THREE.Vector3().crossVectors(upDirection, directionBackwards);

        // set quaternion, aka, rotate the cameraPivot
        this.#cameraPivot.quaternion
            .setFromRotationMatrix(
                new THREE.Matrix4()
                    .makeBasis(
                        directionRightwards, upDirection, directionBackwards
                    )
            )
        ;

        // #endregion body

        // #region footer

        // we have modified the cameraPivot's rotation/quaternion directly
        // as such
        // we need to ensure that we do not have any remaining transitional rotation
        // we therefore reset the "remaining angle"
        this.#gravityTransitionRemainingAngle = 0;

        // #endregion footer
    }
    #methodLookInDirectionPitch(upDirection, normalizedDirection, horizontalLengthSquared)
    {
        // #region body

        const pitchUnclamped =
            Math.atan2(
                normalizedDirection
                    .dot(upDirection),
                Math.sqrt(horizontalLengthSquared)
            );
        this.#pitch = THREE.MathUtils.clamp(
            pitchUnclamped,
            -Math.PI / 2,
            Math.PI / 2
        );
        this.#camera.rotation.x = this.#pitch;

        // #endregion body
    }

    methodLookInDirectionOLD(direction)
    {
        // the OLD version does not take into account the variable up-direction

        // create a new dir (to not affect the old one), and make Sure that it is normalized
        const dir = direction.clone().normalize();

        // yaw: rotation around the up axis, matching the default forward of (0,0,-1)
        // atan2 is unstable when close to 0
        // we need to handle this edge case
        const horizontalLengthSquared = dir.x * dir.x + dir.z * dir.z;
        // we only apply for non-negligible values
        if(horizontalLengthSquared > 1e-6)
        {
            const yaw = Math.atan2(-dir.x, -dir.z);
            // was: this.#cameraPivot.rotation.y = yaw;
            // more on why this is unsafe in the GOTCHAS .md file
            // in short : yaw must not be allowed to exceed +- pi
            // and directly setting it helps
            this.#cameraPivot.rotation.set(0, yaw, 0);
        }
        
        // pitch: elevation above/below the horizontal plane, same clamp as mouse-look uses
        const horizontalLength = Math.sqrt(horizontalLengthSquared);
        this.#pitch = THREE.MathUtils.clamp(Math.atan2(dir.y, horizontalLength), -Math.PI / 2, Math.PI / 2);
        this.#camera.rotation.x = this.#pitch;
        
        //
        //this.methodUpdatePerpendiculars(false);
    }
    methodLookAt(targetPosition)
    {
        this.methodLookAtOLD(targetPosition);
    }
    methodLookAtOLD(targetPosition)
    {
        // the OLD version does not take into account the variable up-direction

        // we transform this problem
        // to: "get the direction to the target"
        // and then we invoke our LookInDirection() method...
        // ...with regards to that direction

        //
        console.log(this.#cameraPivot.position);
        
        //
        const direction = new THREE.Vector3().subVectors(targetPosition, this.#cameraPivot.position);
        this.methodLookInDirection(direction);
    }
    // #endregion methods public

    // #region methods private
    #methodResetCameraRotation(){
            //
            this.#camera.rotation.set(0,0,0);
            this.#cameraPivot.rotation.set(0,0,0);
            //
            this.#pitch = 0;
            // update perpendiculars
            this.methodUpdatePerpendiculars(false);
    }
    // #endregion methods private

    // #region handlers
    methodHandleUpdatePosition(paramMessage)
    {
        // important to remember that we are sent the entire message, not Just the value
        this.#cameraPivot.position.copy(paramMessage.invokableHandlerValue);
    }
    methodHandleUpdateRotations(paramMessage)
    {
        return;
        this.#camera.quaternion.copy(paramMessage.invokableHandlerValue.rotationB);
        this.#cameraPivot.quaternion.copy(resultRotationCamera.invokableHandlerValue.rotationA);
    }
    // #endregion handlers
}