'use strict';

import {SQS_MAX_RECEIVE_BATCH, Squiss} from './Squiss';
import {ISquissOptions} from './Types';
import {Message} from './Message';
import {IMessageAttributes} from './attributeUtils';

const DEFAULT_SQUISS_OPTS = {
    receiveAttributes: ['All'],
    receiveSqsAttributes: ['All'],
    minReceiveBatchSize: 0,
    unwrapSns: false,
};

type MessageData = ResubmitterMutatorData;

export interface ResubmitterMutatorData {
    attributes: IMessageAttributes;
    body?: string | any;
}

export type ResubmitterMutator = (message: ResubmitterMutatorData) => Promise<ResubmitterMutatorData>;

export interface ResubmitterConfig {
    queues: {
        resubmitFromQueueConfig: ISquissOptions;
        resubmitToQueueConfig: ISquissOptions;
    };
    limit: number;
    customMutator?: ResubmitterMutator;
    releaseTimeoutSeconds: number;
    keepHandledMessages?: boolean;
    continueOnFail?: boolean;
    sendMessageDelaySeconds?: number;
}

export class Resubmitter {

    public _squissFrom: Squiss;
    public _squissTo: Squiss;
    private _numHandledMessages = 0;
    private readonly _handledMessages = new Set<string>();
    private readonly _limit: number;
    private readonly _customMutator?: ResubmitterMutator;
    private readonly _releaseTimeoutSeconds: number;
    private readonly _keepHandledMessages?: boolean;
    private readonly _continueOnFail?: boolean;
    private readonly _sendMessageDelaySeconds?: number;

    constructor(config: ResubmitterConfig) {
        this._squissFrom = new Squiss({
            ...config.queues.resubmitFromQueueConfig,
            ...DEFAULT_SQUISS_OPTS,
        });
        this._squissTo = new Squiss({
            ...config.queues.resubmitToQueueConfig,
            ...DEFAULT_SQUISS_OPTS,
        });
        this._limit = config.limit;
        this._customMutator = config.customMutator;
        this._releaseTimeoutSeconds = config.releaseTimeoutSeconds;
        this._keepHandledMessages = config.keepHandledMessages;
        this._continueOnFail = config.continueOnFail;
        this._sendMessageDelaySeconds = config.sendMessageDelaySeconds;
    }

    public run() {
        this._numHandledMessages = 0;
        this._handledMessages.clear();
        return Promise.resolve()
            .then(() => {
                return this._iteration();
            });
    }

    private _changeMessageVisibility(message: Message) {
        return message.changeVisibility(this._releaseTimeoutSeconds);
    }

    private _getMessageToSend(message: Message): Promise<MessageData> {
        const data: MessageData = {
            body: message.body,
            attributes: message.attributes,
        };
        if (this._customMutator) {
            return this._customMutator(data);
        }
        return Promise.resolve(data);
    }

    private _handleMessage(message: Message): Promise<void> {
        console.log(`${++this._numHandledMessages} messages handled`);
        const location = message.raw.MessageId ?? '';
        if (this._numHandledMessages > this._limit || this._handledMessages.has(location)) {
            return this._changeMessageVisibility(message);
        }
        this._handledMessages.add(location);
        return this._getMessageToSend(message)
            .then((messageData) => {
                return this._squissTo.sendMessage(
                    messageData.body, this._sendMessageDelaySeconds, messageData.attributes);
            })
            .then(() => {
                if (this._keepHandledMessages) {
                    return this._changeMessageVisibility(message);
                }
                return message.del();
            })
            .catch((err) => {
                return this._changeMessageVisibility(message)
                    .then(() => {
                        if (this._continueOnFail) {
                            return Promise.resolve();
                        }
                        return Promise.reject(err);
                    });
            });
    }

    private _iteration(): Promise<void> {
        const remainingMessagesToHandle = this._limit - this._numHandledMessages;
        if (remainingMessagesToHandle <= 0) {
            return Promise.resolve();
        }
        const numberOfMessageToRead = Math.min(SQS_MAX_RECEIVE_BATCH, remainingMessagesToHandle);
        return this._squissFrom.getManualBatch(numberOfMessageToRead)
            .then((messages) => {
                if (!messages.length) {
                    this._numHandledMessages = this._limit;
                }
                const promises = messages.map(this._handleMessage.bind(this));
                return Promise.all(promises).then(() => {
                    return Promise.resolve();
                });
            })
            .then(() => {
                return this._iteration();
            });
    }
}
