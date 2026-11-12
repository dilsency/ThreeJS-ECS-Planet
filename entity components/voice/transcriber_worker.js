// this is not "main thread", so we use "self." instead of "this."

// create an event listener for messages
self.onmessage = (eventObject) =>
{
    const message = eventObject.data;

    switch (message.type)
    {
        case "ping":
            // the "main thread" will have to receive this message
            self.postMessage({ type: "pong", id: message.id });
            break;
        case "load":
            console.log("test with the load message.type");
            break;
        case "transcribe":
            console.log("test with the transcribe message.type");
            break;
        default:
            console.warn("unknown message type : " + message.type + " : " + message.id);
    }
};