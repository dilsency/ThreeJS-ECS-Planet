// imports
import * as THREE from "three";
// ECS
import {EntityComponent} from "../../../classes/ECS/entity_component.js";
// shader
import { createFractalMaterialFromSources, loadFractalShaderSources } from "../../../shaders/Simple_FractalDithering.js";

export class EntityComponentSingletonContextDitherMaterialCache extends EntityComponent
{
    // #region privates
    #promiseShaderSources = null;
    #cacheTextures = new Map();
    // #endregion privates

    // #region construct
    constructor(params)
    {
        super(params);
    }
    // #endregion construct

    // #region lifecycle
    methodInitialize(){}
    methodUpdate(){}
    methodDispose()
    {
        //
        for(const iterationPromise of this.#cacheTextures.values())
        {
            iterationPromise.then((texture) => {
                texture.dispose();
            })
            .catch((errorObject) => {
                console.error(errorObject);
            });
        }
        //
        this.#cacheTextures.clear();
    }
    // #endregion lifecycle

    // #region a
    async methodCreateMaterial(fileTexture, paramObjectMaterial)
    {
        // the following two methods are defined below
        const texture = await this.#methodGetTexture(fileTexture);
        const {vertexShader, fragmentShader} = await this.#methodGetShaderSources();
        //
        return createFractalMaterialFromSources
            (
                vertexShader,
                fragmentShader,
                {
                    ...paramObjectMaterial,
                    map: texture
                }
            );
    }
    // #endregion a

    // #region b
    #methodGetShaderSources()
    {
        if(this.#promiseShaderSources == null)
        {
            this.#promiseShaderSources = loadFractalShaderSources().catch((errorObject) =>
            {
                // undo caching, since we failed
                this.#promiseShaderSources = null;
                // "bubble up" the error into the try/catch that called this function
                throw errorObject;
            });
        }
        return this.#promiseShaderSources;
    }
    #methodGetTexture(fileTexture)
    {
        if(!this.#cacheTextures.has(fileTexture))
        {
            const loader = new THREE.TextureLoader();
            // Resolve texture URL via import.meta.url so Vite will include the asset
            // in the build output. This works in dev and in the production build.
            // Vite only statically bundles `new URL(literal, import.meta.url)` asset
            // references for production builds, so each known texture file needs its
            // own literal branch here rather than a dynamically-built path.
            let texUrl;
            try {
                texUrl = fileTexture === 'texture_checkerboard_alphamask.png'
                    ? new URL('../../../assets/textures/texture_checkerboard_alphamask.png', import.meta.url).href
                    : new URL('../../../assets/textures/texture_checkerboard.png', import.meta.url).href;
            } catch (e) {
                // Fallback: use path relative to server root
                texUrl = 'assets/textures/' + fileTexture;
            }

            //
            const texturePromise =
            new Promise((res, rej) =>
                loader.load(texUrl, res, undefined, rej))
            .catch((errorObject) =>
            {
                // delete texture from cache, since we failed
                this.#cacheTextures.delete(fileTexture);
                // "bubble up" the error into the try/catch that called this function
                throw errorObject;
            });
            this.#cacheTextures.set(fileTexture, texturePromise);
        }
        return this.#cacheTextures.get(fileTexture);
    }
    // #endregion b
}