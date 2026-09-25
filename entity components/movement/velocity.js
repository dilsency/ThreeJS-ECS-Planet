import * as THREE from "three";
import { EntityComponent } from "../../classes/ECS/entity_component";

export class EntityComponentVelocity extends EntityComponent
{
    //
    #velocity = null;
    //
    #frictionHorizontal = 0.995;
    #frictionVertical = 0.995;
    //
    #velocityMax = 5.0;
    //
    #zeroEpsilon = 0.001;

    //
    constructor(params)
    {
        //
        super(params);

        //
        if(params.frictionHorizontal != null)
        {
            this.#frictionHorizontal = params.frictionHorizontal;
        }
        if(params.frictionVertical != null)
        {
            this.#frictionVertical = params.frictionVertical;
        }
    }
    methodInitialize()
    {
        //
        this.#velocity = new THREE.Vector3(0.0,0.0,0.0);
    }
    methodUpdate(timeElapsed, timeDelta)
    {
        // early return

        //
        if(this.#velocity == null){console.error("no vel");return;}

        //
        const isVelocityZero = this.methodGetIsVelocityZero(); 
        if(isVelocityZero){return;}

        // translate the position of the entity thusly
        const pos = this.methodGetPosition().clone();
        pos.addScaledVector(
            this.#velocity,
            timeDelta
        );

        // and apply
        this.methodSetPosition(pos);

        // then we scale down velocity based on friction
        // to-do : get the current planet face's up direction
        // and scale down vertical friction in that direction

        // let's make it simple for ourselves when testing, first
        this.#velocity.multiplyScalar(this.#frictionHorizontal);

        // do not round velocities down to 0
        // and absolutely do not round them composite -style (.x, .y, .z)
        // instead when checking for 0
        // we can give it some (epsilon) leeway
        // very low velocities can be rounded down to 0
    }
    methodDispose(){}


    //
    methodAddToVelocity(paramA, paramB, paramC)
    {
        // alias function
        // if someone invokes this with just 1 parameter
        // we assume it is a Vector3
        // if they invoke it with 3
        // we assume it is composite
        if(paramA != null && paramB == null && paramC == null)
        {
            this.methodAddToVelocityVector3(paramA);
        }
        else if (paramA != null && paramB != null && paramC != null)
        {
            this.methodAddToVelocityComposite(paramA, paramB, paramC);
        }
    }
    methodAddToVelocityVector3(velocityAddend)
    {
        this.#velocity.add(velocityAddend);
        // clamp
        this.methodClampVelocity();
    }
    methodAddToVelocityComposite(x,y,z)
    {
        this.#velocity.x += x;
        this.#velocity.y += y;
        this.#velocity.z += z;

        // clamp
        this.methodClampVelocity();
    }

    methodClampVelocity()
    {
        // the correct way to clamp a 3D vector is by checking the magnitude
        // aka the "total" speed of the entire vector
        // if that is too high
        // we scale the whole thing down
        if(this.#velocity.length() > this.#velocityMax)
        {
            // .setLength() does this scaling
            this.#velocity.setLength(this.#velocityMax);
        }

        // old & outdated
        // will distort the velocity direction

        //if(this.#velocity.x > this.#velocityXMax){this.#velocity.x = this.#velocityXMax;}
        //if(this.#velocity.x < -this.#velocityXMax){this.#velocity.x = -this.#velocityXMax;}

        //if(this.#velocity.y > this.#velocityYMax){this.#velocity.y = this.#velocityYMax;}
        //if(this.#velocity.y < -this.#velocityYMax){this.#velocity.y = -this.#velocityYMax;}

        //if(this.#velocity.z > this.#velocityZMax){this.#velocity.z = this.#velocityZMax;}
        //if(this.#velocity.z < -this.#velocityZMax){this.#velocity.z = -this.#velocityZMax;}
    }

    methodNullifyGravity(gravityDir)
    {
        if(gravityDir == null){return;}
        if(this.#velocity == null){return;}
        if(this.methodGetIsVelocityZero()){return;}

        // we have the gravity direction (straight down)
        // now, we scale down our velocity until we only have horizontal velocity left

        // dot product is used to get the "scalar projection" according to google
        // aka the amount of speed in that direction
        //const scalarProjection = this.#velocity.dot(gravityDir);
        const scalarProjection = this.methodGetVelocityAlongAxis(gravityDir);

        // so we create a new vector, that is the gravity direction scaled by the dot product above
        const velocityInDirection = gravityDir.clone().multiplyScalar(scalarProjection);

        // now we subtract that from our velocity
        this.#velocity.subVectors(this.#velocity, velocityInDirection);
    }

    // #region getters : basic
    methodGetVelocity(){return this.#velocity;}
    // #endregion getters : basic

    methodRoundDownToZero()
    {
        //
        if(this.#velocity.lengthSq() <= (this.#zeroEpsilon * this.#zeroEpsilon))
        {
            this.#velocity.set(0, 0, 0);
        }
    }

    methodGetIsVelocityZero()
    {
        // we have an epsilon to give some leeway here
        // and again, we check the magnitude i.e. "total" speed of Vector3 s
        // not composite -style (.x, .y, .z)

        //
        const magnitudeSq = this.#velocity.lengthSq();
        if(magnitudeSq <= (this.#zeroEpsilon * this.#zeroEpsilon)){return true;}

        // old & outdated
        // because .length() is costlier than .lengthSq() when it comes to comparisons
        //const magnitude = this.#velocity.length();
        //if(magnitude <= this.#zeroEpsilon){return true;}
        
        return false;
    }

    methodGetVelocityAlongAxis(axisDir)
    {
        //
        if(this.methodGetIsVelocityZero()){return 0.0;}
        
        // dot product is used to get the "scalar projection" according to google
        // aka the amount of speed in that direction
        const scalarProjection = this.#velocity.dot(axisDir);

        // is it enough to just return this dot product???
        return scalarProjection;
    }
    methodGetIsVelocityAlongAxisZero(axisDir)
    {
        // reminder : during methodUpdate, we do round velocities
        // that are close-to-zero
        // down to zero

        //
        if(this.methodGetIsVelocityZero()){return true;}

        //
        const scalarProjection = this.methodGetVelocityAlongAxis(axisDir);

        // should we have another epsilon for scalarProjection?
        // instead of the one used for this.#velocity.length() ?
        // not sure
        if(Math.abs(scalarProjection) <= this.#zeroEpsilon)
        {
            return true;
        }

        return false;
    }
    methodGetIsVelocityAlongAxisZeroOrNegative(axisDir)
    {
        // reminder : during methodUpdate, we do round velocities
        // that are close-to-zero
        // down to zero

        //
        if(this.methodGetIsVelocityZero()){return true;}

        //
        const scalarProjection = this.methodGetVelocityAlongAxis(axisDir);

        // should we have another epsilon for scalarProjection?
        // instead of the one used for this.#velocity.length() ?
        // not sure
        if(scalarProjection <= this.#zeroEpsilon )
        {
            return true;
        }

        return false;
    }
}