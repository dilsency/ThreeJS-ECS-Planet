// #region ECS
import { EntityComponent } from "../../classes/ECS/entity_component.js";
// #endregion ECS
// #region enums
import { EnumModeVoiceTranscriber, EnumStateVoiceRecording } from "../../classes/enums.js";
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

        //
        console.log("Local voice transcriber created!");
    }
    // #endregion constructor

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
        
        //
        this.methodDebugPlaySound(objectBlob);

        //
        const channelData = await this.#methodDecode(objectBlob);
        if(channelData == null){return;}
        console.log("sample count : " + channelData.length);
        console.log("sample duration (seconds) : " + (channelData.length / this.#decoderSampleRate).toString());
    }
    methodHandleRecorderOnFinished(e){console.log(e);}
    methodHandleRecorderOnError(e){console.error(e);}
    // #endregion event handlers

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
            this.#handlerOnTranscript(trimmedText);
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
                (text) => this.methodHandleOnTranscript(text),
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
                (text) => this.methodHandleOnTranscript(text),
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
    methodHandleOnTranscript(text)
    {
        //
        const textLowerCase = text.toLowerCase();
        //
        this.methodSendMessageToChat(textLowerCase);
    }
    methodHandleOnEnd(){this.#isRecording = false;}
    methodHandleOnInfo(codeInfo)
    {
        //
        switch(codeInfo)
        {
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