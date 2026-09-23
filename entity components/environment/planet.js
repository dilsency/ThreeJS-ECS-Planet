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
    // an array of indeces, face indeces that are "direct" neighbors to the current one
    // meaning they share 2 vertices at the corners, and thus 1 edge
    #faceNeighborsDirect = [];
    // an array of indeces, face indeces that are "diagonal" neighbors to the current one
    // meaning they share only 1 vertices at a corner, no shared edges
    #faceNeighborsDiagonal = [];
    //
    #faceCenters = null;
    #faceNormals = null;
    #faceCorners = null;
    // there are a lot of "shortcuts" that can be done
    // by storing edge data in an array for each face
    // makes looking it up much easier later
    #faceEdgeData = [];
    // planes; makes math calculations easier, and there are helpers to visualize them
    // each face of the planet has 1 floor; we store each plane directly in this
    #planesFloor = [];
    // each face of the planet has 3 walls; we store arrays of size 3 in this array, each containing 3 planes
    #planesWall = [];
    //
    #debug = false;
    #debugArrowsFloor = [];
    #debugArrowsWall = [];
    #debugPlanesFloor = [];
    // reminder : each item in this array will contain its own array of 3 items; each wall
    #debugPlanesWall = [];
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
        // #endregion body
    }
    methodDispose() {
        if(this.#debugArrowsFloor != null && this.#debugArrowsFloor.length > 0)
        {
            // dispose of arrows
            for(var i = 0; i < this.#debugArrowsFloor.length; i++)
            {
                // remove from scene
                // apparently we don't need to dispose arrow.geometry
                // since this geometry is of a shared&static type
                this.methodGetScene().remove(this.#debugArrowsFloor[i]);
            }
            // dispose of container's pointer
            this.#debugArrowsFloor = [];
        }
        if(this.#debugArrowsWall != null && this.#debugArrowsWall.length > 0)
        {
            // dispose of arrows
            for(var i = 0; i < this.#debugArrowsWall.length; i++)
            {
                for(var j = 0; j < 3; j++)
                {
                    // remove from scene
                    // apparently we don't need to dispose arrow.geometry
                    // since this geometry is of a shared&static type
                    this.methodGetScene().remove(this.#debugArrowsWall[i][j]);
                }
                // dispose of container's pointer
                this.#debugArrowsWall[i] = [];
            }
            // dispose of container's pointer
            this.#debugArrowsWall = [];
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
            // dispose of container's pointer
            this.#debugPlanesFloor = [];
        }
        if(this.#debugPlanesWall != null && this.#debugPlanesWall.length > 0)
        {
            // dispose of planes (floor)
            for(var i = 0; i < this.#debugPlanesWall.length; i++)
            {
                if(this.#debugPlanesWall[i] == null){console.error("no debugPlanesWall["+i+"]");continue;}
                for(var j = 0; j < 3; j++)
                {
                    if(this.#debugPlanesWall[i][j] == null){console.error("no debugPlanesWall["+i+"]["+j+"]");continue;}

                    // our planeHelpers are actual meshes created by us
                    // so we need to dispose of both geometry and material
                    this.#debugPlanesWall[i][j].material.dispose();
                    this.#debugPlanesWall[i][j].geometry.dispose();
                    //
                    this.methodGetScene().remove(this.#debugPlanesWall[i][j]);
                }
                // dispose of container's pointer
                this.#debugPlanesWall[i] = [];
            }
            // dispose of container's pointer
            this.#debugPlanesWall = [];
        }
    }
    // #endregion lifecycle

    // #region getters
    methodGetFaceCount(){return this.#faceCenters.length;}
    methodGetFaceNormal(index){return this.#faceNormals[index];}
    methodGetIsReady(){return this.#hasOnLazyLoadInit;}
    methodHasOnLazyLoadInit(){return this.#hasOnLazyLoadInit;}
    // #endregion getters

    // #region getters that calculate
    methodGetMatchingCornersCount(cornersA, cornersB)
    {
        // our input parameters are a set of arrays
        // each containing the 3 corners of a face
        
        // what we need to do is loop through all of them
        // and check if they match
        // then increment our counter

        let matchingCornersCount = 0;

        for(var i = 0; i < 3; i++)
        {
            for(var j = 0; j < 3; j++)
            {
                const xPrim = cornersA[i].x;
                const yPrim = cornersA[i].y;
                const zPrim = cornersA[i].z;

                const xSec = cornersB[j].x;
                const ySec = cornersB[j].y;
                const zSec = cornersB[j].z;

                const isMatch = 
                    (xPrim == xSec)
                    &&
                    (yPrim == ySec)
                    &&
                    (zPrim == zSec);

                if(isMatch)
                {
                    // we have a match!
                    matchingCornersCount++;
                }
            }
        }

        return matchingCornersCount;
    }
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
    methodGetIsWithinFace(index)
    {

    }
    methodGetNearestFace(position)
    {
        
    } 
    // #endregion getters that calculate

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

        // the main loop
        // is responsible for creating planes for floors, planes for walls, ...
        // and the edge data that is required to create them
        this.#methodParseFaceData();

        // a secondary loop
        // will check the neighboring relationship between all faces
        // and store them in handy lookup table
        this.#methodStoreNeighborLookup();

        //
        if(this.#debug == true)
        {
            this.#methodCreateDebugArrowsFloor();
            this.#methodCreateDebugArrowsWall();
            //this.#methodCreateDebugPlanesFloor();
            //this.#methodCreateDebugPlanesWall();
        }

        // #endregion body

        // finally, we update the flag so that we don't have to do this again
        this.#hasOnLazyLoadInit = true;
    }

    // #region face data
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
        this.#faceCorners = [];

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

            // we want to store world-space positions
            // a,b,c are local-space
            // so, using the position and radius
            // we can convert them
            const aWorld = a.clone().multiplyScalar(radius).add(position);
            const bWorld = b.clone().multiplyScalar(radius).add(position);
            const cWorld = c.clone().multiplyScalar(radius).add(position);

            // we can now store these for later use
            this.#faceCorners.push([aWorld, bWorld, cWorld]);

            // we use this opporunity to both store edge data
            // AND create planes that represent walls
            this.#methodStoreEdgeData(i,aWorld,bWorld,cWorld,ab,ac,bc,worldSpacePosition,normal,position,radius);
            //this.#methodCreatePlaneWalls(i,a,b,c,ab,ac,bc,worldSpacePosition,normal,position,radius);

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
    #methodStoreEdgeData(i,aWorld,bWorld,cWorld,ab,ac,bc,worldSpacePosition,normal,position,radius)
    {
        //
        //console.log("() methodStoreEdgeData");

        // #region first

        // our i is increased by not only the itemSize (3), but also for the count of each attribute (x,y,z) (also 3)
        // but we want to use an index of 0,1,2,3..
        const iterationIndex = i / (this.#geometry.attributes.position.itemSize * 3);

        // new array of size 3
        this.#faceEdgeData[iterationIndex] = [];

        // #endregion first

        // #region calculate

        // midpoints
        const abMidWorld = new THREE.Vector3()
            .add(aWorld).add(bWorld)
            .divideScalar(2);
        const acMidWorld = new THREE.Vector3()
            .add(aWorld).add(cWorld)
            .divideScalar(2);
        const bcMidWorld = new THREE.Vector3()
            .add(bWorld).add(cWorld)
            .divideScalar(2);

        // we ALSO want to store the direction from the midpoint to the center
        // the order of operations matter!
        // in order to get an inwards pointing vector...
        // ...the center position is sub'd with the midpoint position
        const abToCenter = new THREE.Vector3().subVectors(worldSpacePosition, abMidWorld).normalize();
        const acToCenter = new THREE.Vector3().subVectors(worldSpacePosition, acMidWorld).normalize();
        const bcToCenter = new THREE.Vector3().subVectors(worldSpacePosition, bcMidWorld).normalize();

        // #region edge direction

        //
        const abEdgeDirection = ab.clone().normalize();
        const abNormal = new THREE.Vector3().crossVectors(abEdgeDirection, normal).normalize();
        if(abNormal.dot(aWorld.clone().sub(worldSpacePosition)) < 0){abNormal.negate();}

        //
        const acEdgeDirection = ac.clone().normalize();
        const acNormal = new THREE.Vector3().crossVectors(acEdgeDirection, normal).normalize();
        if(acNormal.dot(aWorld.clone().sub(worldSpacePosition)) < 0){acNormal.negate();}

        //
        const bcEdgeDirection = bc.clone().normalize();
        const bcNormal = new THREE.Vector3().crossVectors(bcEdgeDirection, normal).normalize();
        if(bcNormal.dot(bWorld.clone().sub(worldSpacePosition)) < 0){bcNormal.negate();}

        // #endregion edge direction

        // #endregion calculate

        // #region store

        //
        const abObj = {
            "pointL": aWorld,
            "pointM": abMidWorld,
            "pointR": bWorld,
            "dirAlong": abNormal,
            "dirToCenter": abToCenter,
        };
        this.#faceEdgeData[iterationIndex].push(abObj);

        //
        const acObj = {
            "pointL": aWorld,
            "pointM": acMidWorld,
            "pointR": cWorld,
            "dirAlong": acNormal,
            "dirToCenter": acToCenter,
        };
        this.#faceEdgeData[iterationIndex].push(acObj);

        //
        const bcObj = {
            "pointL": bWorld,
            "pointM": bcMidWorld,
            "pointR": cWorld,
            "dirAlong": bcNormal,
            "dirToCenter": bcToCenter,
        };
        this.#faceEdgeData[iterationIndex].push(bcObj);

        // #endregion store

        // #region plane walls

        // we use what we stored above to create planes to represent each wall
        this.#methodCreatePlaneWalls(iterationIndex,
            abNormal, aWorld,
            acNormal,
            bcNormal, bWorld
        );

        // #endregion plane walls
    }
    #methodCreatePlaneWalls(iterationIndex,
        abNormal, aWorld,
        acNormal,
        bcNormal, bWorld
    )
    {
        //
        //console.log("() methodCreatePlaneWalls");

        // new array of size 3
        this.#planesWall[iterationIndex] = [];

        //
        this.#planesWall[iterationIndex].push(
            new THREE.Plane().setFromNormalAndCoplanarPoint(abNormal, aWorld)
        );

        //
        this.#planesWall[iterationIndex].push(
            new THREE.Plane().setFromNormalAndCoplanarPoint(acNormal, aWorld)
        );

        //
        this.#planesWall[iterationIndex].push(
            new THREE.Plane().setFromNormalAndCoplanarPoint(bcNormal, bWorld)
        );
    }
    // #endregion face data

    //
    #methodStoreNeighborLookup()
    {
        // length 20 for each face
        // each face will have 3 direct neighbors
        // each direct neighbor shares 2 vertices with the main face
        // and thus 1 edge
        this.#faceNeighborsDirect = [];

        // length 20 for each face
        // each face will have 6 diagonal neighbors
        // each diagonal neighbor shares 1 vertex with the main face
        // no edges
        this.#faceNeighborsDiagonal = [];

        // I think what we need to do
        // is loop through all the faces
        // TWICE
        // to see if we can find shared vertices
        // so a loop for each corner too?
        // good lord

        const faceCount = this.methodGetFaceCount();

        // since all arrays have null values in them instead of a nested array
        // we first do a pre-loop to reset them
        // otherwise we'll just get an error when we .push()
        for(var i = 0; i < faceCount; i++)
        {
            this.#faceNeighborsDirect[i] = [];
            this.#faceNeighborsDiagonal[i] = [];
        }

        //
        for(var iteratorIndexPrimaryFace = 0; iteratorIndexPrimaryFace < faceCount; iteratorIndexPrimaryFace++)
        {
            // in this method that we now invoke
            // we loop over all faces again
            // and set matching pairs in the stored array
            // at BOTH indeces; they are neighbors to each other, after all
            this.#methodStoreNeighborLookupForFace(faceCount, iteratorIndexPrimaryFace);
        }

        // we now have a lookup table of all neighboring faces; direct and diagonal
        console.log("lookup table of neighbors : generated");
        console.log("length (direct): " + this.#faceNeighborsDirect.length);
        console.dir(this.#faceNeighborsDirect);
        console.log("length (diagonal): " + this.#faceNeighborsDiagonal.length);
        console.dir(this.#faceNeighborsDiagonal);
    }
    #methodStoreNeighborLookupForFace(faceCount, iteratorIndexPrimaryFace)
    {
        // in this method right here
        // we loop over all faces again
        // and set matching pairs in the stored array
        // at BOTH indeces; they are neighbors to each other, after all

        // optimization!
        // if we were to start this loop at 0 , like you normally would
        // we would be looping over the same faces over and over
        // when we've already checked them
        // we can instead only check the faces that come after the primary index's
        // this way, we only check down the line "into the future"
        const startIndex = (iteratorIndexPrimaryFace + 1);
        // change back to 0 if we want to loop over the same faces we've already been over
        for(var iteratorIndexComparisonFace = startIndex; iteratorIndexComparisonFace < faceCount; iteratorIndexComparisonFace++)
        {
            // early continue : do not check the same face that we are currently testing against
            if(iteratorIndexPrimaryFace == iteratorIndexComparisonFace){continue;}

            //
            const matchingCornersCount = this.methodGetMatchingCornersCount(
                this.#faceCorners[iteratorIndexPrimaryFace],
                this.#faceCorners[iteratorIndexComparisonFace],
            );

            if(matchingCornersCount == 2)
            {
                // we have a "direct" neighbor
                // we push our index
                // but we actually push in BOTH directions; both faces are neighbors to each other, after all

                //
                this.#faceNeighborsDirect[iteratorIndexPrimaryFace].push(iteratorIndexComparisonFace);
                this.#faceNeighborsDirect[iteratorIndexComparisonFace].push(iteratorIndexPrimaryFace);
            }
            else if (matchingCornersCount == 1)
            {
                // we have a "diagonal" neighbor
                // we push our index
                // but we actually push in BOTH directions; both faces are neighbors to each other, after all

                //
                this.#faceNeighborsDiagonal[iteratorIndexPrimaryFace].push(iteratorIndexComparisonFace);
                this.#faceNeighborsDiagonal[iteratorIndexComparisonFace].push(iteratorIndexPrimaryFace);
            }
        }
    }

    // #region debug
    #methodGetDebugColorPerFace(i){
        const hue = (i / this.methodGetFaceCount()) % 1.0;
        return new THREE.Color().setHSL(hue, 1.0, 0.5);
    }
    #methodCreateDebugArrowsFloor()
    {
        // loop through our face data and add arrows to all centers
        for(var i = 0; i < this.methodGetFaceCount(); i++)
        {
            //
            //console.log("() " + i + " methodCreateDebugArrowsFloor");
            
            // direction must be normalized
            // in this case, it is
            const arrow = new THREE.ArrowHelper(
                this.methodGetFaceNormal(i),
                this.methodGetFaceCenter(i),
                2.0,
                this.#methodGetDebugColorPerFace(i)
            );
            this.methodGetScene().add(arrow);
            this.#debugArrowsFloor.push(arrow);
        }
    }
    #methodCreateDebugArrowsWall()
    {
        // reminder : each face has 3 sides
        // so we first loop through all faces
        for(var i = 0; i < this.methodGetFaceCount(); i++)
        {
            // to store all 3 walls
            this.#debugArrowsWall[i] = [];

            // we can now loop through all sides, of the current face
            for(var j = 0; j < 3; j++)
            {
                //
                this.#methodCreateDebugArrowsWallI(i,j);
            } 
        }
    }
    #methodCreateDebugArrowsWallI(i,j)
    {
        if(this.#faceEdgeData[i] == null){console.error("this.#faceEdgeData[i] == null");return;}
        if(this.#faceEdgeData[i][j] == null){console.error("this.#faceEdgeData[i][j] == null");return;}
        if(this.#faceEdgeData[i][j].pointM == null){console.error("this.#faceEdgeData[i][j].pointM == null");return;}

        //
        //console.log("() " + i + " methodCreateDebugArrowsWallI");

        //
        const arrowHelper = new THREE.ArrowHelper(this.#faceEdgeData[i][j].dirToCenter, this.#faceEdgeData[i][j].pointM, 1.0, this.#methodGetDebugColorPerFace(i));

        //
        this.methodGetScene().add(arrowHelper);
        this.#debugArrowsWall[i].push(arrowHelper);
    }
    #methodCreateDebugPlanesFloor()
    {
        // loop through our face data and add arrows to all centers
        for(var i = 0; i < this.methodGetFaceCount(); i++)
        {
            //
            //console.log("() " + i + " methodCreateDebugPlanesFloor");
            
            // read the GOTCHAS .md file
            // we cannot use the built-in PlaneHelper
            // because our origin point is not 0
            // we fake a Helper with a mesh, instead
            
            //
            const geometry = new THREE.PlaneGeometry(4,4);
            const material = new THREE.MeshBasicMaterial({wireframe: true,color:this.#methodGetDebugColorPerFace(i),});
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
    #methodCreateDebugPlanesWall()
    {
        // reminder : each face has 3 sides
        // so we first loop through all faces
        for(var i = 0; i < this.methodGetFaceCount(); i++)
        {
            // to store all 3 walls
            this.#debugPlanesWall[i] = [];

            // we can now loop through all sides, of the current face
            for(var j = 0; j < 3; j++)
            {
                if(this.#planesWall[i] == null){console.error("no planesWall " + i);continue;}
                if(this.#planesWall[i][j] == null){console.error("no planesWall " + i + " : " + j);continue;}

                //
                this.#methodCreateDebugPlanesWallI(i,j);
            } 
        }
    }
    #methodCreateDebugPlanesWallI(i,j)
    {
        if(this.#faceEdgeData[i] == null){console.error("this.#faceEdgeData[i] == null");return;}
        if(this.#faceEdgeData[i][j] == null){console.error("this.#faceEdgeData[i][j] == null");return;}
        if(this.#faceEdgeData[i][j].pointM == null){console.error("this.#faceEdgeData[i][j].pointM == null");return;}

        //
        //console.log("() " + i + " methodCreateDebugPlanesWallI");

        //
        const geometry = new THREE.BufferGeometry();

        //
        geometry.setFromPoints([
            this.#faceEdgeData[i][j].pointL,
            this.#faceEdgeData[i][j].pointM.clone().addScaledVector(this.#faceNormals[i],1.0),
            this.#faceEdgeData[i][j].pointR
        ]);

        // this is dependent on how many points we have
        // 3 gives us this
        geometry.setIndex([0, 1, 2]);

        // 4 gives us this
        //geometry.setIndex([0, 1, 2, 0, 2, 3]);

        //
        geometry.computeVertexNormals();

        //
        const material = new THREE.MeshBasicMaterial({wireframe: true,color:this.#methodGetDebugColorPerFace(i),});
        const mesh = new THREE.Mesh(geometry,material);

        //
        this.methodGetScene().add(mesh);
        this.#debugPlanesWall[i].push(mesh);
    }
    #methodCreateDebugPlanesWallIOLD(i)
    {
        //
        const geometry = new THREE.PlaneGeometry(4,4);
        const material = new THREE.MeshBasicMaterial({wireframe: true,});
        const planeMesh = new THREE.Mesh(geometry, material);


        // we need the midpoint to center it
        // THREE.Plane does not have such a point
        // so we use the stored value in #faceEdgeData
        planeMesh.position.copy(this.#faceEdgeData[i][j].pointM);

        // rotate here
        // basically means
        // "which direction is the default forward"
        // , "which direction is the normal"
        planeMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0,0,1),
            this.#faceEdgeData[i][j].dirToCenter
        );

        //
        this.methodGetScene().add(planeMesh);
        this.#debugPlanesWall[i].push(planeMesh);
    }
    // #endregion debug
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

    // #region getters that delegate
    methodGetFaceNormal()
    {
        if(this.#planetResolved == null){return;}
        if(!this.#planetResolved.methodGetIsReady()){return;}
        return this.#planetResolved.methodGetFaceNormal(this.#faceIndex);
    }
    // #endregion getters that delegate

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