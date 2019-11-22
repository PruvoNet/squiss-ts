'use strict';

import {SQS_MAX_RECEIVE_BATCH, Squiss} from './Squiss';
import {ResubmitterConfig, ResubmitterMutator} from './Types';
import {Message} from './Message';

const DEFAULT_SQUISS_OPTS = {
    receiveAttributes: ['All'],
    receiveSqsAttributes: ['All'],
    minReceiveBatchSize: 0,
    unwrapSns: false,
};

export class Resubmitter {

    public squissFrom: Squiss;
    public squissTo: Squiss;
    private _numHandledMessages = 0;
    private _handledMessages = new Set<string>();
    private readonly _limit: number;
    private readonly _customMutator?: ResubmitterMutator;
    private readonly _releaseTimeoutSeconds: number;

    constructor(config: ResubmitterConfig) {
        this.squissFrom = new Squiss({
            ...config.resubmitFromQueueConfig,
            ...DEFAULT_SQUISS_OPTS,
        });
        this.squissTo = new Squiss({
            ...config.resubmitToQueueConfig,
            ...DEFAULT_SQUISS_OPTS,
        });
        this._limit = config.limit;
        this._customMutator = config.customMutator;
        this._releaseTimeoutSeconds = config.releaseTimeoutSeconds;
    }

    public run() {
        this._numHandledMessages = 0;
        this._handledMessages = new Set<string>();
        return Promise.resolve()
            .then(() => {
                return this._iteration();
            });
    }

    private _changeMessageVisibility(message: Message) {
        return message.changeVisibility(this._releaseTimeoutSeconds);
    }

    private _handleMessage(message: Message): Promise<void> {
        console.log(`${++this._numHandledMessages} messages handled`);
        const location = message.raw.MessageId ?? '';
        if (this._numHandledMessages > this._limit || this._handledMessages.has(location)) {
            return this._changeMessageVisibility(message);
        }
        this._handledMessages.add(location);
        let body = message.body;
        if (this._customMutator) {
            body = this._customMutator(body);
        }
        return this.squissTo.sendMessage(body, undefined, message.attributes)
            .then(() => {
                return message.del();
            })
            .catch((err) => {
                return this._changeMessageVisibility(message)
                    .then(() => {
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
        return this.squissFrom.getManualBatch(numberOfMessageToRead)
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
