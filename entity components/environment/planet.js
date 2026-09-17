// imports
// base
import * as THREE from "three";
// ECS
import {EntityComponent} from "../../classes/ECS/entity_component.js";

//
export class EntityComponentPlanetModel extends EntityComponent {
    // #region privates
    #params = null;
    //
    #mesh = null;
    #geometry = null;
    // params.model is string, representing the name of the model to load
    #model = null;
    #position = null;
    #radius = 1.0;
    #color = "#FFFFFF";
    // #endregion privates

    // #region construct
    constructor(params) {
        //
        super(params);
        //
        this.#params = params;
        // again, params.model is string, representing the name of the model to load
        if(params.model != null){ this.#model = params.model; }
        if(params.position != null){ this.#position = params.position; }
        if(params.radius != null){ this.#radius = params.radius; }
        if(params.color != null){ this.#color = params.color; }
    }
    // #endregion construct

    // #region lifecycle
    async methodInitialize() {
        // #region early return
        // we don't have a model to load; exit
        if(this.#model == null){ return; }
        // #endregion early return

        // #region get component
        const entityComponentModelCache = this.methodGetEntityByName("SingletonContextModelCache")?.methodGetComponent("EntityComponentSingletonContextModelCache");
        // #endregion get component

        // #region early return
        if(entityComponentModelCache == null){console.error("no entity component");return;}
        // #endregion early return

        // #region body
        this.#geometry = await entityComponentModelCache.methodGetModelGeometry(this.#model);
        // #endregion body

        // #region early return
        // since we have used "await"
        // we could have lost our geometry already (asynchronously)
        // due to "teardown" or disposal
        // so what we do is check if this is flagged for disposal / deletion / teardown
        // and if so, we nope out
        if(this.methodGetIsThisOrParentFlaggedForDeletion()){return;}
        // #endregion early return

        // #region body
        //
        const material = new THREE.MeshStandardMaterial();
        material.color = new THREE.Color(this.#color);
        material.flatShading = true;
        //
        this.#mesh = new THREE.Mesh(this.#geometry, material);
        this.#mesh.scale.setScalar(this.#radius);
        this.#mesh.castShadow = true;
        this.#mesh.receiveShadow = true;
        //
        if(this.#position != null)
        {
            this.#mesh.position.copy(this.#position);
        }
        //
        this.methodGetScene().add(this.#mesh);
        // #endregion body
    }
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose()
    {
        // #region early return
        // we don't have a mesh to dispose; exit
        if(this.#mesh == null){ return; }
        // #endregion early return

        // #region body
        //
        this.methodGetScene().remove(this.#mesh);
        //
        this.#mesh.material.dispose();
        // remove pointer as well
        this.#mesh = null;
        // we do NOT dispose of geometry
        // we cache it for a reason, after all
        // #endregion body
    }
    // #endregion lifecycle

    // #region getters
    methodGetGeometry() { return this.#geometry; }
    methodGetPosition() {return this.#position;}
    methodGetRadius() { return this.#radius; }
    // #endregion getters
}

//
export class EntityComponentPlanetFaces extends EntityComponent
{
    // #region privates
    #geometry = null;
    // lazy
    #hasOnLazyLoadInit = false;
    //
    #faceCenters = null;
    #faceNormals = null;
    // planes; makes math calculations easier, and there are helpers to visualize them
    // each face of the planet has 1 floor; we store each plane directly in this
    #planesFloor = [];
    // each face of the planet has 3 walls; we store arrays of size 3 in this array, each containing 3 planes
    #planesWall = [];
    //
    #debug = false;
    #debugArrows = [];
    #debugPlanesFloor = [];
    // #endregion privates

    // #region construct
    constructor(params) {
        //
        super(params);
        //
        if(params.debug != null){this.#debug = params.debug;}
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize() { }
    methodUpdate(timeElapsed, timeDelta)
    {
        // #region lazy

        // we don't have everything at the start
        // so we check every frame until we do
        // and when we have
        // we early-out every frame
        this.#methodOnLazyLoadInit();

        if(!this.#hasOnLazyLoadInit){return;}

        // #endregion lazy

        // #region body
        // we COULD move the first initial geometry to faces loop here
        // but then we'd need another flag
        // so we should really rename #methodGetIsReady to #methodSingleInitialization or something
        // and #isReady to #hasSingleInitialized or something
        // #endregion body
    }
    methodDispose() {
        if(this.#debugArrows != null && this.#debugArrows.length > 0)
        {
            // dispose of arrows
            for(var i = 0; i < this.#debugArrows.length; i++)
            {
                // remove from scene
                // apparently we don't need to dispose arrow.geometry
                // since this geometry is of a shared&static type
                this.methodGetScene().remove(this.#debugArrows[i]);
            }
            // dispose of pointer
            this.#debugArrows = [];
        }
        if(this.#debugPlanesFloor != null && this.#debugPlanesFloor.length > 0)
        {
            // dispose of planes (floor)
            for(var i = 0; i < this.#debugPlanesFloor.length; i++)
            {
                // our planeHelpers are actual meshes created by us
                // so we need to dispose of both geometry and material
                this.#debugPlanesFloor[i].material.dispose();
                this.#debugPlanesFloor[i].geometry.dispose();
                //
                this.methodGetScene().remove(this.#debugPlanesFloor[i]);
            }
            // dispose of pointer
            this.#debugPlanesFloor = [];
        }
    }
    // #endregion lifecycle

    // #region getters
    methodGetFaceCount(){return this.#faceCenters.length;}
    methodGetFaceCenter(index){
        // our stored face center is in the (normalized) object-space of the triangle
        // so it ranges from -1 to 1

        // when this method is invoked
        // we do really want the world space of the face

        const entityComponent = this.methodGetComponent("EntityComponentPlanetModel");
        const position = entityComponent?.methodGetPosition() ?? new THREE.Vector3(0, 0, 0);
        const radius = entityComponent?.methodGetRadius() ?? 1.0;

        return new THREE.Vector3()
        .copy(this.#faceCenters[index])
        .multiplyScalar(radius)
        .add(position);
    }
    methodGetFaceNormal(index){return this.#faceNormals[index];}
    methodGetIsReady(){return this.#hasOnLazyLoadInit;}
    methodHasOnLazyLoadInit(){return this.#hasOnLazyLoadInit;}
    // #endregion getters

    // #region private methods
    #methodOnLazyLoadInit()
    {
        // #region lazy

        // consider rename
        // this method does not JUST check if we are ready
        // it also does everything at the first initialization
        // so...
        // ...rename it to that?
        // methodOneShotInit
        // or something like that
        // methodOnLoadInit is whack, though



        // "lazy" : we check every frame if we have it
        // and when we do, we early return out of this function every frame
        if(this.#hasOnLazyLoadInit){return;}

        // #endregion lazy

        // #region body

        // here, we need to get the planet geometry

        // we first need the component (a sibling to the current component)
        const entityComponent = this.methodGetComponent("EntityComponentPlanetModel");

        // #region early return
        if(entityComponent == null){return;}
        // #endregion early return

        // then we get the geometry
        this.#geometry = entityComponent.methodGetGeometry();

        // #region early return
        if(this.#geometry == null){return;}
        // #endregion early return

        //
        this.#methodParseFaceData();

        //
        if(this.#debug == true)
        {
            this.#methodCreateDebugArrows();
            this.#methodCreateDebugPlanesFloor();
        }

        // #endregion body

        // finally, we update the flag so that we don't have to do this again
        this.#hasOnLazyLoadInit = true;
    }
    #methodParseFaceData()
    {
        if(this.#geometry.index != null)
        {
            this.#methodParseFaceDataViaIndex();
        }
        else if(this.#geometry.attributes.position != null) {
            this.#methodParseFaceDataViaPositions();
        }
    }
    #methodParseFaceDataViaIndex(){}
    #methodParseFaceDataViaPositions()
    {
        //
        this.#faceCenters = [];
        this.#faceNormals = [];

        // the main loop
        for(var i = 0; i < this.#geometry.attributes.position.array.length; i += 3 * this.#geometry.attributes.position.itemSize)
        {
            // we are at the first index of the triangle
            // the 3 following items describe ONE position of a corner of a triangle
            // x, y, z
            // we need the following 3 triplets

            //
            const corners = [];
            this.#methodParseFaceDataViaPositionsJ(corners, i);

            // this gives us each corner of a triangle
            const [a,b,c] = corners;

            // #region center point and normal

            // get center position of the triangle
            // this is in local-space, NOT world-space
            // (break out into its own method?)
            const centerLocal = new THREE.Vector3()
            .add(a).add(b).add(c)
            .divideScalar(3);

            // get normal
            // (break out into its own method?)
            const ab = new THREE.Vector3().subVectors(b, a);
            const ac = new THREE.Vector3().subVectors(c, a);
            const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();
            // used later
            const bc = new THREE.Vector3().subVectors(c, b);

            // convex mesh centered at origin: flip outward if it points inward
            if(normal.dot(centerLocal) < 0){ normal.negate(); }

            // #ednregion center point and normal

            // #region planes

            // to create a plane representing a floor
            // we need the normal (we have that)
            // and a world-space position (we do not have that, we have local-space)
            // so we use the same math as in .methodGetFaceCenter(index)
            // to get a world-space point

            // #region world-space coordinate base
            const entityComponent = this.methodGetComponent("EntityComponentPlanetModel");
            const position = entityComponent?.methodGetPosition() ?? new THREE.Vector3(0, 0, 0);
            const radius = entityComponent?.methodGetRadius() ?? 1.0;
            // #endregion world-space coordinate base

            // we use our coordinate base thusly
            const worldSpacePosition = new THREE.Vector3().copy(centerLocal).multiplyScalar(radius).add(position);
            // and now we have a world-space point for our plane!
            const planeFloor = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldSpacePosition);
            this.#planesFloor.push(planeFloor);

            // now we need 3 more planes; each representing a wall of the triangle
            this.#methodCreatePlaneWalls(i,a,b,c,ab,ac,bc,worldSpacePosition,normal,position,radius);

            // #endregion planes

            //
            this.#faceCenters.push(centerLocal);
            this.#faceNormals.push(normal);
        }

        console.dir(this.#faceCenters);
    }
    #methodParseFaceDataViaPositionsJ(corners, indexI)
    {
        // inner loop
        for(var j = 0; j < 3; j++)
        {
            // to explain the index math
            
            // let's say i starts at 0
            // the next 3 items will be the x,y,z of the first corner, of the first triangle

            // we will run this inner loop three times, because we have three corners

            // so what we want is
            // [0,1,2], [3,4,5], [6,7,8]
            // split across the three loops

            // our actual iterationIndex
            // must then be the inner-loop's index (j) * the itemSize (we could just write 3, but we won't)

            // the outer-loop's index (i) just tells us where to start

            const indexK = indexI + j * this.#geometry.attributes.position.itemSize;

            // the following 3 items are x, y, and z, of the triangle corner
            // we do that below by doing
            // x = iterationIndex + 0
            // y = iterationIndex + 1
            // z = iterationIndex + 2

            this.#methodParseFaceDataViaPositionsK(corners, indexK);
        }
    }
    #methodParseFaceDataViaPositionsK(corners, indexK)
    {
        corners.push(new THREE.Vector3(
            this.#geometry.attributes.position.array[indexK + 0],
            this.#geometry.attributes.position.array[indexK + 1],
            this.#geometry.attributes.position.array[indexK + 2]
        ));
    }
    #methodCreatePlaneWalls(i,a,b,c,ab,ac,bc,worldSpacePosition,normal,position,radius)
    {
        // new array of size 3
        this.#planesWall[i] = [];

        // we need world-space positions
        // a,b,c are local-space
        // so, using the position and radius
        // we can convert them

        //
        const aWorld = a.clone().multiplyScalar(radius).add(position);
        const bWorld = b.clone().multiplyScalar(radius).add(position);
        // c is not actually needed; we only need 2 points
        //const cWorld = c.clone().multiplyScalar(radius).add(position);

        //
        const abEdgeDirection = ab.clone().normalize();
        const abNormal = new THREE.Vector3().crossVectors(abEdgeDirection, normal).normalize();
        if(abNormal.dot(aWorld.clone().sub(worldSpacePosition)) < 0){abNormal.negate();}
        this.#planesWall[i].push(new THREE.Plane().setFromNormalAndCoplanarPoint(abNormal, aWorld));

        //
        const acEdgeDirection = ac.clone().normalize();
        const acNormal = new THREE.Vector3().crossVectors(acEdgeDirection, normal).normalize();
        if(acNormal.dot(aWorld.clone().sub(worldSpacePosition)) < 0){acNormal.negate();}
        this.#planesWall[i].push(new THREE.Plane().setFromNormalAndCoplanarPoint(acNormal, aWorld));

        //
        const bcEdgeDirection = bc.clone().normalize();
        const bcNormal = new THREE.Vector3().crossVectors(bcEdgeDirection, normal).normalize();
        if(bcNormal.dot(bWorld.clone().sub(worldSpacePosition)) < 0){bcNormal.negate();}
        this.#planesWall[i].push(new THREE.Plane().setFromNormalAndCoplanarPoint(bcNormal, bWorld));
    }
    #methodCreateDebugArrows()
    {
        // loop through our face data and add arrows to all centers
        for(var i = 0; i < this.methodGetFaceCount(); i++)
        {
            // direction must be normalized
            // in this case, it is
            const arrow = new THREE.ArrowHelper(
                this.methodGetFaceNormal(i),
                this.methodGetFaceCenter(i),
                2.0,
                "#FFFF00"
            );
            this.methodGetScene().add(arrow);
            this.#debugArrows.push(arrow);
        }
    }
    #methodCreateDebugPlanesFloor()
    {
        // loop through our face data and add arrows to all centers
        for(var i = 0; i < this.methodGetFaceCount(); i++)
        {
            // read the GOTCHAS .md file
            // we cannot use the built-in PlaneHelper
            // because our origin point is not 0
            // we fake a Helper with a mesh, instead
            
            //
            const geometry = new THREE.PlaneGeometry(4,4);
            const material = new THREE.MeshBasicMaterial({wireframe: true,});
            const planeMesh = new THREE.Mesh(geometry, material);

            //
            planeMesh.position.copy(this.methodGetFaceCenter(i));

            // basically means
            // "which direction is the default forward"
            // , "which direction is the normal"
            planeMesh.quaternion.setFromUnitVectors(
                new THREE.Vector3(0,0,1),
                this.methodGetFaceNormal(i)
            );

            //
            this.methodGetScene().add(planeMesh);
            this.#debugPlanesFloor.push(planeMesh);
        }
    }
    // #endregion private methods
}



export class EntityComponentSpawnOnPlanetFace extends EntityComponent
{
    // #region privates
    // lazy
    #hasOnLazyLoadInit = false;
    // reminder that this.#planet is just a $ref
    #planet = null;
    #planetResolved = null;
    #faceIndex = null;
    #faceDistance = 2.0;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        //
        super(params);

        // reminder that params.planet is just a $ref
        if(params.planet != null){this.#planet = params.planet;}
        if(params.faceIndex != null){this.#faceIndex = params.faceIndex;}
        if(params.faceDistance != null){this.#faceDistance = params.faceDistance;}
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize(){}
    methodUpdate(timeElapsed, timeDelta)
    {
        // #region lazy
        this.#methodOnLazyLoadInit();
        if(!this.#hasOnLazyLoadInit){return;}
        // #endregion lazy
        
        // #region body

        // #endregion body
    }
    methodDispose(){}
    // #endregion lifecycle

    // #region getters
    methodGetIsReady(){return this.#hasOnLazyLoadInit;}
    methodHasOnLazyLoadInit(){return this.#hasOnLazyLoadInit;}
    // #endregion getters

    // #region private methods
    #methodOnLazyLoadInit()
    {
        // #region lazy
        if(this.#hasOnLazyLoadInit){return;}
        // #endregion lazy
        
        // #region body

        // #region early return
        if(this.#planet == null){return;}
        if(this.#planet["$ref"] == null){return;}
        // #endregion early return

        // we have ourselves a param of the special type $ref
        // we use this to find the planet we belong to

        // 
        this.#planetResolved = this.methodGetEntityByName(this.#planet["$ref"]["entity"])?.methodGetComponent(this.#planet["$ref"]["component"]);

        // #region early return
        if(this.#planetResolved == null){return;}
        if(!this.#planetResolved.methodGetIsReady()){console.log("we resolved the planet, but the planet itself hasn't parsed its triangles yet");return;}
        // #endregion early return

        // now we have the resolved planet, and it is ready
        // we can therefore re-position to the center of the current index
        // and then push out from there, based on the distance

        // if we don't have a set faceIndex
        // let's randomize one!
        if(this.#faceIndex == null)
        {
            this.#faceIndex = Math.floor(Math.random() * this.#planetResolved.methodGetFaceCount());
        }

        //
        this.methodSetPosition(
            this.#planetResolved.methodGetFaceCenter(this.#faceIndex).add(
                this.#planetResolved.methodGetFaceNormal(this.#faceIndex).clone().multiplyScalar(
                    this.#faceDistance
                )
            )
        );

        // lookAt() the planet
        // only if we are the player, mind you
        // as in, we have the related component
        // if we don't, we skip : neat!
        const cameraController = this.methodGetComponent("EntityComponentCameraControllerFirstPerson");
        if(cameraController != null)
        {
            // an alternative would be to use the .invert() normal direction
            console.log("\tface index: " + this.#faceIndex);
            cameraController.methodLookAt(this.#planetResolved.methodGetFaceCenter(this.#faceIndex));
        }

        // #endregion body

        // finally, we update the flag so that we don't have to do this again
        this.#hasOnLazyLoadInit = true;
    }
    // #endregion private methods
}