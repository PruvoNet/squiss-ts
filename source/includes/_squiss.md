# Squiss Class

```typescript
import {Squiss} from 'squiss-ts';

const awsConfig = {
  accessKeyId: '<accessKeyId>',
  secretAccessKey: '<secretAccessKey>',
  region: '<region>',
};

const squiss = new Squiss({
  awsConfig,
  queueName: 'my-sqs-queue',
  bodyFormat: 'json',
  maxInFlight: 15
});
```

Queue message poller.

## Properties

Property | Type | Description
---------- | ------- | -------
`inFlight` | number | The number of messages currently in flight
`running` | number | Whether Squiss is currently polling or not
`sqs` | SQS | The SQS model used

## Constructor Options

<aside class="notice">
Squiss's defaults are great out of the box for most use cases, 
but you can use the below to fine-tune your Squiss experience
</aside>

### Aws Options

#### awsConfig

```typescript
const awsConfig = {
  accessKeyId: '<accessKeyId>',
  secretAccessKey: '<secretAccessKey>',
  region: '<region>',
};
```
An object mapping to pass to the SQS constructor, configuring the aws-sdk library.  
This is commonly used to set the AWS region, endpoint, or the user credentials.  
See the docs on [configuring the aws-sdk](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html) for details.

 | |
---------- | -------  | -------
Type | SQS.Types.ClientConfiguration
Mandatory| False

#### SQS

An instance of the official SQS Client, or an SQS constructor function to use rather than the
default one provided by AWS.SQS

 | |
---------- | -------  | -------
Type | AWS.SQS  &#124; Object typeof AWS.SQS 
Mandatory| False
Default| `AWS.SQS`

#### S3

An instance of the official S3 Client, or an S3 constructor function to use rather than the
default one provided by AWS.S3

 | |
---------- | -------  | -------
Type | AWS.S3  &#124; Object typeof AWS.S3 
Mandatory| False
Default| `AWS.S3`

### Queue Options

#### queueName

The name of the queue to be polled.

 | |
---------- | -------  | -------
Type | string
Mandatory| True if `queueUrl` is not specified

#### queueUrl

The URL of the queue to be polled.

 | |
---------- | -------  | -------
Type | string
Mandatory| True if `queueName` is not specified

#### accountNumber

If `queueName` is specified, the `accountNumber` of the queue owner can optionally be specified to access a queue in
a different AWS account.

 | |
---------- | -------  | -------
Type | string &#124; number
Mandatory| False

#### correctQueueUrl

Changes the protocol, host, and port of the queue URL to match the configured SQS endpoint (see `awsConfig`),
applicable only if `queueName` is specified.  
This can be useful for testing against a local SQS service, such as ElasticMQ.

 | |
---------- | -------  | -------
Type | boolean
Mandatory| False
Default| `false`

### visibilityTimeoutSecs

The amount of time, in seconds, that received messages will be unavailable to other squiss instances without
being deleted.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| queue setting on read, or 30 seconds for `createQueue()`

### Auto Extend Options

Squiss can automatically extend each message's `VisibilityTimeout` in the SQS queue until
it's handled (by keeping, deleting, or releasing it).  
It will place the API call to extend the timeout `advancedCallMs` milliseconds in advance of the expiration,
and will extend it by the number of seconds specified in `visibilityTimeoutSecs`.  
If `visibilityTimeoutSecs` is not specified, the `VisibilityTimeout` setting on the queue itself will be used.

#### autoExtendTimeout

Enable the message auto extend feature

 | |
---------- | -------  | -------
Type | boolean
Mandatory| False
Default| `false`

#### noExtensionsAfterSecs

If `autoExtendTimeout` is used, Squiss will stop auto-renewing a message's `VisibilityTimeout`
when it reaches this age. Default is 12 hours, SQS's `VisbilityTimeout` maximum.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `43200`

#### advancedCallMs

If `autoExtendTimeout` is used, this is the number of milliseconds that Squiss will make the call to extend the
`VisibilityTimeout` of the message, before the message is set to expire.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `5000`

### Gzip Options

You can gzip the messages, which will reduce the message size, thus enabling you to send large messages, 
and also reduce the cost of those message.  
You can optionally gzip only if a message size certain criteria is met (`minGzipSize`), to reduce compute overhead.

#### gzip

Auto gzip messages to reduce message size.

 | |
---------- | -------  | -------
Type | boolean
Mandatory| False
Default| `false`

#### minGzipSize

The min message size to gzip (in bytes) when `gzip` is set to `true`.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `0`

### S3 Options

```typescript
const s3Options = {
  s3Fallback: true,
  s3Bucket: 'squiss-bucket',
  s3Retain: false,
  s3Prefix: `${queueName}`,
  minS3Size: 64000,
};
```

you can upload the messages body to S3 and replace the message with just the reference to the created blob.  
This will reduce the message size, thus enabling you to send large messages, 
and also reduce the cost of those message.  

#### s3Fallback

Upload messages bigger than `minS3Size` or queue default `maxMessageBytes` to S3,
and retrieve it from there when message is received.

 | |
---------- | -------  | -------
Type | boolean
Mandatory| False
Default| `false`

#### s3Bucket

if `s3Fallback` is set to `true`, upload message to this S3 bucket.

 | |
---------- | -------  | -------
Type | string
Mandatory| True if `s3Fallback` is set to `true`

#### s3Retain

if `s3Fallback` is true, do not delete blob on message delete.

 | |
---------- | -------  | -------
Type | boolean
Mandatory| False
Default | `false`

#### minS3Size

The min message size to send to S3 (in bytes) when `s3Fallback` is set to `true`.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default | queue max message size

#### s3Prefix

if `s3Fallback` is set to `true`, set this prefix to uploaded S3 blobs.

 | |
---------- | -------  | -------
Type | string
Mandatory| False
Default | ``

### Delete options

#### deleteBatchSize

The number of messages to delete at one time.  
Squiss will trigger a batch delete when this limit is reached, or when `deleteWaitMs` 
milliseconds have passed since the first queued delete in the batch, whichever comes first.  
Set to 1 to make all deletes immediate

 | |
---------- | -------  | -------
Type | number (max 10)
Mandatory| False
Default| `10`

#### deleteWaitMs

The number of milliseconds to wait after the first queued message deletion before deleting the message(s) from SQS.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `2000`

### Polling Options

#### activePollIntervalMs

The number of milliseconds to wait between requesting batches of messages when the queue is not empty,
and the `maxInFlight` cap has not been hit.  
For most use cases, it's better to leave this at 0 and let Squiss manage the active polling frequency
according to `maxInFlight`.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `0`

#### idlePollIntervalMs

The number of milliseconds to wait before requesting a batch of messages when the queue was empty on the prior request.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `0`

#### maxInFlight

The number of messages to keep "in-flight", or processing simultaneously. When this cap is reached,
no more messages will be polled until currently in-flight messages are marked as deleted or handled.  
Setting this option to 0 will uncap your in flight messages, 
pulling and delivering messages as long as there are messages to pull.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `100`

#### pollRetryMs

The number of milliseconds to wait before retrying when Squiss's call to retrieve messages from SQS fails.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `2000`

#### receiveBatchSize

The number of messages to receive at one time.

 | |
---------- | -------  | -------
Type | number (max 10 or `maxInFlight`)
Mandatory| False
Default| `10`

#### minReceiveBatchSize

The minimum number of available message slots that will initiate a call to get the next batch.

 | |
---------- | -------  | -------
Type | number (max 10 or `maxInFlight`, whichever is lower)
Mandatory| False
Default| `1`

#### receiveWaitTimeSecs

The number of seconds for which to hold open the SQS call to receive messages, when no message is currently available.  
It is recommended to set this high, as Squiss will re-open the receiveMessage HTTP request as soon as the last
one ends. 
If this needs to be set low, consider setting `activePollIntervalMs` to space out calls to SQS.

 | |
---------- | -------  | -------
Type | number (max 20)
Mandatory| False
Default| `20`

### Formatting Options

#### bodyFormat

The format of the incoming message.  
Set to "json" to automatically call `JSON.parse()` on each incoming message.

 | |
---------- | -------  | -------
Type | 'json' &#124; 'plain' &#124
Mandatory| False
Default| `plain`

#### unwrapSns

Set to `true` to denote that Squiss should treat each message as though it comes from a queue subscribed to an
SNS endpoint, and automatically extract the message from the SNS metadata wrapper.

 | |
---------- | -------  | -------
Type | boolean
Mandatory| False
Default| `false`

### Attributes Options

#### receiveAttributes

An an array of strings with attribute names (e.g. `myAttribute`) to request along with the `receiveMessage` call.  
The attributes will be accessible via `message.attributes.<attributeName>`.

 | |
---------- | -------  | -------
Type | string[]
Mandatory| False
Default| `['All']`

#### receiveSqsAttributes

An an array of strings with attribute names (e.g. `ApproximateReceiveCount`) to request along with
the `receiveMessage` call.  
The attributes will be accessible via `message.sqsAttributes.<attributeName>`.

 | |
---------- | -------  | -------
Type | string[]
Mandatory| False
Default| `['All']`

### Queue Create Options

Are you using Squiss to create your queue as well? Squiss will use `receiveWaitTimeSecs` and 
`visibilityTimeoutSecs` in the queue create options, but consider setting any of the 
following options to configure it further. 

<aside class="notice">
Note that the defaults are the same as Amazon's own defaults.
</aside>

#### delaySecs

The number of milliseconds by which to delay the delivery of new messages into the queue by default.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `0`

#### maxMessageBytes

he maximum size of a single message, in bytes, that the queue can support.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `262144` (256KB)

#### messageRetentionSecs

The amount of time for which to retain messages in the queue until they expire, in seconds.

 | |
---------- | -------  | -------
Type | number (max 1209600 (14 days))
Mandatory| False
Default| `345600` (4 days)

#### queuePolicy

f specified, will be set as the access policy of the queue when `createQueue` is called.  
See [the AWS Policy documentation](http://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html) for more
information.

 | |
---------- | -------  | -------
Type | string
Mandatory| False

## Methods

### changeMessageVisibility(message: Message | string,timeoutInSeconds: number): Promise<void>

```typescript
message.changeVisibility(5000)
  .then(() => {
    console.log('message visibility changed');
  });
```

### parse(): Promise<string | any>

```typescript
message.parse()
  .then((body) => {
    console.log(body);
  });
```

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

### isHandled(): boolean

```typescript
console.log(`message handled? ${message.isHandled()}`);
```

Returns `true` if the message was already handled (e.g. deleted/released/kept)

### del(): Promise<void>


```typescript
message.del()
  .then(() => {
    console.log('message deleted');
  });
```

Marks the message as handled and queue the message for deletion.
Returns once the message was deleted from the queue.

### keep(): void

```typescript
message.keep();
```

Marks the message as handled and release the message slot in Squiss (to allow another message to be fetched instead)
while not performing any queue operation on it.

<aside class="warning">
Notice that you can't release or delete the message afterwards!
</aside>

### release(): Promise<void>

```typescript
message.release()
  .then(() => {
    console.log('message released');
  });
```

Marks the message as handled and release the message back to the queue (e.g. changes the visibility timeout of the message to 0)
Returns once the message was released back to the queue.

Changes the visibility timeout of the message

## Events

### Queue Events

#### drained

```typescript
squiss.on('drained', () => {
  console.log('no more messages being handled');
});
```

Emitted when the last in-flight message has been handled, and there are no more messages currently in flight.

#### queueEmpty

```typescript
squiss.on('queueEmpty', () => {
  console.log('no new messages');
});
```

Emitted when Squiss asks SQS for new messages, and doesn't get any.

#### maxInFlight

```typescript
squiss.on('maxInFlight', () => {
  console.log('max in flight cap reached');
});
```

Emitted when Squiss has hit the maxInFlight cap.  
At this point, Squiss won't retrieve any more messages until at least `opts.receiveBatchSize` in-flight messages have been deleted.


#### error <`Error`>

```typescript
squiss.on('error', (error: Error) => {
  console.log(`squiss error ${error}`);
});
```

If any of the AWS API calls outright fail, `error` is emitted.  
If you don't have a listener on `error`, per Node.js's structure, the error will be treated as uncaught
and will crash your app.

#### aborted <`AWSError`>

```typescript
squiss.on('aborted', (error: AWSError) => {
  console.log(`failed to extend message ${error}`);
});
```

Emitted if a request for new messages was already in progress while performing a hard `stop()` .

### Message Events

#### message

```typescript
squiss.on('message', (message: Message) => {
  console.log('message received');
});
```

Emitted every time Squiss pulls a new message from the queue.

#### delQueued

```typescript
squiss.on('delQueued', (message: Message) => {
  console.log('message queued for deletion');
});
```

Emitted when a message is queued for deletion, even if delete queuing has been turned off.

#### handled

```typescript
squiss.on('handled', (message: Message) => {
  console.log('message was handled');
});
```

Emitted when a message is handled by any means: deleting, releasing, or calling `keep()`.

#### released

```typescript
squiss.on('released', (message: Message) => {
  console.log('message released');
});
```

Emitted after `release()` or `releaseMessage()` has been called and the `VisibilityTimeout` of a message
has successfully been changed to `0`.  
The `handled` event will also be fired for released messages, but that will come earlier, 
when the release function is initially called.

#### timeoutReached

```typescript
squiss.on('timeoutReached', (message: Message) => {
  console.log('message timeout reached');
});
```

Emitted when a message reaches it's timeout limit, including any extensions made
with the `autoExtendTimeout` feature.

#### extendingTimeout

```typescript
squiss.on('extendingTimeout', (message: Message) => {
  console.log('extending message timeout');
});
```

Emitted when a message `VisibilityTimeout` is about to be extended with the `autoExtendTimeout` feature.

#### timeoutExtended

```typescript
squiss.on('timeoutExtended', (message: Message) => {
  console.log('message timeout was extended');
});
```

Emitted when a message `VisibilityTimeout` was extended with the `autoExtendTimeout` feature.

#### keep

```typescript
squiss.on('keep', (message: Message) => {
  console.log('message kept');
});
```

Emitted after `keep()` has been called.  
This happens when the timeout extender logic has exhausted all of its tries to extend the message visibility.

#### gotMessages <number>

```typescript
squiss.on('gotMessages', (numOfMessages: number) => {
  console.log(`got ${numOfMessages} messages`);
});
```

Emitted when Squiss asks SQS for a new batch of messages, and gets some (or one).  
Supplies the number of retrieved messages.

#### deleted <`{message: Message, successId: string}`>

```typescript
squiss.on('deleted', (deletedEvent: IMessageDeletedEventPayload) => {
  console.log('message deleted');
});
```

Emitted when a message is confirmed as being successfully deleted from the queue.  
The `handled` and `delQueued` events will also be fired for deleted messages, but that will come earlier,
when the delete function is initially called.

#### delError <`{message: Message, error: BatchResultErrorEntry}`>

```typescript
squiss.on('delError', (error: IMessageDeleteErrorEventPayload) => {
  console.log(`failed to delete message ${error}`);
});
```

Emitted when the message failed to get deleted.
The object handed to you in this event is the AWS failure object described in the <a href="http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#getQueueUrl-property">SQS deleteMessageBatch documentation</a>.

#### autoExtendFail <`{message: Message, error: AWSError}`>

```typescript
squiss.on('autoExtendFail', (error: IMessageErrorEventPayload) => {
  console.log(`failed to extend message ${error}`);
});
```

Emitted if `autoExtendTimeout` feature is enabled, and Squiss attempts to extend the message `VisibilityTimeout` that has either been
deleted or otherwise expired.

#### autoExtendError <`{message: Message, error: AWSError}`>

```typescript
squiss.on('autoExtendError', (error: IMessageErrorEventPayload) => {
  console.log(`failed to extend message ${error}`);
});
```

Emitted if `autoExtendTimeout` feature is enabled, and Squiss failed to extend the message `VisibilityTimeout`.

### S3 Events

#### s3Download <`{message: Message, data: {bucket: string, key: string, uploadSize: number}}`>

```typescript
squiss.on('s3Download', (payload: IMessageS3EventPayload) => {
  console.log(`downloaded s3 message ${payload.data.key}`);
});
```

Emitted if `s3Fallback` feature is enabled, and a message that was received downloaded its message body from S3.

#### s3Delete <`{message: Message, data: {bucket: string, key: string, uploadSize: number}}`>

```typescript
squiss.on('s3Delete', (payload: IMessageS3EventPayload) => {
  console.log(`deleted s3 message ${payload.data.key}`);
});
```

Emitted if `s3Fallback` feature is enabled, and a message that was received with message body from S3 was deleted.

#### s3Upload <`{bucket: string, key: string, uploadSize: number}`>

```typescript
squiss.on('s3Delete', (payload: IS3Upload) => {
  console.log(`uploaded s3 message ${payload.key}`);
});
```

Emitted if `s3Fallback` feature is enabled, and a message that was sent uploaded its body to S3.
