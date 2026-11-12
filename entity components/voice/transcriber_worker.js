// this is not "main thread", so we use "self." instead of "this."

// create an event listener for messages
self.onmessage = async (eventObject) =>
{
    const message = eventObject.data;

    switch (message.type)
    {
        case "ping":
            // the "main thread" will have to receive this message
            self.postMessage({ type: "pong", id: message.id });
            break;
        case "load":
            methodHandlerOnLoad(message);
            break;
        case "transcribe":
            console.log("test with the transcribe message.type");
            break;
        default:
            console.warn("unknown message type : " + message.type + " : " + message.id);
            break;
    }
};

// #region privates
// "let" at a module-level is cleaner than "self." (which is in turn, a version of "this.")
let promiseTranscriptionModelResult = null;
let instanceTranscriptionModel = null;
let timestampImportStarted = null;
let timestampImportEnded = null;
// #endregion privates

// #region handlers
async function methodHandlerOnLoad(message)
{
    const returnPromise = methodLoadTranscriptionModelViaManager();
    const returnObject = await returnPromise;
    if(returnObject.model == null)
    {
        self.postMessage
        (
            {
                type: "error",
                code: "load-fail",
                text: returnObject.error,
                id: message.id,
            }
        );
        return;
    }
    const timespanImport =
        (
            (timestampImportEnded - timestampImportStarted)
            / 1000
        )
            .toFixed(1);
    self.postMessage
    (
        {
            type: "ready",
            id: message.id,
            timespan: timespanImport,
        }
    );
}
// #endregion handlers

// #region load model
async function methodLoadTranscriptionModelViaManager()
{
    //
    if(promiseTranscriptionModelResult != null)
    {
        // reminder : our variable is already a Promise
        return await promiseTranscriptionModelResult;
    }

    // reminder :
    // we are getting a Promise here that CONTAINS {model: ..., error: ...}
    // we are not directly getting the object {model: ..., error: ...}
    // and a Promise can be awaited, no matter what it contains
    promiseTranscriptionModelResult = methodLoadTranscriptionModel();

    //
    const resultObject = await promiseTranscriptionModelResult;

    // #region failure
    if(resultObject.model == null)
    {
        // this deletes the "cache"
        // which lets us try again
        promiseTranscriptionModelResult = null;

        // we still return the resultObject, though
        return resultObject;
    }
    // #endregion failure

    // #region success
    instanceTranscriptionModel = resultObject.model;
    return resultObject;
    // #endregion success
}

async function methodLoadTranscriptionModel()
{
    try
    {
        //
        timestampImportStarted = performance.now();

        // we do "dynamic importing"
        // this is because not every user will use local transcription
        // and we don't want to bother them with loading something before they need it
        const module = await import("@huggingface/transformers");
        const pipeline = module.pipeline;

        //
        const promiseTranscriptionModelPipeline = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
        const instanceTranscriptionModelPipeline = await promiseTranscriptionModelPipeline;
        
        // #region finish
        //
        timestampImportEnded = performance.now();
        //
        const timespanImport = ((timestampImportEnded - timestampImportStarted) / 1000).toFixed(1);
        console.log("import and model load took : " + timespanImport + "s");
        //
        return {
            model: instanceTranscriptionModelPipeline,
            error: null
        };
        // #endregion finish
    }
    catch (errorObject)
    {
        //console.error(errorObject);
        return {
            model: null,
            error:
            {
                name: (errorObject?.name ?? "unknown"),
                message: (errorObject?.message ?? ""),
                stack: (errorObject?.stack ?? ""),
            }
        };
    }
}
// #endregion load model