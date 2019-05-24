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
Type | AWS.SQS
Mandatory| False
Default| `AWS.SQS`

#### S3

An instance of the official S3 Client, or an S3 constructor function to use rather than the
default one provided by AWS.S3

 | |
---------- | -------  | -------
Type | AWS.S3
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

### Auto Extend Options

#### autoExtendTimeout

If true, Squiss will automatically extend each message's `VisibilityTimeout` in the SQS queue until
it's handled (by keeping, deleting, or releasing it).  
It will place the API call to extend the timeout `advancedCallMs` milliseconds in advance of the expiration,
and will extend it by the number of seconds specified in `visibilityTimeoutSecs`.  
If `visibilityTimeoutSecs` is not specified, the `VisibilityTimeout` setting on the queue itself will be used.

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

### activePollIntervalMs

The number of milliseconds to wait between requesting batches of messages when the queue is not empty,
and the `maxInFlight` cap has not been hit.  
For most use cases, it's better to leave this at 0 and let Squiss manage the active polling frequency
according to `maxInFlight`.

 | |
---------- | -------  | -------
Type | number
Mandatory| False
Default| `0`

### bodyFormat

The format of the incoming message.  
Set to "json" to automatically call `JSON.parse()` on each incoming message.

 | |
---------- | -------  | -------
Type | 'json' &#124; 'plain' &#124; undefined
Mandatory| False
Default| `plain`

## Methods

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

### changeVisibility(timeoutInSeconds: number): Promise<void>

```typescript
message.changeVisibility(5000)
  .then(() => {
    console.log('message visibility changed');
  });
```

Changes the visibility timeout of the message

## Events

### delQueued

```typescript
message.on('delQueued', () => {
  console.log('message queued for deletion');
});
```

Emitted when a message is queued for deletion, even if delete queuing has been turned off.

### handled

```typescript
message.on('handled', () => {
  console.log('message was handled');
});
```

Emitted when a message is handled by any means: deleting, releasing, or calling `keep()`.

### released

```typescript
message.on('released', () => {
  console.log('message released');
});
```

Emitted after `release()` or `releaseMessage()` has been called and the `VisibilityTimeout` of a message
has successfully been changed to `0`.  
The `handled` event will also be fired for released messages, but that will come earlier, 
when the release function is initially called.

### timeoutReached

```typescript
message.on('timeoutReached', () => {
  console.log('message timeout reached');
});
```

Emitted when a message reaches it's timeout limit, including any extensions made
with the `autoExtendTimeout` feature.

### extendingTimeout

```typescript
message.on('extendingTimeout', () => {
  console.log('extending message timeout');
});
```

Emitted when a message `VisibilityTimeout` is about to be extended with the `autoExtendTimeout` feature.

### timeoutExtended

```typescript
message.on('timeoutExtended', () => {
  console.log('message timeout was extended');
});
```

Emitted when a message `VisibilityTimeout` was extended with the `autoExtendTimeout` feature.

### keep

```typescript
message.on('keep', () => {
  console.log('message kept');
});
```

Emitted after `keep()` has been called.  
This happens when the timeout extender logic has exhausted all of its tries to extend the message visibility.

### delError <`BatchResultErrorEntry`>

```typescript
message.on('delError', (error: BatchResultErrorEntry) => {
  console.log(`failed to delete message ${error}`);
});
```

Emitted when the message failed to get deleted.
The object handed to you in this event is the AWS failure object described in the <a href="http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#getQueueUrl-property">SQS deleteMessageBatch documentation</a>.

### deleted

```typescript
message.on('deleted', () => {
  console.log('message deleted');
});
```

Emitted when a message is confirmed as being successfully deleted from the queue.  
The `handled` and `delQueued` events will also be fired for deleted messages, but that will come earlier,
when the delete function is initially called.

### autoExtendFail <`AWSError`>

```typescript
message.on('autoExtendFail', (error: AWSError) => {
  console.log(`failed to extend message ${error}`);
});
```

Emitted if `autoExtendTimeout` feature is enabled, and Squiss attempts to extend the message `VisibilityTimeout` that has either been
deleted or otherwise expired.

### autoExtendError <`AWSError`>

```typescript
message.on('autoExtendError', (error: AWSError) => {
  console.log(`failed to extend message ${error}`);
});
```

Emitted if `autoExtendTimeout` feature is enabled, and Squiss failed to extend the message `VisibilityTimeout`.
