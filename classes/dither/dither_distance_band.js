export class DitherDistanceBand
{
    // #region privates
    //
    #distanceMax = Infinity;
    //
    #level = 3;
    #scale = 3.5;
    #aaSmoothness = 1.5;
    #aaStretch = 0.125;
    #dotRadius = 0.8;
    //
    #returnObject = null;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        //
        if(params.distanceMax != null){this.#distanceMax = params.distanceMax;}
        if(params.level != null){this.#level = params.level;}
        if(params.scale != null){this.#scale = params.scale;}
        if(params.aaSmoothness != null){this.#aaSmoothness = params.aaSmoothness;}
        if(params.aaStretch != null){this.#aaStretch = params.aaStretch;}
        if(params.dotRadius != null){this.#dotRadius = params.dotRadius;}

        // we can pre-create the return object, as well as freeze it...
        // ...because these values do not change after construction
        this.#returnObject = 
        {
            level: this.#level,
            scale: this.#scale, 
            aaSmoothness: this.#aaSmoothness,
            aaStretch: this.#aaStretch,
            dotRadius: this.#dotRadius,
        };
        this.#returnObject = Object.freeze(this.#returnObject);
    }
    // #endregion construct

    // #region getters
    //
    methodGetDistanceMax(){return this.#distanceMax;}
    //
    methodGetLevel(){return this.#level;}
    methodGetScale(){return this.#scale;}
    methodGetAASmoothness(){return this.#aaSmoothness;}
    methodGetAAStretch(){return this.#aaStretch;}
    methodGetDotRadius(){return this.#dotRadius;}
    //
    methodGetParamsObject()
    {
        // we return the object we created in methodInitialize()
        // this only works because we do not change the properties after construction
        return this.#returnObject;
    }
    // #endregion getters
}


export const EnumDistanceRegion = Object.freeze({
    IsWithinNormalRegion: 0,
    IsWithinTailRegion: 1,
    IsOutsideRegion: 2,
});

export class DitherDistanceLadder
{
    // #region privates
    #arrayBands = [];
    #blendRatio = 0.0;
    // #endregion privates

    // #region construct
    constructor(params)
    {
        //
        if(params?.blendRatio != null)
        {
            this.#blendRatio = params.blendRatio;
            // we clamp: ratios lower than 0 make no sense
            // and above 1 might be too high, this is less clear
            if(this.#blendRatio < 0){this.#blendRatio = 0;}
            else if (this.#blendRatio > 1){this.#blendRatio = 1;}
        }

        //
        if(params?.paramsBands != null)
        {
            //
            for(const iteratorBand of params.paramsBands)
            {
                this.methodAddBand(iteratorBand);
            }
        }
    }
    // #endregion construct

    // #region getters
    methodGetBand(index)
    {
        //
        if(index >= (this.#arrayBands.length)){return;}
        if(index < 0){return;}
        if(this.#arrayBands[index] == null){return;}

        //
        return this.#arrayBands[index];
    }

    methodGetDitherParamsAtDistance(distance)
    {
        // early-return
        if(this.#arrayBands == null){return;}
        if(this.#arrayBands.length <= 0){return;}

        // we loop over each band
        // except the last one (because, it is the fallback item)

        // instead of checking the distance directly
        // each band has a region at the tail/end of it...
        // ...that allows us to blend its values...
        // ...with the band AFTER it
        
        // so our distance is either within the nearer/beginning "normal" region...
        // ...in which case we just use the current band's values directly
        // or our distance is within the tail/end "blend region"...
        // ...where we blend between the current band's values...
        // ...with the band AFTER the current band's values

        // if our distance is neither within the normal region, nor the tail/end "blend region"...
        // ...we go to the next iteration, and check the next band

        const lengthExceptLastItem = (this.#arrayBands.length - 1);
        for(var i = 0; i < lengthExceptLastItem; i++)
        {
            //
            const enumDistanceRegion = this.#methodGetDistanceRegion(i, distance);

            switch (enumDistanceRegion)
            {
                case EnumDistanceRegion.IsWithinNormalRegion:
                {
                    // we are within the normal region
                    // (NOT within the tail/end "blend region")
                    // so we just take the params as-is ; no blending
                    return this.#arrayBands[i].methodGetParamsObject();
                    break;
                }
                case EnumDistanceRegion.IsWithinTailRegion:
                {
                    // we are within the tail/end "blend region"
                    // therefore, we... blend!
                    const alpha = this.#methodGetAlpha(i, distance);
                    return this.#methodGetBlendedParamsObject(i, i + 1, alpha);
                    break;
                }
            }
        }

        // we couldn't find an exact match
        // so we pick the last one
        return this.#arrayBands[lengthExceptLastItem].methodGetParamsObject();
    }
    // #endregion getters

    // #region getters : tail/end "blend region"
    #methodGetDistanceRegion(i, distance)
    {
        const tailRegionLowerBound = this.#methodGetTailRegionLowerBound(i);
        const tailRegionUpperBound = this.#methodGetTailRegionUpperBound(i);

        if(distance < tailRegionLowerBound)
        {
            // since distance is below the tail/end region's lower bound
            // we are within the normal region
            return EnumDistanceRegion.IsWithinNormalRegion;
        }
        if(distance < tailRegionUpperBound)
        {
            // since distance is, both:
            // * above the tail/end region's lower bound
            // * below the tail/end region's upper bound
            // meaning that we are within the tail/end "blend region" !
            return EnumDistanceRegion.IsWithinTailRegion;
        }

        // we are within neither
        return EnumDistanceRegion.IsOutsideRegion;
    }
    #methodGetAlpha(i, distance)
    {
        const tailRegionLowerBound = this.#methodGetTailRegionLowerBound(i);
        const tailRegionUpperBound = this.#methodGetTailRegionUpperBound(i);
        const alpha = (distance - tailRegionLowerBound) / (tailRegionUpperBound - tailRegionLowerBound);
        return alpha;
    }
    // #endregion getters : tail/end "blend region"

    // #region getters : calc
    #methodGetTailRegionLowerBound(index)
    {
        // each band has a tail/end "blend region"
        // (except the last band)
        // this method returns the lower/leftmost bound of that region

        // early-return
        if(index < 0){return;}
        if(index >= (this.#arrayBands.length - 1)){return;}

        //
        const iterationBand = this.#arrayBands[index];
        if(iterationBand == null){return;}

        //
        const tailRegionLowerBoundFactor = (1 - this.#blendRatio / 2);
        const tailRegionLowerBound = iterationBand.methodGetDistanceMax() * tailRegionLowerBoundFactor;

        //
        return tailRegionLowerBound;
    }
    #methodGetTailRegionUpperBound(index)
    {
        // each band has a tail/end "blend region"
        // (except the last band)
        // this method returns the upper/rightmost bound of that region

        // early-return
        if(index < 0){return;}
        if(index >= (this.#arrayBands.length - 1)){return;}

        //
        const iterationBand = this.#arrayBands[index];
        if(iterationBand == null){return;}

        //
        const tailRegionUpperBoundFactor = (1 + this.#blendRatio / 2);
        const tailRegionUpperBound = iterationBand.methodGetDistanceMax() * tailRegionUpperBoundFactor;

        //
        return tailRegionUpperBound;
    }
    // #endregion getters : calc

    // #region getters : blend
    #methodLerp(valueFirst, valueSecond, alpha)
    {
        return valueFirst + (valueSecond - valueFirst) * alpha;
    }
    #methodGetBlendedParamsObject(indexFirst, indexSecond, alpha)
    {
        //
        const paramsObjectFirst = this.#arrayBands[indexFirst].methodGetParamsObject();
        const paramsObjectSecond = this.#arrayBands[indexSecond].methodGetParamsObject();

        // we return an object with linear-interpolated (lerped) values
        const returnObject = 
        {
            level: Math.round(this.#methodLerp(paramsObjectFirst.level, paramsObjectSecond.level, alpha)),
            scale: this.#methodLerp(paramsObjectFirst.scale, paramsObjectSecond.scale, alpha),
            aaSmoothness: this.#methodLerp(paramsObjectFirst.aaSmoothness, paramsObjectSecond.aaSmoothness, alpha),
            aaStretch: this.#methodLerp(paramsObjectFirst.aaStretch, paramsObjectSecond.aaStretch, alpha),
            dotRadius: this.#methodLerp(paramsObjectFirst.dotRadius, paramsObjectSecond.dotRadius, alpha),
        };
        return returnObject;
    }
    // #endregion getters : blend

    // #region setters : adders
    methodAddBand(params)
    {
        //
        const newBand = new DitherDistanceBand(params);
        this.#arrayBands.push(newBand);

        // sort based on distanceMax
        // it is possible to break this compareFunc out, for readability
        this.#arrayBands.sort((bandToCompareA, bandToCompareB) =>
            bandToCompareA.methodGetDistanceMax() - bandToCompareB.methodGetDistanceMax()
        );

        // here, we also want to make sure the tail/end "blend regions" do not overlap
        const isOverlap = this.#methodCheckTailRegionOverlap();
        // we only log this error for now
        // bands are created manually, after all, and will have to be edited manually
    }
    // #endregion setters : adders

    // #region getters : overlap
    #methodCheckTailRegionOverlap()
    {
        // we go through the entire list
        // and check all tail/end "blend regions"
        // (we have helpers to get these)

        // since we check in pairs...
        // ...and the final band has no tail/end "blend region"
        // our final index is thusly:
        const indexOfLastValidBand = (this.#arrayBands.length - 2);
        for(var i = 0; i < indexOfLastValidBand; i++)
        {
            //
            const tailRegionUpperBoundFirst = this.#methodGetTailRegionUpperBound(i);
            //
            const tailRegionLowerBoundSecond = this.#methodGetTailRegionLowerBound(i + 1);

            // we check the error case here
            // the upper/rightmost bound of our first band
            // must not be greater than
            // the lower/leftmost bound of the band AFTER it
            // lerp does not like this
            // (also it does not make sense for tail ends of two bands to be that close together; we'd have no "normal region")
            if(!(tailRegionUpperBoundFirst < tailRegionLowerBoundSecond))
            {
                console.error("critical error : tail/end 'blend region' overlap");
                console.log("\t index : ["+ i +"]");
                console.log("\t tailRegionUpperBoundFirst : ["+ tailRegionUpperBoundFirst +"]");
                console.log("\t tailRegionLowerBoundSecond : ["+ tailRegionLowerBoundSecond +"]");
                console.log("\t ratio : ["+ this.#blendRatio +"]");
                return true;
            }
        }
        return false;
    }
    // #endregion getters : overlap
}