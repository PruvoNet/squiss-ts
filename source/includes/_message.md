# Message Class

## parse(): Promise<string | any>

Parses the message and store it in `body`.
If the user requested to parse the message as json, it will be stored (and returned) as such.
The main purposes of this method are:
 - Unzip the message, if it was gzipped before it was sent
 - Fetch the message from S3, if it was stored there before it was sent.
   - Unless otherwise configured, make sure that the message will be delete from S3 once the message is marked as handled
 - If configured, parse the message as json. 

<aside class="notice">
You must call this method before handling the message, as the raw message might not be readable yet (e.g. zipped or stored on S3).
</aside>

## isHandled(): boolean

Returns `true` if the message was already handled (e.g. deleted/release/kept)

## del(): Promise<void>

Marks the message as handled and queue the message for deletion.
Returns once the message was deleted from the queue.

## keep(): void

Marks the message as handled and release the message slot in Squiss (to allow another message to be fetched instead)
while not performing any queue operation on it.

<aside class="warning">
Notice that you can't release or delete the message afterwards!
</aside>

## release(): Promise<void>

Marks the message as handled and release the message back to the queue (e.g. changes the visibility timeout of the message to 0)
Returns once the message was released back to the queue.

## changeVisibility(timeoutInSeconds: number): Promise<any>

