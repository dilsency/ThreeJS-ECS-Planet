# Local (offline) voice transcription: plan of approach

Companion to TODO item 21 in `TODO_ECS_PLANET.md`. That item lists the hurdles; this file is the order of work.

## Goal

Push-to-talk (V) with the Main Menu mode set to `Local` transcribes speech on the user's device and posts the text
to the chat list, with no audio sent to a cloud service.

## Where we start

- `VoiceTranscriberLocal` in `entity components/voice/transcriber.js` is a stub. Its `methodGetIsSupported()` returns `false`.
- The wrapper (`EntityComponentVoiceTranscriber`), the mode switch (`methodSetTranscriber`), the Main Menu radio
  button and the chat output already exist and work for `Cloud`.
- The Local class must match the Cloud class's shape: constructor `(language, onTranscript, onEnd, onError)`, and
  `methodStartRecording`, `methodStopRecording`, `methodDispose`, `methodGetIsSupported`.

## Guiding rule: the app is never broken

`methodGetIsSupported()` stays `false` until chunk 4. Until then, selecting `Local` behaves exactly as it does today:
pressing V does nothing. Every chunk below ends in a state that can be committed and pushed.
Chunks 1-3 are invisible to players, so stopping after any of them leaves nothing half-finished.

## Decisions to make before starting

| Decision | Options | Lean |
|---|---|---|
| Library | transformers.js (`@huggingface/transformers`) vs whisper.cpp WASM | transformers.js: a few lines to run, WebGPU option |
| Model | `Xenova/whisper-tiny.en` (~40 MB) vs `base.en` (~75 MB) | start with tiny, compare in chunk 7 |
| Language | English only (already decided) | `.en` models |
| Audio capture | `MediaRecorder` vs `AudioContext` + `AudioWorklet` | **Decided: `MediaRecorder`**, then decode and resample. Transcription is batch (the whole clip after V is released), so live samples are not needed. No voice-level animation is planned either. |
| When to load the model | on selecting `Local` vs on first V press | on selecting `Local` (chunk 5) |

## Chunks

### Chunk 1: mic capture to PCM (no model)
- While V is held, record the microphone; on release (after the tail delay, see TODO item 19), produce a
  16 kHz mono `Float32Array`.
- Capture with `MediaRecorder` (decided): it yields a compressed clip (webm/opus in Chrome and Firefox, mp4 in Safari).
- Then `decodeAudioData` to get raw samples, mix to mono, and resample to 16 kHz (an offline audio context can do this).
- `getUserMedia({ audio: true })` for the stream.
- **Decided: the stream is open only while V is held.** Open it on press; stop every track on release (after the
  tail delay). Reason: privacy. The browser's mic indicator must not stay lit when the player is not interacting.
  Do not keep an idle stream open when `Local` is selected.
- **Startup lag:** `getUserMedia` takes a moment per press (usually well under half a second once permission is
  granted), so the first syllable can be clipped. The recording indicator (shown only once capture is live) tells
  the player when to speak. A short "ready" cue is a possible later addition.
- **Race at release:** if V is released before the stream has finished opening, stop the late stream as soon as it
  arrives. Otherwise the mic stays on with nobody recording.
- **Second press during the tail delay:** decide between reusing the still-open stream (as Cloud does) and closing
  and reopening it. Reusing is simpler and avoids another startup lag.
- The permission prompt appears only the first time per site; the browser remembers it afterwards (as with Cloud).
- **Decided: a minimum loudness gate, not a minimum clip length.** Whisper invents text on silence or noise
  (for example "Thank you." or `[BLANK_AUDIO]`). Measure the loudness (RMS of the whole clip, or the peak) on the
  decoded `Float32Array`; it costs almost nothing. Clips below the threshold never reach the model.
  Short lines such as "Yes." and "No." must keep working (about 0.3-0.5 s of speech plus the tail delay), so there is
  no minimum length as a quality gate. At most a tiny floor (about 0.2-0.3 s) to discard accidental V taps.
- **Decided: maximum clip length is 10 seconds, applied by cutting, not by auto-stopping.** The player may keep
  recording as long as V is held. After decode and resample, keep only the first 10 seconds (160,000 samples at
  16 kHz) and discard the rest, before the loudness gate and before anything goes to the model. Whisper works on
  30-second windows, so 10 s is well inside it, and it bounds inference time and memory per clip.
  Keep the first 10 s, not the last: speech starts at the beginning.
- **Tell the player when a clip is cut:** a brief chat message (for example "Clip cut to 10 s") via
  `methodSendMessageToChatWithLifespan`, so the loss is not silent.
- **Tuning the threshold:** mics differ, so there is no universal value. Log each clip's loudness in the dev log,
  then pick a fixed value from real recordings (quiet speech vs silence vs keyboard noise). Adapting to each mic's
  noise floor can wait.
- Inside `VoiceTranscriberLocal`, behind a temporary dev log. `methodGetIsSupported()` stays `false` for players.
- **Done when:** the console shows a sample count that matches the held duration, a playback test sounds right,
  and the browser's mic indicator goes off after release (nothing still holds the mic).
- **Risk:** low. Mic permission over Remote Desktop works, as it did for Cloud.

### Chunk 2: model spike, standalone
- Add the transformers.js dependency.
- A throwaway dev-only script: take a recorded or fixed clip, run
  `pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en")`, print the text.
- No ECS, no worker, not wired into the app.
- Import the library dynamically so the main bundle does not grow.
- **Done when:** a known clip produces a correct transcript, and we have measured load time and inference time.
- **Risk:** low-medium. This answers "does Whisper run in our setup, and how fast?" Decide here whether WebGPU is worth it.

### Chunk 3: worker plus message protocol
- Move inference into a Web Worker so the render loop never stalls.
- Messages: `load`, `progress`, `ready`, `transcribe`, `result`, `error`.
- **Decided: overlapping clips are queued, in order.** Each clip is posted as its own `transcribe` message with an id.
  A worker handles messages one at a time, so the browser queues them for us (no queue code of our own); the id matches
  each `result` to its clip, so chat order stays correct. Dropping or cancelling would lose what the player said.
  Cost: waiting stacks (three clips at about 2 s each means the third text appears after about 6 s). If that ever
  feels too slow, add a cap on waiting clips (for example 3).
- Test with the same fixed clip, still not wired to V.
- Verify that Vite bundles the worker, in `npm run dev`, in the production build, **and** on GitHub Pages
  (`base: '/ThreeJS-ECS-Planet/'`). Deploy once to check.
- **Done when:** the worker transcribes the fixed clip in the deployed build.
- **Risk:** highest. Worker bundling and asset paths are where this usually breaks.

### Chunk 4: wire it together
- `VoiceTranscriberLocal`: capture (chunk 1) to worker (chunk 3) to `#handlerOnTranscript`.
- Flip `methodGetIsSupported()` to `true` (when the worker and `getUserMedia` exist).
- Apply the loudness gate (chunk 1) before posting a clip to the worker.
- Backup filter: drop outputs that are only known junk, such as `[BLANK_AUDIO]` or a bare "thank you" from a very
  quiet clip. It catches what the gate misses.
- First user-visible moment. The model downloads on first use, so it may feel stuck. Do chunk 5 right after,
  ideally in the same push.
- **Done when:** with `Local` selected, holding V and releasing posts the transcript to the chat.

### Chunk 5: loading and progress UX
- Chat notices: "Downloading speech model (40 MB)", then progress such as "40%", then "transcribing...", "ready".
- The Main Menu radio button is labelled "Local (40 MB)" (decided), so the download size is visible before choosing it.
  The label text must be separate from the enum value, which stays `"Local"`. Update the size if the model changes.
- Start loading when `Local` is selected, not on the first V press.
- Use `methodSendMessageToChatWithLifespan`; a progress line may need replacing instead of stacking (decide).
- **Done when:** a first-time user sees what is happening at every step.

### Chunk 6: lifecycle and errors
- `methodDispose` terminates the worker and stops all mic stream tracks (the stream only exists while V is held,
  but dispose must still cover a stream that is mid-open or in the tail delay).
- Switching mode away from `Local` mid-download or mid-transcription cancels cleanly.
- Errors through `#handlerOnError`: mic denied, download failed, no WebAssembly / WebGPU. Map them to the same
  chat messages style as Cloud.
- A very short tap (no audio) must not call the model.
- **Done when:** switching modes repeatedly leaves no worker or mic stream behind (check in devtools).

### Chunk 7: polish, any order
- Compare `tiny.en` and `base.en` for quality against latency.
- WebGPU where available, WASM fallback.
- No privacy notice is needed for Local: audio and text never leave the device. The only network traffic is the
  one-way model download (ordinary request metadata, like any CDN), covered by "Downloading speech model (40 MB)".
- Recording indicator (animating vector image), shared with Cloud.
- Console diagnostics (TODO item 20) for the Local path.

## Known hurdles (details in TODO item 21)
Model download size, batch latency (1-3 s after release), the CDN fetch at runtime, lower accuracy than Chrome's
cloud engine, worker and stream lifecycle, and error reporting.

## Not in scope
Languages other than English, live (streaming) transcription, speaker identification, and chat usernames
or PeerJS sharing of transcripts.

## Suggested order and stopping points
1 -> 2 -> 3 (invisible; stop anywhere) -> 4 + 5 together -> 6 -> 7.
If chunk 2 shows Whisper is too slow or too large on the target devices, stop there: the cost is a dev dependency
and a throwaway script, and `Local` simply stays unsupported.
