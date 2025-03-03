import {EventEmitter} from 'events';
import {Message} from './Message';
import {ITimeoutExtenderOptions, TimeoutExtender} from './TimeoutExtender';
import {createMessageAttributes, IMessageAttributes} from './attributeUtils';
import {isString} from 'ts-type-guards';
import {    ReceiveMessageCommandInput,
    BatchResultErrorEntry,
    SendMessageBatchRequestEntry,
    SendMessageBatchResult,
    SendMessageBatchResultEntry,
    SendMessageBatchCommandInput,
    SendMessageBatchCommandOutput,
    SendMessageCommandInput,
    SQSServiceException,
    ReceiveMessageCommandOutput,
    SQS, CreateQueueCommandInput,
    GetQueueUrlCommandInput,
    SendMessageCommandOutput,
    Message as SQSMessage,DeleteMessageBatchCommandOutput
} from '@aws-sdk/client-sqs'
import {S3} from '@aws-sdk/client-s3'
import {GZIP_MARKER, compressMessage} from './gzipUtils';
import {S3_MARKER, uploadBlob} from './s3Utils';
import {getMessageSize} from './messageSizeUtils';
import {
    IMessageToSend, ISendMessageRequest,
    IDeleteQueueItem, IDeleteQueueItemById, optDefaults, SquissEmitter, ISquissOptions
} from './Types';
import {removeEmptyKeys} from './Utils';
import { URL } from 'url';
import {Endpoint, EndpointV2} from '@aws-sdk/types';

const AWS_MAX_SEND_BATCH = 10;

export class Squiss extends (EventEmitter as new() => SquissEmitter) {

    public get inFlight(): number {
        return this._inFlight;
    }

    public get running(): boolean {
        return this._running;
    }

    public sqs: SQS;
    public _timeoutExtender: TimeoutExtender | undefined;
    public _opts: ISquissOptions;
    private _s3?: S3;
    private _running = false;
    private _paused = true;
    private _inFlight = 0;
    private _queueVisibilityTimeout = 0;
    private _queueMaximumMessageSize = 0;
    private _queueUrl: string;
    private _delQueue = new Map<string, IDeleteQueueItem>();
    private _delTimer: any;
    private _activeReq: AbortController | undefined;

    constructor(opts?: ISquissOptions | undefined) {
        super();
        this._opts = Object.assign({}, optDefaults, opts || {});
        this._initOpts();
        this._queueUrl = this._opts.queueUrl || '';
        this.sqs = this._initSqs();
        this._drainDeleteQueue = this._drainDeleteQueue.bind(this);
    }

    public changeMessageVisibility(msg: Message | string, timeoutInSeconds: number): Promise<void> {
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
                    });
                }
            )
            .then(() => {
                return Promise.resolve();
            });
    }

    public createQueue(): Promise<string> {
        if (!this._opts.queueName) {
            return Promise.reject(new Error('Squiss was not instantiated with a queueName'));
        }
        const params: CreateQueueCommandInput = {
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
        return this.sqs.createQueue(params).then((res) => {
            this._queueUrl = res.QueueUrl!;
            return res.QueueUrl!;
        });
    }

    public async deleteMessage(msg: Message): Promise<void> {
        if (!msg.raw) {
            throw new Error('Squiss.deleteMessage requires a Message object');
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
            await this._deleteXMessages(this._opts.deleteBatchSize);
        } else if (!this._delTimer) {
            this._delTimer = setTimeout(async () => {
                this._delTimer = undefined;
                await this._deleteXMessages();
            }, this._opts.deleteWaitMs);
        }
        return promise;
    }

    public deleteQueue(): Promise<void> {
        return this.getQueueUrl()
            .then((queueUrl) => {
                return this.sqs.deleteQueue({QueueUrl: queueUrl});
            })
            .then(() => {
                return Promise.resolve();
            });
    }

    public getQueueUrl(): Promise<string> {
        if (this._queueUrl) {
            return Promise.resolve(this._queueUrl);
        }
        const params: GetQueueUrlCommandInput = {QueueName: this._opts.queueName!};
        if (this._opts.accountNumber) {
            params.QueueOwnerAWSAccountId = this._opts.accountNumber.toString();
        }
        return this.sqs.getQueueUrl(params).then(async (data) => {
            this._queueUrl = data.QueueUrl!;
            if (this._opts.correctQueueUrl) {
                let newUrl: URL | undefined;
                const endpoint = this.sqs.config.endpoint;
                /* istanbul ignore else  */
                if (typeof endpoint === 'string') {
                    newUrl = new URL(endpoint);
                } else if (typeof endpoint === 'function') {
                    const retrievedEndpoint = await endpoint();
                    if (retrievedEndpoint && typeof retrievedEndpoint === 'object') {
                        if ('url' in retrievedEndpoint) {
                            newUrl = new URL((retrievedEndpoint as EndpointV2).url.toString());
                        }
                        if ('hostname' in retrievedEndpoint) {
                            const { protocol, hostname, port, path } = retrievedEndpoint as Endpoint;
                            // query params are ignored in setting endpoint.
                            newUrl = new URL(`${protocol}//${hostname}${port ? ':' + port : ''}${path}`);
                        }
                    }
                }
                /* istanbul ignore if */
                if (!newUrl) {
                    throw new Error('Failed to get configured SQQ endpoint');
                }
                const parsedQueueUrl = new URL(this._queueUrl);
                newUrl.pathname = parsedQueueUrl.pathname;
                this._queueUrl = newUrl.toString();
            }
            return this._queueUrl;
        });
    }

    public getQueueVisibilityTimeout(): Promise<number> {
        if (this._queueVisibilityTimeout) {
            return Promise.resolve(this._queueVisibilityTimeout);
        }
        return this.getQueueUrl().then((queueUrl) => {
            return this.sqs.getQueueAttributes({
                AttributeNames: ['VisibilityTimeout'],
                QueueUrl: queueUrl,
            });
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
            });
        }).then((res) => {
            if (!res.Attributes || !res.Attributes.MaximumMessageSize) {
                throw new Error('SQS.GetQueueAttributes call did not return expected shape. Response: ' +
                    JSON.stringify(res));
            }
            this._queueMaximumMessageSize = parseInt(res.Attributes.MaximumMessageSize, 10);
            return this._queueMaximumMessageSize;
        });
    }

    public handledMessage(msg: Message): void {
        this._inFlight--;
        if (this._paused && this._slotsAvailable()) {
            this._paused = false;
            this._startPoller()
                .catch((e: Error) => {
                    this.emit('error', e);
                });
        }
        msg.emit('handled');
        this.emit('handled', msg);
        if (!this._inFlight) {
            this.emit('drained');
        }
    }

    public releaseMessage(msg: Message): Promise<void> {
        this.handledMessage(msg);
        return this.changeMessageVisibility(msg, 0)
            .then((res) => {
                msg.emit('released');
                this.emit('released', msg);
                return res;
            });
    }

    public purgeQueue(): Promise<void> {
        return this.getQueueUrl()
            .then((queueUrl) => {
                return this.sqs.purgeQueue({QueueUrl: queueUrl});
            })
            .then(() => {
                this._inFlight = 0;
                this._delQueue = new Map();
                this._delTimer = undefined;
                return Promise.resolve();
            });
    }

    public sendMessage(message: IMessageToSend, delay?: number, attributes?: IMessageAttributes)
        : Promise<SendMessageCommandOutput> {
        return Promise.all([
            this._prepareMessageRequest(message, delay, attributes),
            this.getQueueUrl(),
        ])
            .then((data) => {
                const rawParams = data[0];
                const queueUrl = data[1];
                const params: SendMessageCommandInput = {
                    QueueUrl: queueUrl,
                    ...rawParams,
                };
                return this.sqs.sendMessage(params);
            });
    }

    public sendMessages(messages: IMessageToSend[] | IMessageToSend, delay?: number,
                        attributes?: IMessageAttributes | IMessageAttributes[])
        : Promise<SendMessageBatchResult> {
        return this.getQueueMaximumMessageSize()
            .then((queueMaximumMessageSize) => {
                return this._prepareMessagesToSend(messages, queueMaximumMessageSize, delay, attributes);
            })
            .then((batches) => {
                return Promise.all(batches.map((batch, idx) => {
                    return this._sendMessageBatch(batch, delay, idx * AWS_MAX_SEND_BATCH);
                }));
            })
            .then((results) => {
                const successful: SendMessageBatchResultEntry[] = [];
                const failed: BatchResultErrorEntry[] = [];
                results.forEach((res) => {
                    res.Successful?.forEach((elem) => successful.push(elem));
                    res.Failed?.forEach((elem) => failed.push(elem));
                });
                return {Successful: successful, Failed: failed};
            });
    }

    public start(): Promise<void> {
        if (this._running) {
            return Promise.resolve();
        }
        this._running = true;
        return this._startPoller();
    }

    public async stop(soft?: boolean, timeout?: number): Promise<boolean> {
        if (!soft && this._activeReq) {
            this._activeReq.abort();
        }
        this._running = this._paused = false;
        if (!this._inFlight) {
            await this._drainDeleteQueue();
            return true;
        }
        let resolved = false;
        let timer: any;
        const result = await new Promise<boolean>(async (resolve) => {
            this.on('drained',() => {
                if (!resolved) {
                    resolved = true;
                    if (timer) {
                        clearTimeout(timer);
                        timer = undefined;
                    }
                    resolve(true);
                }
            });
            timer = timeout ? setTimeout(() => {
                resolved = true;
                resolve(false);
            }, timeout) : undefined;
        });
        await this._drainDeleteQueue();
        return result;
    }

    public getS3(): S3 {
        if (!this._s3) {
            this._s3 = this._initS3();
        }
        return this._s3;
    }

    private async _drainDeleteQueue(): Promise<void> {
        if (this._delTimer) {
            clearTimeout(this._delTimer);
            this._delTimer = undefined;
        }
        await this._deleteXMessages();
    }

    private _initS3() {
        if (this._opts.S3) {
            if (typeof this._opts.S3 === 'function') {
                return new this._opts.S3(this._opts.awsConfig || {});
            } else {
                return this._opts.S3;
            }
        } else {
            /* istanbul ignore next */
            return new S3(this._opts.awsConfig || {});
        }
    }

    private _initOpts() {
        if (!this._opts.queueUrl && !this._opts.queueName) {
            throw new Error('Squiss requires either the "queueUrl", or the "queueName".');
        }
        if (this._opts.s3Fallback && !this._opts.s3Bucket) {
            throw new Error('Squiss requires "s3Bucket" to be defined is using s3 fallback');
        }
        this._opts.deleteBatchSize = Math.min(this._opts.deleteBatchSize!, 10);
        this._opts.receiveBatchSize = Math.min(this._opts.receiveBatchSize!,
            this._opts.maxInFlight! > 0 ? this._opts.maxInFlight! : 10, 10);
        this._opts.minReceiveBatchSize = Math.min(this._opts.minReceiveBatchSize!, this._opts.receiveBatchSize);
    }

    private async _deleteMessages(batch: IDeleteQueueItem[]): Promise<void> {
        if (batch.length === 0) {
            return;
        }
        return this.getQueueUrl().then((queueUrl) => {
            return this.sqs.deleteMessageBatch({
                QueueUrl: queueUrl,
                Entries: batch.map((item) => {
                    return {
                        Id: item.Id,
                        ReceiptHandle: item.ReceiptHandle,
                    };
                }),
            });
        }).then(this._handleBatchDeleteResults(batch))
            .catch((err: Error) => {
                this.emit('error', err);
            });
    }

    private _emitMessages(messages: SQSMessage[]): void {
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
                })
                .catch((e: Error) => {
                    this.emit('error', e);
                    message.release();
                });
        });
    }

    private _getBatch(queueUrl: string): void {
        if (this._activeReq || !this._running) {
            return;
        }
        const maxMessagesToGet = this._getMaxMessagesToGet();
        if (maxMessagesToGet < this._opts.minReceiveBatchSize!) {
            this._paused = true;
            return;
        }
        const params: ReceiveMessageCommandInput = removeEmptyKeys({
            QueueUrl: queueUrl, MaxNumberOfMessages: maxMessagesToGet,
            WaitTimeSeconds: this._opts.receiveWaitTimeSecs,
            MessageAttributeNames: this._opts.receiveAttributes,
            AttributeNames: this._opts.receiveSqsAttributes,
            VisibilityTimeout: this._opts.visibilityTimeoutSecs,
        });
        const controller = new AbortController();
        this._activeReq = controller;
        this.sqs.receiveMessage(params, {
            abortSignal: controller.signal,
        }).then(this._handleGetBatchResult(queueUrl)).catch((err: SQSServiceException) => {
            this._activeReq = undefined;
            if (err.name === 'AbortError') {
                this.emit('aborted', err);
            } else {
                setTimeout(this._getBatch.bind(this, queueUrl), this._opts.pollRetryMs);
                this.emit('error', err);
            }
        });
    }

    private _initTimeoutExtender(): Promise<void> {
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

    private _sendMessageBatch(messages: ISendMessageRequest[], delay: number | undefined, startIndex: number):
        Promise<SendMessageBatchCommandOutput> {
        const start = startIndex || 0;
        return this.getQueueUrl().then((queueUrl) => {
            const entries: SendMessageBatchRequestEntry[] = [];
            const params: SendMessageBatchCommandInput = {
                QueueUrl: queueUrl,
                Entries: entries,
            };
            const promises: Promise<void>[] = [];
            messages.forEach((msg, idx) => {
                const entry: SendMessageBatchRequestEntry = {
                    Id: (start + idx).toString(),
                    ...msg,
                };
                entries.push(entry);
            });
            return Promise.all(promises)
                .then(() => {
                    return this.sqs.sendMessageBatch(params);
                });
        });
    }

    private _slotsAvailable(): boolean {
        return !this._opts.maxInFlight || this._inFlight < this._opts.maxInFlight;
    }

    private _startPoller(): Promise<void> {
        return this._initTimeoutExtender()
            .then(() => this.getQueueUrl())
            .then((queueUrl): void => {
                this._getBatch(queueUrl);
            })
    }

    private async _deleteXMessages(x?: number): Promise<void> {
        const delQueue = this._delQueue;
        const iterator = delQueue.entries();
        const delBatch = Array.from({length: x || delQueue.size}, function(this: typeof iterator) {
            const element = this.next().value;
            delQueue.delete(element[0]);
            return element[1];
        }, iterator);
        await this._deleteMessages(delBatch);
    }

    private _isLargeMessage(message: ISendMessageRequest, minSize?: number): Promise<boolean> {
        const messageSize = getMessageSize(message);
        if (minSize) {
            return Promise.resolve(messageSize > minSize);
        }
        return this.getQueueMaximumMessageSize()
            .then((queueMaximumMessageSize) => {
                return messageSize >= queueMaximumMessageSize;
            });
    }

    private _prepareMessageParams(message: IMessageToSend, delay?: number, attributes?: IMessageAttributes) {
        const messageStr = isString(message) ? message : JSON.stringify(message);
        const params: ISendMessageRequest = {MessageBody: messageStr, DelaySeconds: delay};
        attributes = Object.assign({}, attributes);
        params.MessageGroupId = attributes.FIFO_MessageGroupId;
        delete attributes.FIFO_MessageGroupId;
        params.MessageDeduplicationId = attributes.FIFO_MessageDeduplicationId;
        delete attributes.FIFO_MessageDeduplicationId;
        params.MessageAttributes = createMessageAttributes(attributes);
        let getMessagePromise = Promise.resolve(messageStr);
        if (this._opts.gzip && (!this._opts.minGzipSize || getMessageSize(params) >= this._opts.minGzipSize)) {
            getMessagePromise = compressMessage(messageStr);
            params.MessageAttributes = params.MessageAttributes || {};
            params.MessageAttributes[GZIP_MARKER] = {
                StringValue: '1',
                DataType: 'Number',
            };
        }
        return getMessagePromise.then((finalMessage) => {
            params.MessageBody = finalMessage;
            return {finalMessage, params};
        });
    }

    private _handleLargeMessagePrepare({finalMessage, params}: { finalMessage: string, params: ISendMessageRequest }) {
        if (!this._opts.s3Fallback) {
            return Promise.resolve(params);
        }
        return this._isLargeMessage(params, this._opts.minS3Size)
            .then((isLarge) => {
                if (!isLarge) {
                    return Promise.resolve(params);
                }
                return uploadBlob(this.getS3(), this._opts.s3Bucket!, finalMessage, this._opts.s3Prefix || '')
                    .then((uploadData) => {
                        this.emit('s3Upload', uploadData);
                        params.MessageBody = JSON.stringify(uploadData);
                        params.MessageAttributes = params.MessageAttributes || {};
                        params.MessageAttributes[S3_MARKER] = {
                            StringValue: `${uploadData.uploadSize}`,
                            DataType: 'Number',
                        };
                        return Promise.resolve(params);
                    });
            });
    }

    private _prepareMessageRequest(message: IMessageToSend, delay?: number, attributes?: IMessageAttributes)
        : Promise<ISendMessageRequest> {
        if (attributes && attributes[GZIP_MARKER]) {
            return Promise.reject(new Error(`Using of internal attribute ${GZIP_MARKER} is not allowed`));
        }
        if (attributes && attributes[S3_MARKER]) {
            return Promise.reject(new Error(`Using of internal attribute ${S3_MARKER} is not allowed`));
        }
        return this._prepareMessageParams(message, delay, attributes)
            .then(this._handleLargeMessagePrepare.bind(this))
            .then((params) => {
                return removeEmptyKeys(params);
            });
    }

    private _initSqs() {
        if (this._opts.SQS) {
            if (typeof this._opts.SQS === 'function') {
                return new this._opts.SQS(this._opts.awsConfig || {});
            } else {
                return this._opts.SQS;
            }
        } else {
            return new SQS(this._opts.awsConfig || {});
        }
    }

    private _handleBatchDeleteResults(batch: IDeleteQueueItem[]) {
        const itemById: IDeleteQueueItemById = batch.reduce((prevByValue, item) => {
            prevByValue[item.Id] = item;
            return prevByValue;
        }, {} as IDeleteQueueItemById);
        return (data: DeleteMessageBatchCommandOutput) => {
            if (data.Failed?.length) {
                data.Failed.forEach((fail) => {
                    /* istanbul ignore next */
                    const item = itemById[fail.Id ?? ''];
                    this.emit('delError', {error: fail, message: item.msg});
                    item.msg.emit('delError', fail);
                    item.reject(fail);
                });
            }
            if (data.Successful?.length) {
                data.Successful.forEach((success) => {
                    /* istanbul ignore next */
                    const id = success.Id ?? '';
                    const item = itemById[id];
                    const msg = item.msg;
                    this.emit('deleted', {msg, successId: id});
                    msg.emit('deleted', id);
                    item.resolve();
                });
            }
        };
    }

    private _prepareMessagesToSend(messages: IMessageToSend[] | IMessageToSend, queueMaximumMessageSize: number,
                                   delay?: number, attributes?: IMessageAttributes | IMessageAttributes[]) {
        const msgs: IMessageToSend[] = Array.isArray(messages) ? messages : [messages];
        const defaultAttributes = (attributes && !Array.isArray(attributes)) ? attributes : undefined;
        const arrayAttributes = (attributes && Array.isArray(attributes)) ? attributes : [];
        const promises = msgs.map((msg, i) => {
            return this._prepareMessageRequest(msg, delay, defaultAttributes || arrayAttributes[i]);
        });
        return Promise.all(promises)
            .then((requests) => {
                const batches: ISendMessageRequest[][] = [];
                let currentBatchSize = 0;
                let currentBatchLength = 0;
                requests.forEach((message) => {
                    const messageSize = getMessageSize(message);
                    if (currentBatchLength % AWS_MAX_SEND_BATCH === 0 ||
                        currentBatchSize + messageSize >= queueMaximumMessageSize) {
                        currentBatchLength = currentBatchSize = 0;
                        batches.push([]);
                    }
                    currentBatchSize += messageSize;
                    currentBatchLength++;
                    batches[batches.length - 1].push(message);
                });
                return batches;
            });
    }

    private _handleGetBatchResult(queueUrl: string) {
        return (data: ReceiveMessageCommandOutput) => {
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
                const next = this._getBatch.bind(this, queueUrl);
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
        };
    }

    private _getMaxMessagesToGet() {
        return !this._opts.maxInFlight ? this._opts.receiveBatchSize! :
            Math.min(this._opts.maxInFlight! - this._inFlight, this._opts.receiveBatchSize!);
    }
}
