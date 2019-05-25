# Message Class

```typescript
squiss.on('message', (message: Message) => {
  console.log(`${message.body.name} says: ${JSON.stringify(message.body.message)} and has attripute p1 with value ${message.attributes.p1}`);
  message.del();
});
```

SQS message handler

## Properties

Property | Type | Description
---------- | ------- | -------
`raw` | SQS.Message | The raw SQS message
`body` | string &#124; Object | The parsed body of the message
`subject` | string | The SNS subject
`topicArn` | string | The SNS topic arn
`topicName` | string | The SNS topic name
`attributes` | Object | The user message attributes
`sqsAttributes` | Object | The SQS message attributes

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
``
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
