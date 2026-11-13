// #region ECS
import { EntityComponent } from "../../classes/ECS/entity_component.js";
// #endregion ECS
// #region enums
import { ConfigTranscriptionModel, EnumModeVoiceTranscriber, EnumStateVoiceRecording } from "../../classes/enums.js";
// #endregion enums

export class VoiceRecordingLocal
{
    // #region privates
    //
    #stateRecording = EnumStateVoiceRecording.Idle;
    //
    #microphone = null;
    // we need a timer
    // to elongate the "tail end" of a recording
    // if we do not, the last spoken word is usually omitted
    #timerTail = null;
    #timerTailDuration = 300;
    //
    #handlerOnSampled = null;
    #handlerOnFinished = null;
    #handlerOnError = null;
    //
    #instanceMediaRecorder = null;
    #instanceMediaRecorderChunks = [];
    #instanceMediaRecorderBlob = null;
    #instanceMediaRecorderIsCancelled = false;
    //
    #timestampRecordingStarted = null;
    #timestampRecordingEnded = null;
    // #endregion privates

    // #region constructor
    constructor(handlerOnSampled, handlerOnFinished, handlerOnError)
    {
        //
        //super(params);

        //
        this.#handlerOnSampled = handlerOnSampled;
        this.#handlerOnFinished = handlerOnFinished;
        this.#handlerOnError = handlerOnError;

        //
        console.log("Local voice recorder created!");
    }
    // #endregion constructor

    // #region methods
    async methodStartRecording()
    {
        // if state is "Cancelled"
        // that means the player quickly tried to press the button again
        // after they let go of it by accident
        // we COULD undo the "Cancelled" state at this point
        // and change it to its intended "in progress" state
        // and pretend nothing happened
        // this would let the flow progress as usual after the await
        // for now, we do just that
        if(this.#stateRecording == EnumStateVoiceRecording.Cancelled)
        {
            // .Opening is what it would be set to
            // after the await has finished
            // so this is just undoing the .Cancelled state, basically
            this.#stateRecording = EnumStateVoiceRecording.Opening;
            return;
        }

        //
        if(this.#microphone != null){return;}


        // only allowed state is "Idle" (normal)
        if(!(this.#stateRecording == EnumStateVoiceRecording.Idle)){return;}
        this.#stateRecording = EnumStateVoiceRecording.Opening;

        //
        try {
            // this is the asynchronous await part
            // after this we need to check that we haven't changed state...
            // ...to "Cancelled"
            this.#microphone = await navigator.mediaDevices.getUserMedia({audio: true,video:false,});

            // if the state was changed to "Cancelled" while we were waiting...
            // ...(one of the many reasons that this can happen is prematurely letting go of the button)...
            // ...we need to cancel here
            if(this.#stateRecording == EnumStateVoiceRecording.Cancelled)
            {
                //
                this.methodCancelRecording();
                return;
            }

            //
            this.#stateRecording = EnumStateVoiceRecording.Recording;

            // #region MediaRecorder
            //
            this.#instanceMediaRecorder = new MediaRecorder(this.#microphone);

            //
            const handlerMediaRecorderOnDataAvailable = (eventObject) => this.methodHandlerMediaRecorderOnDataAvailable(eventObject);
            this.#instanceMediaRecorder.ondataavailable = handlerMediaRecorderOnDataAvailable;
            const handlerMediaRecorderOnStart = (eventObject) => this.methodHandlerMediaRecorderOnStart(eventObject);
            this.#instanceMediaRecorder.onstart = handlerMediaRecorderOnStart;
            const handlerMediaRecorderOnStop = (eventObject) => this.methodHandlerMediaRecorderOnStop(eventObject);
            this.#instanceMediaRecorder.onstop = handlerMediaRecorderOnStop;
            const handlerMediaRecorderOnError = (eventObject) => this.methodHandlerMediaRecorderOnError(eventObject);
            this.#instanceMediaRecorder.onerror = handlerMediaRecorderOnError;

            //
            this.#instanceMediaRecorder.start();
            // #endregion MediaRecorder
        }
        catch(errorObject)
        {
            //
            console.error(errorObject.message);
            //
            switch(errorObject.name)
            {
                case "NotAllowedError":
                    this.#handlerOnError("not-allowed");
                    break;
                case "NotFoundError":
                case "NotReadableError":
                    this.#handlerOnError("audio-capture");
                    break;
                default:
                    console.error(errorObject.name);
                    break;
            }

            //
            this.methodCancelRecording();
        }
    }
    methodStopRecording()
    {
        // reminder : we are dealing with an async fetch of the microphone
        // by setting the state to cancel, we let it be handled AFTER the await
        if(this.#stateRecording == EnumStateVoiceRecording.Opening)
        {
            // the button was released before the recording had a chance to start
            // so we need to cancel it
            this.#stateRecording = EnumStateVoiceRecording.Cancelled;
            return;
        }

        //
        if(this.#microphone == null){return;}

        //
        this.methodEndRecordingAfterSuccess();
        
    }
    methodDispose()
    {
        // reminder : we are dealing with an async fetch of the microphone
        // by setting the state to cancel, we let it be handled AFTER the await
        if(this.#stateRecording == EnumStateVoiceRecording.Opening)
        {
            this.#stateRecording = EnumStateVoiceRecording.Cancelled;
            return;
        }

        // keep-in-mind :
        // methodDispose() can cancel the MediaRecorder while the latter is still in-process
        // we think this is fine for the moment

        //
        this.methodCancelRecording();
    }
    // #endregion methods

    // #region methods : namehere
    methodCancelRecording()
    {
        // because MediaRecorder is also asyncronous, it needs its own cancel state flag
        this.#instanceMediaRecorderIsCancelled = true;

        // this was not a success, but we reset all the same variables... so...
        this.methodEndRecordingAfterSuccess();
    }
    methodEndRecordingAfterSuccess()
    {
        //
        if(this.#instanceMediaRecorder?.state == "recording")
        {
            this.#instanceMediaRecorder.stop();
        }

        //
        this.#microphone?.getTracks().forEach(track => track.stop());

        //
        this.#microphone = null;
        //
        this.#stateRecording = EnumStateVoiceRecording.Idle;

        //
        this.#handlerOnFinished(this);
    }
    // #endregion methods : namehere

    // #region event listeners : MediaRecorder
    methodHandlerMediaRecorderOnDataAvailable(eventObject)
    {
        if (eventObject.data.size > 0)
        {
            this.#instanceMediaRecorderChunks.push(eventObject.data);
        }
    }
    methodHandlerMediaRecorderOnStart(eventObject)
    {
        //
        this.#timestampRecordingStarted = performance.now();
    }
    methodHandlerMediaRecorderOnStop(eventObject)
    {
        //
        if(this.#instanceMediaRecorderIsCancelled)
        {
            // clear blob
            this.#instanceMediaRecorderBlob = null;
            return;
        }
        
        //
        this.#instanceMediaRecorderBlob = new Blob(this.#instanceMediaRecorderChunks, { type: this.#instanceMediaRecorder.mimeType });

        // we need to nope-out early if we the blob size is too small
        if(this.#instanceMediaRecorderBlob.size == 0)
        {
            // clear blob
            this.#instanceMediaRecorderBlob = null;
            return;
        }
        
        //
        this.#timestampRecordingEnded = performance.now();

        //
        this.#handlerOnSampled(this.#instanceMediaRecorderBlob, this.#timestampRecordingStarted, this.#timestampRecordingEnded);
    }
    methodHandlerMediaRecorderOnError(eventObject)
    {
        //
        console.error(eventObject.error?.name);

        //
        this.#handlerOnError("audio-capture");

        // the following noteworthingly flags the MediaRecorder as being cancelled
        this.methodCancelRecording();
    }
    // #endregion event listeners : MediaRecorder
}

export class VoiceRecordingManagerLocal
{
    // #region privates
    //
    #currentRecording = null;
    //
    #handlerOnSampled = null;
    #handlerOnFinished = null;
    #handlerOnError = null;
    // #endregion privates

    // #region construct
    constructor(handlerOnSampled, handlerOnFinished, handlerOnError)
    {
        //
        this.#handlerOnSampled = handlerOnSampled;
        this.#handlerOnFinished = (e) => {
            this.methodHandleOnFinished(e);
            handlerOnFinished(e);
        };
        this.#handlerOnError = handlerOnError;
    }
    // #endregion construct
    

    // #region methods
    methodStartRecording()
    {
        if(this.#currentRecording != null)
        {
            this.#currentRecording.methodStartRecording();
            return;
        }

        this.#currentRecording =
            new VoiceRecordingLocal
            (
                this.#handlerOnSampled,
                this.#handlerOnFinished,
                this.#handlerOnError
            );
        
            this.#currentRecording.methodStartRecording();
    }
    methodStopRecording()
    {
        this.#currentRecording?.methodStopRecording();
    }
    methodDispose()
    {
        this.#currentRecording?.methodDispose();
        this.#currentRecording = null;
    }
    // #endregion methods

    // #region event listeners
    methodHandleOnFinished(eventObject)
    {
        if(eventObject == this.#currentRecording)
        {
            this.#currentRecording = null;
        }
    }
    // #endregion event listeners
}

export class VoiceTranscriberLocal
{
    // #region privates
    //
    #counter = 0;
    //
    #language = null;
    //
    #instanceVoiceRecognizer = null;
    //
    #instanceVoiceRecorder = null;
    //
    #instanceVoiceRecordingManager = null;
    //
    #handlerOnTranscript = null;
    #handlerOnEnd = null;
    #handlerOnInfo = null;
    #handlerOnError = null;
    //
    #handlerRecorderOnSampled = null;
    #handlerRecorderOnFinished = null;
    #handlerRecorderOnError = null;
    // decoder
    #decoderSampleRate = 16000;
    #decoderMaxDuration = 10.0;
    #decoderMinDuration = 0.1;
    //
    #recordingLengthMinimum = 250;
    //
    #timestampImportStarted = null;
    #timestampImportEnded = null;
    #promiseTranscriptionModel = null;
    #instanceTranscriptionModel = null;
    // worker
    #instanceWorker = null;
    // #endregion privates

    // #region constructor
    constructor(stringLanguage, handlerOnTranscript, handlerOnEnd, handlerOnInfo, handlerOnError)
    {
        //
        //super(params);

        //
        this.#language = stringLanguage;
        //
        this.#handlerOnTranscript = handlerOnTranscript;
        this.#handlerOnEnd = handlerOnEnd;
        this.#handlerOnInfo = handlerOnInfo;
        this.#handlerOnError = handlerOnError;

        //
        this.#handlerRecorderOnSampled = (objectBlob, timestampRecordingStarted, timestampRecordingEnded) => this.methodHandleRecorderOnSampled(objectBlob, timestampRecordingStarted, timestampRecordingEnded);
        this.#handlerRecorderOnFinished = (e) => this.methodHandleRecorderOnFinished(e);
        this.#handlerRecorderOnError = (e) => this.methodHandleRecorderOnError(e);
        
        //
        //this.#instanceVoiceRecorder = new VoiceRecorderLocal(this.#handlerRecorderOnComplete, this.#handlerRecorderOnError);

        //
        this.#instanceVoiceRecordingManager =
            new VoiceRecordingManagerLocal
            (
                this.#handlerRecorderOnSampled,
                this.#handlerRecorderOnFinished,
                this.#handlerRecorderOnError
            );

        // #region worker : init
        // this exact URL pattern is for Vite to be able to bundle it correctly
        this.#instanceWorker
        = new Worker
        (
            new URL
            (
                "./transcriber_worker.js",
                import.meta.url
            ),
            { type: "module" }
        );
        // event listener
        this.#instanceWorker.onmessage = (eventObject) =>
        {
            const message = eventObject.data;

            switch(message.type)
            {
                case "ping":
                    console.log("a ping was received, but we were to receive a pong... hmm... id : " + message.id);
                    break;
                case "pong":
                    console.log("a pong was received! nice! id : " + message.id);
                    break;
                case "download":
                    // we know at this point that we do not have a cached transcription model
                    // we can therefore delete the localStorage item
                    this.methodRemoveLocalStorage();
                    //
                    this.#handlerOnInfo("load-model-begin");
                    break;
                case "ready":
                    // in localStorage...
                    // ...we store whether or not the transcription model is cached
                    // either the storage item exists, so it is cached
                    // or it does not exist, so it is not cached
                    // we store the model id instead of just "true"
                    this.methodSetLocalStorage();
                    //
                    if(message.firstDownload)
                    {
                        //
                        this.#handlerOnInfo("load-model-finished-first-time");
                    }
                    this.#handlerOnInfo("load-model-finished-any-time");
                    break;
                case "progress":
                    this.#handlerOnInfo("transcribe-progress");
                    break;
                case "result":
                    //console.log(message.text);
                    this.#handlerOnTranscript(message.text, message.timespan);
                    break;
                case "error":
                    console.log("error");
                    break;
                default:
                    console.warn("unknown message type : " + message.type + " : " + message.id);
                    break;
            }
        };
        // #endregion worker : init

        // #region worker : start
        // this will just send an informative message
        //this.#handlerOnInfo("load-model-begin");
        // trigger the worker to begin loading the model
        // we pass along the model id as a parameter..,
        // so that the worker can be without imports
        this.#instanceWorker.postMessage
        (
            {
                type:"load",
                id: 1,
                modelId: ConfigTranscriptionModel.Id,
            }
        );
        // #endregion worker : start

        //
        console.log("Local voice transcriber created!");
    }
    // #endregion constructor

    // #region localStorage
    methodRemoveLocalStorage()
    {
        try {
            //const item = localStorage.getItem(ConfigTranscriptionModel.LocalStorage);
            //if(item == null){return;}
            localStorage.removeItem(ConfigTranscriptionModel.LocalStorage);
        }
        catch(errorObject)
        {
            console.error(errorObject);
        }
    }
    methodSetLocalStorage()
    {
        try {
            localStorage.setItem(ConfigTranscriptionModel.LocalStorage, ConfigTranscriptionModel.Id);
        }
        catch(errorObject)
        {
            console.error(errorObject);
        }
    }
    // #endregion localStorage

    // #region methods
    methodStartRecording()
    {
        //
        //this.#instanceVoiceRecorder?.methodStartRecording();
        this.#instanceVoiceRecordingManager?.methodStartRecording();
    }
    methodStopRecording()
    {
        //
        //this.#instanceVoiceRecorder?.methodStopRecording();
        this.#instanceVoiceRecordingManager?.methodStopRecording();
    }
    methodDispose()
    {
        //
        //this.#instanceVoiceRecorder?.methodDispose();
        //this.#instanceVoiceRecorder = null;
        //
        this.#instanceVoiceRecordingManager?.methodDispose();
        this.#instanceVoiceRecordingManager = null;
        //
        this.#instanceWorker?.terminate();
        this.#instanceWorker = null;
    }
    // #endregion methods

    // #region event handlers
    async methodHandleRecorderOnSampled(objectBlob, timestampRecordingStarted, timestampRecordingEnded)
    {
        //
        if(objectBlob == null){return;}
        if(objectBlob.size < 1){return;}
        //
        if((timestampRecordingEnded - timestampRecordingStarted) < this.#recordingLengthMinimum){return;}
        
        // #region debug only
        //this.methodDebugPlaySound(objectBlob);
        // #endregion debug only

        // #region decoder
        const channelData = await this.#methodDecode(objectBlob);
        if(channelData == null){return;}
        console.log("sample count : " + channelData.length);
        console.log("sample duration (seconds) : " + (channelData.length / this.#decoderSampleRate).toString());
        // #endregion decoder

        // #region communicate with the worker
        this.#instanceWorker?.postMessage
        (
            {
                type: "transcribe",
                id: this.#counter,
                audiosamples: channelData,
            },
            [channelData.buffer],
        );
        this.#counter++;
        // #endregion communicate with the worker

        /*
        // #region lazy-load transcription model
        //
        //await this.#methodLazyLoadTranscriptionModel();
        if(this.#instanceTranscriptionModel == null)
        {
            console.error("no transcription model");
            return;
        }
        // and then we use it... fingers crossed
        try {
            const timestampInferenceStarted = performance.now();
            const objectResult = await this.#instanceTranscriptionModel(channelData);
            const timestampInferenceEnded = performance.now();
            const timespanInference = ((timestampInferenceEnded - timestampInferenceStarted) / 1000).toFixed(1);
            console.log(objectResult.text + " ("+ timespanInference +"s)");
            this.#handlerOnTranscript(objectResult.text + " ("+ timespanInference +"s)");
        }
        catch(errorObject)
        {
            console.error(errorObject);
        }
        // #endregion lazy-load transcription model
        */
    }
    methodHandleRecorderOnFinished(e){console.log(e);}
    methodHandleRecorderOnError(e){console.error(e);}
    // #endregion event handlers

    // #region debug only
    methodDebugPlaySound(objectBlob)
    {
        if(objectBlob == null){return;}

        const url = URL.createObjectURL(objectBlob);
        const audio = new Audio(url);
        audio.play();
        audio.onended = () => {
            URL.revokeObjectURL(url);
        }
    }
    // #endregion debug only

    // #region decoder
    async #methodDecode(objectBlob)
    {
        var audioContext = null;
        var channelData = null;
        try
        {
            const arrayBuffer = await objectBlob.arrayBuffer();
            audioContext = new AudioContext({sampleRate: this.#decoderSampleRate});
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            console.log("sample rate : " + audioBuffer.sampleRate);
            // we only use the first channel (microphones only use 1)
            channelData = audioBuffer.getChannelData(0).slice();
            const channelDataMaxLength = (this.#decoderSampleRate * this.#decoderMaxDuration);
            const channelDataMinLength = (this.#decoderSampleRate * this.#decoderMinDuration);
            if(channelData.length > channelDataMaxLength)
            {
                //
                channelData = channelData.slice(0, channelDataMaxLength);
                // todo to-do to do : invoke a special callback/handler here, that notifies the player in the chat list
                // handlerOnInfo or handlerOnInform or handlerOnWarn or something
                // we can reuse the old one, for now
                this.#handlerOnInfo("too-long");
            }
            else if(channelData.length < channelDataMinLength)
            {

                this.#handlerOnInfo("too-short");
                channelData = null;
            }
        }
        catch(errorObject)
        {
            console.error(errorObject);
        }
        finally {
            audioContext?.close();
        }

        return channelData;
    }
    // #endregion decoder

    // #region lazy-load transcription model
    async #methodLazyLoadTranscriptionModel()
    {
        // this function is a layer above the actual body function
        // an "operator" or "manager" function
        // the only reason why we do this
        // is so that we can store the promise of an async method
        // and store the awaited async method
        // separately

        // if promise is not null, we are still loading
        // what we can do is await that very same promise
        // (won't this invoke it twice?)
        // (if it will, is that fine?)
        if(this.#promiseTranscriptionModel != null)
        {
            await this.#promiseTranscriptionModel;
            return;
        }

        // by calling the loading method, WITHOUT AWAITING, we will receive a promise
        // and we use this to check above if we are still loading
        this.#promiseTranscriptionModel = this.#methodLoadTranscriptionModel();

        // now that we have stored it
        // we can await it
        // and store that result
        // (also, apparently you don't place parentheses after a promise (it is not a function invocation))
        this.#instanceTranscriptionModel = await this.#promiseTranscriptionModel;

        // #region failure
        if(this.#instanceTranscriptionModel == null)
        {
            this.#promiseTranscriptionModel = null;
        }
        // #endregion failure
    }
    async #methodLoadTranscriptionModel()
    {
        try
        {
            //
            this.#timestampImportStarted = performance.now();

            // we do "dynamic importing"
            // this is because not every user will use local transcription
            // and we don't want to bother them with loading something before they need it
            const module = await import("@huggingface/transformers");
            const pipeline = module.pipeline;

            //
            const promiseTranscriptionModel = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
            const instanceTranscriptionModel = await promiseTranscriptionModel;
            
            // #region finish
            //
            this.#timestampImportEnded = performance.now();
            //
            const timespanImport = ((this.#timestampImportEnded - this.#timestampImportStarted) / 1000).toFixed(1);
            console.log("import and model load took : " + timespanImport + "s");
            //
            return instanceTranscriptionModel;
            // #endregion finish
        }
        catch (errorObject)
        {
            console.error(errorObject);
            return null;
        }
    }
    // #endregion lazy-load transcription model

    // #region getters
    methodGetIsSupported()
    {
        // temporary re-flagging
        // when this class has been fully implemented...
        // ...we remove the upper return
        return true;
        //return !(this.#instanceVoiceRecognizer == null);
        return !(this.#instanceVoiceRecordingManager == null);
    }
    // #endregion getters
}

export class VoiceTranscriberCloud
{
    // #region privates
    #language = null;
    #isRecording = false;
    // we need a timer
    // to elongate the "tail end" of a recording
    // if we do not, the last spoken word is usually omitted
    #timerTail = null;
    #timerTailDuration = 300;
    //
    #instanceVoiceRecognizer = null;
    //
    #handlerOnTranscript = null;
    #handlerOnEnd = null;
    #handlerOnError = null;
    // #endregion privates

    // #region constructor
    constructor(stringLanguage, handlerOnTranscript, handlerOnEnd, handlerOnError)
    {
        //
        //super(params);

        //
        this.#language = stringLanguage;
        //
        this.#handlerOnTranscript = handlerOnTranscript;
        this.#handlerOnEnd = handlerOnEnd;
        this.#handlerOnError = handlerOnError;

        // Chrome and Edge only; Firefox has no SpeechRecognition
        const classSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if(classSpeechRecognition == null){return;}

        //
        this.#instanceVoiceRecognizer = new classSpeechRecognition();

        //
        this.#instanceVoiceRecognizer.continuous = true;
        this.#instanceVoiceRecognizer.interimResults = false;
        this.#instanceVoiceRecognizer.lang = this.#language;

        //
        this.#instanceVoiceRecognizer.onresult = (event) => this.methodHandleOnTranscript(event);
        this.#instanceVoiceRecognizer.onend = (event) => this.methodHandleOnEnd(event);
        this.#instanceVoiceRecognizer.onerror = (event) => this.methodHandleOnError(event);
    }
    // #endregion constructor

    // #region methods
    methodStartRecording()
    {
        //
        if(this.#instanceVoiceRecognizer == null){console.log("this.#instanceVoiceRecognizer == null");return;}
        
        // it is possible that we are still recording
        // via the timer that records the "tail end" of a spoken line
        // in this instance, we want to KEEP recording...
        // ...instead of "fading out"
        if(this.#timerTail != null)
        {
            //
            clearTimeout(this.#timerTail);
            this.#timerTail = null;

            //
            return;
        }

        //
        if(this.#isRecording){return;}

        try {
            this.#instanceVoiceRecognizer.start();
            this.#isRecording = true;
        }
        catch(errorObject){
            console.error(errorObject);
        }
    }
    methodStopRecording()
    {
        if(!this.#isRecording){return;}

        // we actually want to wait a few deciseconds before we stop
        // otherwise the last word is usually omitted

        // if we are already in timeout, do nothing
        if(this.#timerTail != null){return;}

        //
        this.#timerTail = setTimeout(() => {
            this.#timerTail = null;
            this.#instanceVoiceRecognizer.stop();
        }, this.#timerTailDuration);

        // we clear it in the event handler instead
        //this.#isRecording = false;
    }
    methodDispose()
    {
        // timer
        clearTimeout(this.#timerTail);
        this.#timerTail = null;

        //
        if(this.#instanceVoiceRecognizer != null)
        {
            //
            this.#instanceVoiceRecognizer.onresult = null;
            this.#instanceVoiceRecognizer.onend = null;
            this.#instanceVoiceRecognizer.onerror = null;

            //
            this.#instanceVoiceRecognizer.abort();

            //
            this.#instanceVoiceRecognizer = null;
        }

        // handlers
        this.#handlerOnTranscript = null;
        this.#handlerOnEnd = null;
        this.#handlerOnError = null;

        //
        this.#isRecording = false;
    }
    // #endregion methods

    // #region getters
    methodGetIsSupported(){return !(this.#instanceVoiceRecognizer == null);}
    // #endregion getters

    // #region event handlers
    methodHandleOnTranscript(eventObject)
    {
        //
        const startIndex = eventObject.resultIndex;
        const endIndex = eventObject.results.length;

        //
        for(var i = startIndex; i < endIndex; i++)
        {
            const iteration = eventObject.results[i];
            if(!iteration.isFinal){continue;}

            const trimmedText = iteration[0].transcript.trim();
            if(trimmedText.length <= 0){console.log("empty transcript");continue;}

            //
            console.log(trimmedText);
            // do we not have a timespan this point?
            this.#handlerOnTranscript(trimmedText, null);
        }
    }
    methodHandleOnEnd()
    {
        //
        this.#isRecording = false;

        //
        clearTimeout(this.#timerTail);
        this.#timerTail = null;

        //
        this.#handlerOnEnd();
    }
    methodHandleOnError(eventObject)
    {
        //
        this.#isRecording = false;
        //
        console.log(eventObject.error);

        //
        clearTimeout(this.#timerTail);
        this.#timerTail = null;

        //
        this.#handlerOnError(eventObject.error);
    }
    // #endregion event handlers
}
export class EntityComponentVoiceTranscriber extends EntityComponent
{
    // #region privates
    #isRecording = false;
    //
    #language = "en-US";
    //
    #entityComponentContextVoice = null;
    //
    #swappableTranscriber = null;
    #swappableTranscriberModePrevious = null;
    //
    #hasIssuedWarning = false;
    // #endregion privates

    // #region constructor
    constructor(params)
    {
        super(params);
    }
    // #endregion constructor

    // #region lifecycle
    methodInitialize()
    {
        //
        this.#entityComponentContextVoice = 
            this.methodGetEntityByName("SingletonContextChat")
                ?.methodGetComponent("EntityComponentSingletonContextVoice");

        //
        this.methodSetTranscriber(this.#entityComponentContextVoice?.methodGetMode());
    }
    // #endregion lifecycle

    // #region setters
    methodSetTranscriber(mode)
    {
        //
        if(mode == null){return;}
        if(mode === this.#swappableTranscriberModePrevious) { return; }

        //
        this.#swappableTranscriber?.methodStopRecording();
        this.#swappableTranscriber?.methodDispose();

        //
        this.#isRecording = false;

        //
        if(mode === EnumModeVoiceTranscriber.Cloud)
        {
            // reminder: we need to either write .bind(this) when it comes to callback
            // or do the arrow syntax
            this.#swappableTranscriber = new VoiceTranscriberCloud(
                this.#language,
                (text, timespan) => this.methodHandleOnTranscript(text, timespan),
                () => this.methodHandleOnEnd(),
                (codeError) => this.methodHandleOnError(codeError),
            );

            // for cloud services
            // we can issue a one-time warning
            if(!this.#hasIssuedWarning)
            {
                this.methodSendMessageToChatWithLifespan("Warning! Cloud-based transcriptions come with privacy issues. Use at your own discretion.", 15);
                this.#hasIssuedWarning = true;
            }
        }
        else if(mode === EnumModeVoiceTranscriber.Local)
        {
            //this.methodSendMessageToChatWithUsername("Local transcription has not yet been implemented. Please select Cloud, instead.", null);

            // reminder: we need to either write .bind(this) when it comes to callback
            // or do the arrow syntax
            this.#swappableTranscriber = new VoiceTranscriberLocal(
                this.#language,
                (text, timespan) => this.methodHandleOnTranscript(text, timespan),
                () => this.methodHandleOnEnd(),
                (codeInfo) => this.methodHandleOnInfo(codeInfo),
                (codeError) => this.methodHandleOnError(codeError),
            );
        }
        else if (mode === EnumModeVoiceTranscriber.None)
        {
            this.#swappableTranscriber = null;
        }
        else {
            console.error("invalid transcriber mode");
        }

        //
        this.#swappableTranscriberModePrevious = mode;
    }
    // #endregion setters

    // #region invokable callbacks
    methodHandleOnTranscript(text, timespan)
    {
        //
        const textLowerCase = text.toLowerCase();
        //
        this.methodSendMessageToEntitiesWithComponent("EntityComponentChatList",
            {
                "invokableHandlerName": "chat.message",
                "invokableHandlerValue":
                {
                    "username": null,
                    "text": textLowerCase,
                    "timeLife": 10,
                    "timeSpan": timespan,
                }
            }
        );
    }
    methodHandleOnEnd(){this.#isRecording = false;}
    methodHandleOnInfo(codeInfo)
    {
        //
        switch(codeInfo)
        {
            case "load-model-begin":
                this.methodSendMessageToChatWithLifespan("Begin loading model (" + ConfigTranscriptionModel.Size + ")...", 3);
                break;
            case "load-model-finished-first-time":
                this.methodSendMessageToChatWithLifespan("Finished loading model (" + ConfigTranscriptionModel.Size + ")!", 3);
                break;
            case "load-model-finished-any-time":
                // this should perhaps be its own callback function, instead of inside methodHandleOnInfo()
                this.methodSendMessageToEntitiesWithComponent
                (
                    "EntityComponentMainMenu",
                    {
                        "invokableHandlerName": "mainmenu.update",
                        "invokableHandlerValue":
                        {
                            
                        }
                    }
                );
                break;
            case "transcribe-progress":
                this.methodSendMessageToChatWithLifespan("Progress?", 3);
                break;
            case "too-long":
                this.methodSendMessageToChatWithLifespan("Voice clips longer than 10 seconds will be clipped.", 3);
                break;
            case "too-short":
                //this.methodSendMessageToChatWithLifespan("Voice clips need to be longer than " + this.#recordingLengthMinimum + " milliseconds.", 3);
                break;
        }
    }
    methodHandleOnError(codeError)
    {
        //
        switch(codeError)
        {
            case "not-allowed":
                this.methodSendMessageToChatWithLifespan("error: microphone not allowed", 15);
                break;
            case "audio-capture":
                this.methodSendMessageToChatWithLifespan("error: faulty audio capture", 15);
                break;
        }
    }
    // #endregion invokable callbacks

    // #region methods
    methodStartRecording()
    {
        //
        if(this.#swappableTranscriber == null){console.log("this.#swappableTranscriber == null");return;}
        if(!this.#swappableTranscriber.methodGetIsSupported()){return;}

        //
        this.#swappableTranscriber.methodStartRecording();
        //
        this.#isRecording = true;
    }
    methodStopRecording()
    {
        //
        if(this.#swappableTranscriber == null){return;}

        //
        this.#swappableTranscriber.methodStopRecording();
        // we clear this via callback, instead
        //this.#isRecording = false;
    }
    // #endregion methods
}