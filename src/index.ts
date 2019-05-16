'use strict';

import * as AWS from 'aws-sdk';
import * as url from 'url';
import {EventEmitter} from 'events';
import {Message} from './Message';
import {ITimeoutExtenderOptions, TimeoutExtender} from './TimeoutExtender';
import {createMessageAttributes, IMessageAttributes} from './attributeUtils';
import {isString} from 'ts-type-guards';
import {SQS, S3} from 'aws-sdk';
import {GZIP_MARKER, compressMessage} from './gzipUtils';
import {S3_MARKER, uploadBlob} from './s3Utils';
import {getMessageSize} from './messageSizeUtils';

export {SQS, S3} from 'aws-sdk';

/**
 * The maximum number of messages that can be sent in an SQS sendMessageBatch request.
 * @type {number}
 */
const AWS_MAX_SEND_BATCH = 10;

export interface IObject {
    [k: string]: any;
}

export type IMessageToSend = IObject | string;

export {IMessageAttributes} from './attributeUtils';
export {Message} from './Message';

export type BodyFormat = 'json' | 'plain' | undefined;

export interface ISquissOptions {
    receiveBatchSize?: number;
    receiveAttributes?: string[];
    receiveSqsAttributes?: string[];
    minReceiveBatchSize?: number;
    receiveWaitTimeSecs?: number;
    deleteBatchSize?: number;
    deleteWaitMs?: number;
    maxInFlight?: number;
    unwrapSns?: boolean;
    bodyFormat?: BodyFormat;
    correctQueueUrl?: boolean;
    pollRetryMs?: number;
    activePollIntervalMs?: number;
    idlePollIntervalMs?: number;
    delaySecs?: number;
    gzip?: boolean;
    minGzipSize?: number;
    maxMessageBytes?: number;
    messageRetentionSecs?: number;
    autoExtendTimeout?: boolean;
    SQS?: SQS | typeof SQS;
    S3?: S3 | typeof S3;
    awsConfig?: SQS.Types.ClientConfiguration;
    queueUrl?: string;
    queueName?: string;
    visibilityTimeoutSecs?: number;
    queuePolicy?: string;
    accountNumber?: string | number;
    noExtensionsAfterSecs?: number;
    advancedCallMs?: number;
    s3Fallback?: boolean;
    s3Bucket?: string;
    s3Retain?: boolean;
    s3Prefix?: string;
}

interface IDeleteQueueItem {
    msg: Message;
    Id: string;
    ReceiptHandle: string;
    resolve: () => void;
    reject: (reason?: any) => void;
}

interface IDeleteQueueItemById {
    [k: string]: IDeleteQueueItem;
}

export interface ISendMessageRequest {
    MessageBody: string;
    DelaySeconds?: number;
    MessageAttributes?: SQS.MessageBodyAttributeMap;
    MessageDeduplicationId?: string;
    MessageGroupId?: string;
}

/**
 * Option defaults.
 * @type {Object}
 */
const optDefaults: ISquissOptions = {
    receiveBatchSize: 10,
    receiveAttributes: ['All'],
    receiveSqsAttributes: ['All'],
    minReceiveBatchSize: 1,
    receiveWaitTimeSecs: 20,
    deleteBatchSize: 10,
    deleteWaitMs: 2000,
    maxInFlight: 100,
    unwrapSns: false,
    bodyFormat: 'plain',
    correctQueueUrl: false,
    pollRetryMs: 2000,
    activePollIntervalMs: 0,
    idlePollIntervalMs: 0,
    delaySecs: 0,
    gzip: false,
    minGzipSize: 0,
    s3Fallback: false,
    s3Retain: false,
    s3Prefix: '',
    maxMessageBytes: 262144,
    messageRetentionSecs: 345600,
    autoExtendTimeout: false,
};

/**
 * Squiss is a high-volume-capable Amazon SQS polling class. See README for usage details.
 */
export class Squiss extends EventEmitter {

    /**
     * Getter for the number of messages currently in flight.
     * @returns {number}
     */
    get inFlight(): number {
        return this._inFlight;
    }

    /**
     * Getter to determine whether Squiss is currently polling or not.
     * @returns {boolean}
     */
    get running(): boolean {
        return this._running;
    }

    public sqs: SQS;
    public _timeoutExtender: TimeoutExtender | undefined;
    public _opts: ISquissOptions;
    private _s3?: S3;
    private _running: boolean;
    private _paused: boolean;
    private _inFlight: number;
    private _queueVisibilityTimeout: number;
    private _queueMaximumMessageSize: number;
    private _queueUrl: string;
    private _delQueue: Map<string, IDeleteQueueItem>;
    private _delTimer: number | undefined;
    private _activeReq: AWS.Request<SQS.Types.ReceiveMessageResult, AWS.AWSError> | undefined;

    /**
     * Creates a new Squiss object.
     * @param {Object} opts A map of options to configure this instance
     * @param {Function} [opts.SQS] An instance of the official SQS Client, or an SQS constructor function to use
     *    rather than the default one provided by SQS
     * @param {Function} [opts.S3] An instance of the official S3 Client, or an S3 constructor function to use
     *    rather than the default one provided by S3
     * @param {Object} [opts.awsConfig] An object mapping to pass to the SQS constructor, configuring the
     *    aws-sdk library. This is commonly used to set the AWS region, or the user credentials. See
     *    http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html
     * @param {string} [opts.queueUrl] The URL of the queue to be polled. If not specified, opts.queueName is
     *    required.
     * @param {string} [opts.queueName] The name of the queue to be polled. Used only if opts.queueUrl is not
     *    specified.
     * @param {string} [opts.accountNumber] If a queueName is specified, the accountNumber of the queue
     *    owner can optionally be specified to access a queue in a different AWS account.
     * @param {boolean} [opts.correctQueueUrl=false] Changes the protocol, host, and port of the queue URL to match the
     *    configured SQS endpoint, applicable only if opts.queueName is specified. This can be useful for testing
     *     against a stubbed SQS service, such as ElasticMQ.
     * @param {boolean} [opts.gzip=false] Auto gzip messages to reduce message size.
     * @param {number} [opts.minGzipSize=0] The min message size to gzip (in bytes) when `gzip` is set to `true`.
     * @param {boolean} [opts.s3Fallback=false] Upload messages bigger than `maxMessageBytes` or queue default to s3,
     *    and retrieve it from there when message is received.
     * @param {string} [opts.s3Bucket] if `s3Fallback` is true, upload message to this s3 bucket.
     * @param {boolean} [opts.s3Retain=false] if `s3Fallback` is true, do not delete blob on message delete.
     * @param {string} [opts.s3Prefix] if `s3Fallback` is true, set this prefix to uploaded s3 blobs.
     * @param {number} [opts.deleteBatchSize=10] The number of messages to delete at one time. Squiss will trigger a
     *    batch delete when this limit is reached, or when deleteWaitMs milliseconds have passed since the first queued
     *    delete in the batch; whichever comes first. Set to 1 to make all deletes immediate. Maximum 10.
     * @param {number} [opts.deleteWaitMs=2000] The number of milliseconds to wait after the first queued message
     *    deletion before deleting the message(s) from SQS
     * @param {number} [opts.maxInFlight=100] The number of messages to keep "in-flight", or processing simultaneously.
     *    When this cap is reached, no more messages will be polled until currently in-flight messages are marked as
     *    deleted or handled. Setting this to 0 will uncap your inFlight messages, pulling and delivering messages
     *    as long as there are messages to pull.
     * @param {number} [opts.receiveBatchSize=10] The number of messages to receive at one time. Maximum 10 or
     *    maxInFlight, whichever is lower.
     * @param {number} [opts.minReceiveBatchSize=1] The minimum number of available message slots that will initiate a
     *    call to get the next batch. Maximum 10 or maxInFlight, whichever is lower.
     * @param {number} [opts.receiveWaitTimeSecs=20] The number of seconds for which to hold open the SQS call to
     *    receive messages, when no message is currently available. It is recommended to set this high, as Squiss will
     *    re-open the receiveMessage HTTP request as soon as the last one ends. Maximum 20.
     * @param {boolean} [opts.unwrapSns=false] Set to `true` to denote that Squiss should treat each message as though
     *    it comes from a queue subscribed to an SNS endpoint, and automatically extract the message from the SNS
     *    metadata wrapper.
     * @param {string} [opts.bodyFormat="plain"] The format of the incoming message. Set to "json" to automatically call
     *    `JSON.parse()` on each incoming message.
     * @param {number} [opts.visibilityTimeoutSecs] The SQS VisibilityTimeout to apply to each message. This is the
     *    number of seconds that each received message should be made inaccessible to other receive calls, so that a
     *    message will not be received more than once before it is processed and deleted. If not specified, the default
     *    for the SQS queue will be used when receiving messages, and the SQS default (30) will be used when creating a
     *    queue.
     * @param {number} [opts.pollRetryMs=2000] The number of milliseconds to wait before retrying when Squiss's call to
     *    retrieve messages from SQS fails.
     * @param {number} [opts.activePollIntervalMs=0] The number of milliseconds to wait between requesting batches of
     *    messages when the queue is not empty, and the maxInFlight cap has not been hit.
     * @param {number} [opts.idlePollIntervalMs=0] The number of milliseconds to wait before requesting a batch of
     *    messages when the queue was empty on the prior request.
     * @param {number} [opts.delaySecs=0] The number of milliseconds by which to delay the delivery of new messages into
     *    the queue by default. This is only used when calling {@link #createQueue}.
     * @param {number} [opts.maxMessageBytes=262144] The maximum size of a single message, in bytes, that the queue can
     *    support. This is only used when calling {@link #createQueue}. Default is the maximum, 256KB.
     * @param {number} [opts.messageRetentionSecs=345600] The amount of time for which to retain messages in the queue
     *    until they expire, in seconds. This is only used when calling {@link #createQueue}. Default is equivalent to
     *    4 days, maximum is 1209600 (14 days).
     * @param {boolean} [opts.autoExtendTimeout=false] If true, the VisibilityTimeout for all in-flight messages will
     *    be automatically extended when there are 5 seconds remaining before the VisibilityTimeout would normally
     *    expire. It will be extended by the VisibilityTimeout. The VisibilityTimeout used will be the one specified
     *    in opts.visibilityTimeoutSecs, or the queue's configured VisibilityTimeout if that option is not set.
     * @param {number} [opts.noExtensionsAfterSecs=43200] The age, in seconds, at which a message will no longer have
     *    its VisibilityTimeout automatically extended if opts.autoExtendTimeout is true.
     * @param {number} [opts.advancedCallMs=5000] The number of milliseconds before a message expires to send the API
     *    call to extend its VisibilityTimeout. Applicable only if opts.autoExtendTimeout is true.
     * @param {Object} [opts.queuePolicy] If specified, will be set as the access policy of the queue when
     *    {@link #createQueue} is called. See http://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html for
     *    more information.
     * @param {Object} [opts.receiveAttributes] An array of strings with attribute names (e.g. `myAttribute`)
     *    to request along with the `receiveMessage` call. The attributes will be accessible via
     *    `message.attributes.<attribute>`.
     * @param {Object} [opts.receiveSqsAttributes] An array of strings with attribute names
     *    (e.g. `ApproximateReceiveCount`) to request along with the `receiveMessage` call.
     *    The attributes will be accessible via `message.sqsAttributes.<attribute>`.
     */

    constructor(opts?: ISquissOptions | undefined) {
        super();
        this._opts = Object.assign({}, optDefaults, opts || {});
        if (this._opts.SQS) {
            if (typeof this._opts.SQS === 'function') {
                this.sqs = new this._opts.SQS(this._opts.awsConfig);
            } else {
                this.sqs = this._opts.SQS;
            }
        } else {
            this.sqs = new SQS(this._opts.awsConfig);
        }
        this._opts.deleteBatchSize = Math.min(this._opts.deleteBatchSize!, 10);
        this._opts.receiveBatchSize = Math.min(this._opts.receiveBatchSize!,
            this._opts.maxInFlight! > 0 ? this._opts.maxInFlight! : 10, 10);
        this._opts.minReceiveBatchSize = Math.min(this._opts.minReceiveBatchSize!, this._opts.receiveBatchSize);
        this._running = false;
        this._inFlight = 0;
        this._delQueue = new Map();
        this._paused = true;
        this._delTimer = undefined;
        this._queueUrl = this._opts.queueUrl || '';
        this._queueVisibilityTimeout = 0;
        this._queueMaximumMessageSize = 0;
        if (!this._opts.queueUrl && !this._opts.queueName) {
            throw new Error('Squiss requires either the "queueUrl", or the "queueName".');
        }
        if (this._opts.s3Fallback && !this._opts.s3Bucket) {
            throw new Error('Squiss requires "s3Bucket" to be defined is using s3 fallback');
        }
        this._timeoutExtender = undefined;
    }

    /**
     * Changes the visibility timeout of a message.
     * @param {Message|string} msg The Message object or ReceiptHandle for which to change the VisibilityTimeout.
     * @param {number} timeoutInSeconds Visibility timeout in seconds.
     * @returns {Promise} Resolves on complete. Rejects with the official AWS SDK's error object.
     */
    public changeMessageVisibility(msg: Message | string, timeoutInSeconds: number): Promise<any> {
        let receiptHandle: string;
        if (msg instanceof Message) {
            receiptHandle = msg.raw.ReceiptHandle!;
        } else {
            receiptHandle = msg;
        }
        return this.getQueueUrl()
            .then((queueUrl) => {
                    return this.sqs.changeMessageVisibility({
                        QueueUrl: queueUrl,
                        ReceiptHandle: receiptHandle,
                        VisibilityTimeout: timeoutInSeconds,
                    }).promise();
                }
            );
    }

    /**
     * Creates the configured queue in Amazon SQS and retrieves its queue URL. Note that this method can only be called
     * if Squiss was instantiated with the queueName property.
     * @returns {Promise.<string>} Resolves with the URL of the created queue, rejects with the official AWS SDK's
     *    error object.
     */
    public createQueue(): Promise<string> {
        if (!this._opts.queueName) {
            return Promise.reject(new Error('Squiss was not instantiated with a queueName'));
        }
        const params: SQS.Types.CreateQueueRequest = {
            QueueName: this._opts.queueName,
            Attributes: {
                ReceiveMessageWaitTimeSeconds: this._opts.receiveWaitTimeSecs!.toString(),
                DelaySeconds: this._opts.delaySecs!.toString(),
                MaximumMessageSize: this._opts.maxMessageBytes!.toString(),
                MessageRetentionPeriod: this._opts.messageRetentionSecs!.toString(),
            },
        };
        if (this._opts.visibilityTimeoutSecs) {
            params.Attributes!.VisibilityTimeout = this._opts.visibilityTimeoutSecs.toString();
        }
        if (this._opts.queuePolicy) {
            params.Attributes!.Policy = this._opts.queuePolicy;
        }
        return this.sqs.createQueue(params).promise().then((res) => {
            this._queueUrl = res.QueueUrl!;
            return res.QueueUrl!;
        });
    }

    /**
     * Queues the given message for deletion. The message will actually be deleted from SQS per the settings
     * supplied to the constructor.
     * @param {Message} msg The message object to be deleted
     */
    public deleteMessage(msg: Message): Promise<void> {
        if (!msg.raw) {
            return Promise.reject(new Error('Squiss.deleteMessage requires a Message object'));
        }
        const promise = new Promise<void>((resolve, reject) => {
            this._delQueue.set(msg.raw.MessageId!,
                {msg, Id: msg.raw.MessageId!, ReceiptHandle: msg.raw.ReceiptHandle!, resolve, reject});
        });
        msg.emit('delQueued');
        this.emit('delQueued', msg);
        this.handledMessage(msg);
        if (this._delQueue.size >= this._opts.deleteBatchSize!) {
            if (this._delTimer) {
                clearTimeout(this._delTimer);
                this._delTimer = undefined;
            }
            const delQueue = this._delQueue;
            const iterator = delQueue.entries();
            const delBatch = Array.from({length: this._opts.deleteBatchSize!}, function(this: typeof iterator) {
                const element = this.next().value;
                delQueue.delete(element[0]);
                return element[1];
            }, iterator);
            this._deleteMessages(delBatch);
        } else if (!this._delTimer) {
            this._delTimer = setTimeout(() => {
                this._delTimer = undefined;
                const delQueue = this._delQueue;
                const iterator = delQueue.entries();
                const delBatch = Array.from({length: delQueue.size}, function(this: typeof iterator) {
                    const element = this.next().value;
                    delQueue.delete(element[0]);
                    return element[1];
                }, iterator);
                this._deleteMessages(delBatch);
            }, this._opts.deleteWaitMs);
        }
        return promise;
    }

    /**
     * Deletes the configured queue.
     * @returns {Promise} Resolves on complete. Rejects with the official AWS SDK's error object.
     */
    public deleteQueue(): Promise<any> {
        return this.getQueueUrl().then((queueUrl) => {
            return this.sqs.deleteQueue({QueueUrl: queueUrl}).promise();
        });
    }

    /**
     * Gets the queueUrl for the configured queue and sets this instance up to use it. Any calls to
     * {@link #start} will wait until this function completes to begin polling.
     * @returns {Promise.<string>} Resolves with the queue URL
     * @private
     */
    public getQueueUrl(): Promise<string> {
        if (this._queueUrl) {
            return Promise.resolve(this._queueUrl);
        }
        const params: SQS.Types.GetQueueUrlRequest = {QueueName: this._opts.queueName!};
        if (this._opts.accountNumber) {
            params.QueueOwnerAWSAccountId = this._opts.accountNumber.toString();
        }
        return this.sqs.getQueueUrl(params).promise().then((data) => {
            this._queueUrl = data.QueueUrl!;
            if (this._opts.correctQueueUrl) {
                const newUrl = url.parse(this.sqs.config.endpoint!);
                const parsedQueueUrl = url.parse(this._queueUrl);
                newUrl.pathname = parsedQueueUrl.pathname;
                this._queueUrl = url.format(newUrl);
            }
            return this._queueUrl;
        });
    }

    /**
     * Retrieves the VisibilityTimeout set on the target queue. When a message is received, it has this many
     * seconds to be deleted before it will become available to be received again.
     * @returns {Promise.<number>} The VisibilityTimeout setting of the target queue, in seconds
     */
    public getQueueVisibilityTimeout(): Promise<number> {
        if (this._queueVisibilityTimeout) {
            return Promise.resolve(this._queueVisibilityTimeout);
        }
        return this.getQueueUrl().then((queueUrl) => {
            return this.sqs.getQueueAttributes({
                AttributeNames: ['VisibilityTimeout'],
                QueueUrl: queueUrl,
            }).promise();
        }).then((res) => {
            if (!res.Attributes || !res.Attributes.VisibilityTimeout) {
                throw new Error('SQS.GetQueueAttributes call did not return expected shape. Response: ' +
                    JSON.stringify(res));
            }
            this._queueVisibilityTimeout = parseInt(res.Attributes.VisibilityTimeout, 10);
            return this._queueVisibilityTimeout;
        });
    }

    public getQueueMaximumMessageSize(): Promise<number> {
        if (this._queueMaximumMessageSize) {
            return Promise.resolve(this._queueMaximumMessageSize);
        }
        return this.getQueueUrl().then((queueUrl) => {
            return this.sqs.getQueueAttributes({
                AttributeNames: ['MaximumMessageSize'],
                QueueUrl: queueUrl,
            }).promise();
        }).then((res) => {
            if (!res.Attributes || !res.Attributes.MaximumMessageSize) {
                throw new Error('SQS.GetQueueAttributes call did not return expected shape. Response: ' +
                    JSON.stringify(res));
            }
            this._queueMaximumMessageSize = parseInt(res.Attributes.MaximumMessageSize, 10);
            return this._queueMaximumMessageSize;
        });
    }

    /**
     * Informs Squiss that a message has been handled. This allows Squiss to decrement the number of in-flight
     * messages without deleting one, which may be necessary in the event of an error.
     * @param {Message} msg The message to be handled
     */
    public handledMessage(msg: Message): void {
        this._inFlight--;
        if (this._paused && this._slotsAvailable()) {
            this._paused = false;
            this._startPoller();
        }
        msg.emit('handled');
        this.emit('handled', msg);
        if (!this._inFlight) {
            this.emit('drained');
        }
    }

    /**
     * Releases a message back into the queue by changing its VisibilityTimeout to 0 and calling
     * {@link #handledMessage}. Note that if this is used when the poller is running, the message will be
     * immediately picked up and processed again (by this or any other application instance polling the same
     * queue).
     * @param {Message} msg The Message object for which to change the VisibilityTimeout.
     * @returns {Promise} Resolves when the VisibilityTimeout has been changed. Rejects with the official AWS SDK's
     * error object.
     */
    public releaseMessage(msg: Message): Promise<any> {
        this.handledMessage(msg);
        return this.changeMessageVisibility(msg, 0).then((res) => {
            msg.emit('released');
            this.emit('released', msg);
            return res;
        });
    }

    /**
     * Deletes all the messages in a queue and init in flight.
     * @returns {Promise} Resolves on complete. Rejects with the official AWS SDK's error object.
     */
    public purgeQueue(): Promise<any> {
        return this.getQueueUrl().then((queueUrl) => {
            return this.sqs.purgeQueue({QueueUrl: queueUrl}).promise()
                .then((data) => {
                    this._inFlight = 0;
                    this._delQueue = new Map();
                    this._delTimer = undefined;
                    return data;
                });
        });
    }

    /**
     * Sends an individual message to the configured queue.
     * @param {string|Object} message The message to be sent. Objects will be JSON.stringified.
     * @param {number} [delay] The number of seconds by which to delay the delivery of the message, max 900. If not
     *    specified, the queue default will be used.
     * @param {Object} [attributes] An optional attributes mapping to associate with the message. For more information,
     *    see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#sendMessage-property.
     * @returns {Promise.<{MessageId: string, MD5OfMessageAttributes: string, MD5OfMessageBody: string}>} Resolves with
     *    the official AWS SDK sendMessage response, rejects with the official error object.
     */
    public sendMessage(message: IMessageToSend, delay?: number, attributes?: IMessageAttributes)
        : Promise<SQS.Types.SendMessageResult> {
        return Promise.all([
            this.perpareMessageRequest(message, delay, attributes),
            this.getQueueUrl(),
        ])
            .then((data) => {
                const rawParams = data[0];
                const queueUrl = data[1];
                const params: SQS.Types.SendMessageRequest = {
                    QueueUrl: queueUrl,
                    ...rawParams,
                };
                return this.sqs.sendMessage(params).promise();
            });
    }

    /**
     * Sends an array of any number of messages to the configured SQS queue, breaking them down into appropriate batch
     * requests executed in parallel (or as much as the default HTTP agent allows). The response is closely aligned to
     * the official AWS SDK's sendMessageBatch response, except the results from all batch requests are merged. Expect
     * a result similar to:
     *
     * {
     *   Successful: [
     *     {Id: string, MessageId: string, MD5OfMessageAttributes: string, MD5OfMessageBody: string}
     *   ],
     *   Failed: [
     *     {Id: string, SenderFault: boolean, Code: string, Message: string}
     *   ]
     * }
     *
     * See http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#sendMessageBatch-property for full details.
     * The "Id" supplied in the response will be the index of the message in the original messages array, in string
     * form.
     * @param {string|Object||Array<string|Object>} messages An array of messages to be sent. Objects will be
     *    JSON.stringified.
     * @param {number} [delay] The number of seconds by which to delay the delivery of the messages, max 900. If not
     *    specified, the queue default will be used.
     * @param {Object} [attributes] An optional attributes mapping to associate with all messages. For more information,
     *    see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#sendMessageBatch-property.
     * @returns {Promise.<{Successful: Array<{Id: string, MessageId: string, MD5OfMessageAttributes: string,
     *    MD5OfMessageBody: string}>, Failed: Array<{Id: string, SenderFault: boolean, Code: string,
     *    Message: string}>}>} Resolves with successful and failed messages, rejects with API error on critical failure.
     */
    public sendMessages(messages: IMessageToSend[] | IMessageToSend, delay?: number,
                        attributes?: IMessageAttributes | IMessageAttributes[])
        : Promise<SQS.Types.SendMessageBatchResult> {
        const batches: ISendMessageRequest[][] = [];
        const msgs: IMessageToSend[] = Array.isArray(messages) ? messages : [messages];
        const promises: Array<Promise<ISendMessageRequest>> = [];
        msgs.forEach((msg, i) => {
            let currentAttributes: IMessageAttributes | undefined;
            if (attributes) {
                if (!Array.isArray(attributes)) {
                    currentAttributes = attributes;
                } else {
                    currentAttributes = attributes[i];
                }
            }
            promises.push(this.perpareMessageRequest(msg, delay, currentAttributes));
        });
        return Promise.all([this.getQueueMaximumMessageSize(), Promise.all(promises)])
            .then((results) => {
                const queueMaximumMessageSize = results[0];
                const messageRequests = results[1];
                let currentBatchSize = 0;
                let currentBatchLength = 0;
                messageRequests.forEach((message) => {
                    const messageSize = getMessageSize(message);
                    if (currentBatchLength % AWS_MAX_SEND_BATCH === 0 ||
                        currentBatchSize + messageSize >= queueMaximumMessageSize) {
                        currentBatchLength = 0;
                        currentBatchSize = 0;
                        batches.push([]);
                    }
                    currentBatchSize += messageSize;
                    currentBatchLength++;
                    batches[batches.length - 1].push(message);
                });
                return Promise.all(batches.map((batch, idx) => {
                    return this._sendMessageBatch(batch, delay, idx * AWS_MAX_SEND_BATCH);
                }));
            })
            .then((results) => {
                const merged: SQS.Types.SendMessageBatchResult = {Successful: [], Failed: []};
                results.forEach((res) => {
                    res.Successful.forEach((elem) => merged.Successful.push(elem));
                    res.Failed.forEach((elem) => merged.Failed.push(elem));
                });
                return merged;
            });
    }

    /**
     * Starts the poller, if it's not already running.
     * @returns {Promise} Resolves when the poller has been started; resolves instantly if the poller is already running
     */
    public start(): Promise<void> {
        if (this._running) {
            return Promise.resolve();
        }
        this._running = true;
        return this._startPoller();
    }

    /**
     * Stops the poller.
     * @param {boolean} [soft=false] If a soft stop is performed, any active SQS request for new messages will be left
     *    open until it terminates naturally. Note that if this is the case, the message event may still be fired after
     *    this function has been called.
     * @param {timeout} [timeout=undefined] Timeout in milliseconds to wait for the queue to drain before resolving.
     * @returns {Promise} Will be resolved when the queue is drained (true value) or timeout passed (false value).
     */
    public stop(soft?: boolean, timeout?: number): Promise<boolean> {
        if (!soft && this._activeReq) {
            this._activeReq.abort();
        }
        this._running = false;
        this._paused = false;
        if (!this._inFlight) {
            return Promise.resolve(true);
        }
        const scope = this;
        return new Promise((resolve) => {
            let resolved = false;
            let timer: NodeJS.Timeout | undefined;
            scope.on('drained', () => {
                if (!resolved) {
                    resolved = true;
                    if (timer) {
                        clearTimeout(timer);
                        timer = undefined;
                    }
                    resolve(true);
                }
            });
            if (timeout) {
                timer = setTimeout(() => {
                    resolved = true;
                    resolve(false);
                }, timeout);
            }
        });
    }

    /**
     * Deletes a batch of messages (maximum 10) from Amazon SQS.  If there is an error making the call to SQS, the
     * `error` event will be emitted with an Error object. If SQS reports any issue deleting any of the messages,
     * the `delError` event will be emitted with the failure object passed back by the AWS SDK.
     * @param {Array<{Id: string, ReceiptHandle: string}>} batch The batch of messages to be deleted, in the format
     *    required for sqs.deleteMessageBatch's Entries parameter.
     * @private8
     */
    public _deleteMessages(batch: IDeleteQueueItem[]): Promise<void> {
        const itemById: IDeleteQueueItemById = batch.reduce((prevByValue, item) => {
            prevByValue[item.Id] = item;
            return prevByValue;
        }, {} as IDeleteQueueItemById);
        return this.getQueueUrl().then((queueUrl) => {
            return this.sqs.deleteMessageBatch({
                QueueUrl: queueUrl,
                Entries: batch.map((item) => {
                    return {
                        Id: item.Id,
                        ReceiptHandle: item.ReceiptHandle,
                    };
                }),
            }).promise();
        }).then((data) => {
            if (data.Failed && data.Failed.length) {
                data.Failed.forEach((fail) => {
                    this.emit('delError', fail);
                    itemById[fail.Id].msg.emit('delError', fail);
                    itemById[fail.Id].reject(fail);
                });
            }
            if (data.Successful && data.Successful.length) {
                data.Successful.forEach((success) => {
                    this.emit('deleted', success.Id);
                    itemById[success.Id].msg.emit('deleted');
                    itemById[success.Id].resolve();
                });
            }
        }).catch((err) => {
            this.emit('error', err);
            return Promise.reject(err);
        });
    }

    /**
     * Given an array of message bodies from SQS, this method will construct Message objects for each and emit them
     * in separate `message` events.
     * @param {Array<Object>} messages An array of SQS message objects, as returned from the aws sdk
     * @private
     */
    public _emitMessages(messages: SQS.MessageList): void {
        messages.forEach((msg) => {
            const message = new Message({
                squiss: this,
                unwrapSns: this._opts.unwrapSns,
                bodyFormat: this._opts.bodyFormat,
                msg,
                s3Retriever: this.getS3.bind(this),
                s3Retain: this._opts.s3Retain || false,
            });
            this._inFlight++;
            message.parse()
                .then(() => {
                    this.emit('message', message);
                });
        });
    }

    /**
     * Gets a new batch of messages from Amazon SQS. A `message` event will be emitted for each new message, with
     * the provided object being an instance of Squiss' Message class.
     * @private
     */
    public _getBatch(queueUrl: string): void {
        if (this._activeReq || !this._running) {
            return;
        }
        const next = this._getBatch.bind(this, queueUrl);
        const maxMessagesToGet = !this._opts.maxInFlight ? this._opts.receiveBatchSize! :
            Math.min(this._opts.maxInFlight! - this._inFlight, this._opts.receiveBatchSize!);
        if (maxMessagesToGet < this._opts.minReceiveBatchSize!) {
            this._paused = true;
            return;
        }
        const params: SQS.Types.ReceiveMessageRequest = {
            QueueUrl: queueUrl,
            MaxNumberOfMessages: maxMessagesToGet,
            WaitTimeSeconds: this._opts.receiveWaitTimeSecs,
        };
        params.MessageAttributeNames = this._opts.receiveAttributes;
        params.AttributeNames = this._opts.receiveSqsAttributes;
        if (this._opts.visibilityTimeoutSecs !== undefined) {
            params.VisibilityTimeout = this._opts.visibilityTimeoutSecs;
        }
        this._activeReq = this.sqs.receiveMessage(params);
        this._activeReq.promise().then((data) => {
            let gotMessages = true;
            this._activeReq = undefined;
            if (data && data.Messages) {
                this.emit('gotMessages', data.Messages.length);
                this._emitMessages(data.Messages);
            } else {
                this.emit('queueEmpty');
                gotMessages = false;
            }
            if (this._slotsAvailable()) {
                if (gotMessages && this._opts.activePollIntervalMs) {
                    setTimeout(next, this._opts.activePollIntervalMs);
                } else if (!gotMessages && this._opts.idlePollIntervalMs) {
                    setTimeout(next, this._opts.idlePollIntervalMs);
                } else {
                    next();
                }
            } else {
                this._paused = true;
                this.emit('maxInFlight');
            }
        }).catch((err) => {
            this._activeReq = undefined;
            if (err.code && err.code === 'RequestAbortedError') {
                this.emit('aborted');
            } else {
                setTimeout(next, this._opts.pollRetryMs);
                this.emit('error', err);
            }
        });
    }

    /**
     * Initializes the TimeoutExtender and associates it with this Squiss instance, if and only if the options passed
     * to the constructor dictate that a TimeoutExtender is required.
     * @returns {Promise} Resolves when the TimeoutExtender has been initialized
     * @private
     */
    public _initTimeoutExtender(): Promise<void> {
        if (!this._opts.autoExtendTimeout || this._timeoutExtender) {
            return Promise.resolve();
        }
        return Promise.resolve().then(() => {
            if (this._opts.visibilityTimeoutSecs) {
                return this._opts.visibilityTimeoutSecs;
            }
            return this.getQueueVisibilityTimeout();
        }).then((visibilityTimeoutSecs) => {
            const opts: ITimeoutExtenderOptions = {visibilityTimeoutSecs};
            if (this._opts.noExtensionsAfterSecs) {
                opts.noExtensionsAfterSecs = this._opts.noExtensionsAfterSecs;
            }
            if (this._opts.advancedCallMs) {
                opts.advancedCallMs = this._opts.advancedCallMs;
            }
            this._timeoutExtender = new TimeoutExtender(this, opts);
        });
    }

    /**
     * Sends a batch of a maximum of 10 messages to Amazon SQS. The Id generated for each will be the stringified
     * index of each message in the array, plus the startIndex
     * @param {Array<string|Object>} messages An array of messages to be sent. Objects will be JSON.stringified.
     * @param {number} [delay] The number of seconds by which to delay the delivery of the messages, max 900. If not
     *    specified, the queue default will be used.
     * @param {Object} [attributes] An optional attributes mapping to associate with all messages. For more information,
     *    see http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#sendMessageBatch-property.
     * @param {number} [startIndex=0] The index at which to start numbering the messages.
     * @returns {Promise.<{Successful: Array<{Id: string, MessageId: string, MD5OfMessageAttributes: string,
     *    MD5OfMessageBody: string}>, Failed: Array<{Id: string, SenderFault: boolean, Code: string,
     *    Message: string}>}>} Resolves with successful and failed messages, rejects with API error on critical failure.
     * @private
     */
    public _sendMessageBatch(messages: ISendMessageRequest[], delay: number | undefined, startIndex: number):
        Promise<SQS.Types.SendMessageBatchResult> {
        const start = startIndex || 0;
        return this.getQueueUrl().then((queueUrl) => {
            const params: SQS.Types.SendMessageBatchRequest = {
                QueueUrl: queueUrl,
                Entries: [],
            };
            const promises: Array<Promise<void>> = [];
            messages.forEach((msg, idx) => {
                const entry: SQS.Types.SendMessageBatchRequestEntry = {
                    Id: (start + idx).toString(),
                    ...msg,
                };
                params.Entries.push(entry);
            });
            return Promise.all(promises)
                .then(() => {
                    return this.sqs.sendMessageBatch(params).promise();
                });
        });
    }

    /**
     * Determines if there are enough available slots to receive another batch of messages from Amazon SQS without going
     * over the maxInFlight limit set in the constructor options.
     * @returns {boolean}
     * @private
     */
    public _slotsAvailable(): boolean {
        return !this._opts.maxInFlight || this._inFlight < this._opts.maxInFlight;
    }

    /**
     * Starts the polling process, regardless of the status of the this._running or this._paused flags.
     * @returns {Promise} Resolves when the poller has started
     * @private
     */
    public _startPoller(): Promise<void> {
        return this._initTimeoutExtender()
            .then(() => this.getQueueUrl())
            .then((queueUrl) => this._getBatch(queueUrl))
            .catch((e) => {
                this.emit('error', e);
            });
    }

    public getS3(): S3 {
        if (this._s3) {
            return this._s3;
        }
        if (this._opts.S3) {
            if (typeof this._opts.S3 === 'function') {
                this._s3 = new this._opts.S3(this._opts.awsConfig);
            } else {
                this._s3 = this._opts.S3;
            }
        } else {
            this._s3 = new S3(this._opts.awsConfig);
        }
        return this._s3;
    }

    private isLargeMessage(message: ISendMessageRequest): Promise<boolean> {
        return this.getQueueMaximumMessageSize()
            .then((queueMaximumMessageSize) => {
                return getMessageSize(message) >= queueMaximumMessageSize;
            });
    }

    private perpareMessageRequest(message: IMessageToSend, delay?: number, attributes?: IMessageAttributes)
        : Promise<ISendMessageRequest> {
        if (attributes && attributes[GZIP_MARKER]) {
            return Promise.reject(new Error(`Using of internal attribute ${GZIP_MARKER} is not allowed`));
        }
        if (attributes && attributes[S3_MARKER]) {
            return Promise.reject(new Error(`Using of internal attribute ${S3_MARKER} is not allowed`));
        }
        const messageStr = isString(message) ? message : JSON.stringify(message);
        const params: ISendMessageRequest = {
            MessageBody: messageStr,
        };
        if (delay) {
            params.DelaySeconds = delay;
        }
        if (attributes) {
            attributes = Object.assign({}, attributes);
        }
        if (attributes) {
            if (attributes.FIFO_MessageGroupId) {
                params.MessageGroupId = attributes.FIFO_MessageGroupId;
                delete attributes.FIFO_MessageGroupId;
            }
            if (attributes.FIFO_MessageDeduplicationId) {
                params.MessageDeduplicationId = attributes.FIFO_MessageDeduplicationId;
                delete attributes.FIFO_MessageDeduplicationId;
            }
            params.MessageAttributes = createMessageAttributes(attributes);
        }
        let promise: Promise<string>;
        if (this._opts.gzip) {
            if (this._opts.minGzipSize && getMessageSize(params) < this._opts.minGzipSize) {
                promise = Promise.resolve(messageStr);
            } else {
                promise = compressMessage(messageStr);
                params.MessageAttributes = params.MessageAttributes || {};
                params.MessageAttributes[GZIP_MARKER] = {
                    StringValue: `1`,
                    DataType: 'Number',
                };
            }
        } else {
            promise = Promise.resolve(messageStr);
        }
        return promise
            .then((finalMessage) => {
                params.MessageBody = finalMessage;
                if (!this._opts.s3Fallback) {
                    return Promise.resolve(params);
                }
                return this.isLargeMessage(params)
                    .then((isLarge) => {
                        if (!isLarge) {
                            return Promise.resolve(params);
                        }
                        return uploadBlob(this.getS3(), this._opts.s3Bucket!, finalMessage, this._opts.s3Prefix || '')
                            .then((uploadData) => {
                                params.MessageBody = JSON.stringify(uploadData);
                                params.MessageAttributes = params.MessageAttributes || {};
                                params.MessageAttributes[S3_MARKER] = {
                                    StringValue: `${uploadData.uploadSize}`,
                                    DataType: 'Number',
                                };
                                return Promise.resolve(params);
                            });
                    });
            });
    }
}
