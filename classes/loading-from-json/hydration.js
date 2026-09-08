// hydration.js and registry.js are used to...
// ...turn a string name into a class reference
// we use hydration.js to change a string that represents a complex type of a parameter...
// ...into the actual type
// such as THREE.Vector3
// from "$vec3"

// base import
import * as THREE from "three";


export function hydrateParams(value)
{
    // our input value contains both
    // the string that represents the type
    // and the actual value

    // #region early return
    // we just pass through / pass on certain values
    // such as null, undefined, and primitive types
    if(value == null){return value;}
    else if (typeof value !== "object"){return value;}
    // #endregion early return

    // #region precalculation
    // we check if the object is an array
    const isArray = Array.isArray(value);
    // we check if the object has a key that starts with the $ character
    const tagKey = Object.keys(value).find((key) => key.startsWith("$"));
    // if isArray == true OR tagKey == null, then we need to recursively iterate
    // though in slightly different ways
    // #endregion precalculation

    // #region recursive
    // if we have an array as a value instead of an object
    // we call this very same function again
    // recursively
    // this lets us break down each individual type
    // we use the .map function to do this
    if(isArray)
    {
        return value.map((item) => hydrateParams(item));
        // I think we can also write
        // return value.map(hydrateParams);
        // but let's be verbose and more clear
    }
    if(tagKey == null)
    {
        // we have a regular object
        // we need to iterate through each key-value pair
        // and call this very same function again
        // recursively
        const hydratedObject = {};
        for(const [key, val] of Object.entries(value))
        {
            hydratedObject[key] = hydrateParams(val);
        }
        return hydratedObject;
    }
    // #endregion recursive

    // #region body
    if(tagKey != null){return hydrateTaggedObject(value, tagKey);}
    // #endregion body
}

function hydrateTaggedObject(value, tagKey)
{
    // we have a tagged object
    // we need to check the tagKey
    // and then hydrate the value accordingly

    switch(tagKey)
    {
        case "$vec3":
        {
            const v = value["$vec3"];
            return new THREE.Vector3(v.x, v.y, v.z);
        }
        case "$ref":
            // untouched
            // resolved by the component at runtime (lazy dependency resolution)
            // not by the loader.
            return value;
        default:
            //console.error(`hydrateParams: unknown tag "${tagKey}"`);
            throw new Error(`hydrateParams: unknown tag "${tagKey}"`);
    }
}