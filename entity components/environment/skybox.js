// imports
// base
import * as THREE from "three";
// ECS
import {EntityComponent} from "../../classes/ECS/entity_component.js";

//
export class EntityComponentSkybox extends EntityComponent
{
    // #region privates
    #params = null;
    
    // Hardcoded for now: false = cheap EquirectangularReflectionMapping,
    // true = the baked WebGLCubeRenderTarget version. (One-liner to make it a
    // world param later: this.#params.useCubemapBake ?? false.)
    #useCubemapBake = false;
    // either or
    #bakedCubemap = null;
    #textureEquirectangular = null;
    //
    #colorArray = ["#0000FF"];
    // #endregion privates

    // #region construct
    constructor(params)
    {
        //
        super(params);

        //
        this.#params = params;

        //
        if(this.#params.colors != null)
        {
            this.#colorArray = this.#params.colors;
        }
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize(){
        if(this.#useCubemapBake)
        {
            this.methodBakeCubemap();
            this.#methodApplyCubemap();
        }
        else {
            this.#methodApplyTextureEquirectangular();
        }
    }
    methodUpdate(timeElapsed, timeDelta) { }
    methodDispose()
    {
        // we let world_generator.js change the scene.background
        // if we do it here it'll be changed twice
        // kind of messy
        //const scene = this.methodGetScene();
        //scene.background = this.#teardownBackground;

        if(this.#bakedCubemap != null)
        {
            // free the WebGLCubeRenderTarget
            this.#bakedCubemap.dispose();

            // free the pointer
            this.#bakedCubemap = null;
        }
        if(this.#textureEquirectangular != null)
        {
            // free the texture
            this.#textureEquirectangular.dispose();
            // free the pointer
            this.#textureEquirectangular = null;
        }
    }
    // #endregion lifecycle

    // #region methods
    // #region slightly more expensive
    methodBakeCubemap()
    {
        //
        const renderer = this.methodGetRenderer();

        // the render target we keep
        this.#bakedCubemap = new THREE.WebGLCubeRenderTarget(this.#colorArray.length);//this.#resolution

        // a throwaway scene holding only the dome
        const bakeScene = new THREE.Scene();
        const domeGeometry = new THREE.SphereGeometry(10, 32, 16); // radius irrelevant; camera sits at center
        const domeTexture = this.#methodCreateTexture();
        const domeMaterial = this.#methodCreateMaterial(domeTexture);
        const dome = new THREE.Mesh(domeGeometry, domeMaterial);
        bakeScene.add(dome);

        // capture all six directions from the center, once
        const cubeCamera = new THREE.CubeCamera(0.1, 100, this.#bakedCubemap);
        bakeScene.add(cubeCamera);
        cubeCamera.update(renderer, bakeScene);

        // the gradient now lives in this.#bakedCubemap.texture — discard the rest
        domeGeometry.dispose();
        domeMaterial.dispose();
        domeTexture.dispose();
        // bakeScene/dome/cubeCamera are unreferenced after this → GC'd
    }
    // #endregion slightly more expensive
    // #endregion methods

    // #region private methods
    // #region slightly more expensive
    #methodApplyCubemap()
    {
        //
        const scene = this.methodGetScene();
        
        // if we wanted to have reflections, which we do not (expensive)
        /*
        this.#environmentBefore = scene.environment;
        */

        //
        scene.background = this.#bakedCubemap.texture;
        
        // if we wanted to have reflections, which we do not (expensive)
        /*
        if (this.#applyToEnvironment) {
            scene.environment = this.#cubeRenderTarget.texture; // free PBR ambient/reflections
        }
        */
    }
    #methodCreateTexture()
    {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = this.#colorArray.length;//this.#colorArray.length;// or up to 256                      // vertical gradient; height = smoothness
        const ctx = canvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0); // bottom→top
        const last = Math.max(this.#colorArray.length - 1, 1);
        this.#colorArray.forEach((hex, i) => grad.addColorStop(i / last, hex));  // evenly spaced
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }
    #methodCreateMaterial(texture2D)
    {
        /*
        const res = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
        });

        // we could write this inline...
        // ...but it's more readable this way, I find
        res.uniforms = {
                colorTop: { value: new THREE.Color(this.#colorTop) },
                colorBottom: { value: new THREE.Color(this.#colorBottom) },
            };

        res.vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        res.fragmentShader = `
            uniform vec3 colorTop;
            uniform vec3 colorBottom;
            varying vec2 vUv;
            void main() {
                gl_FragColor = vec4(mix(colorBottom, colorTop, vUv.y), 1.0);
            }
        `;

        return res;
        */

        return new THREE.MeshBasicMaterial({ map: texture2D, side: THREE.BackSide });
    }
    // #endregion slightly more expensive

    // #region cheaper
    #methodApplyTextureEquirectangular() {
        this.#textureEquirectangular = this.#methodCreateTexture();
        this.#textureEquirectangular.mapping = THREE.EquirectangularReflectionMapping;
        this.#textureEquirectangular.minFilter = THREE.LinearFilter; // 1px-wide NPOT: keep sampling simple
        this.#textureEquirectangular.magFilter = THREE.LinearFilter;
        this.methodGetScene().background = this.#textureEquirectangular;
    }
    // #endregion cheaper
    // #endregion private methods
}