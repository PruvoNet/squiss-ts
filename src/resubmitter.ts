'use strict';

import {SQS_MAX_RECEIVE_BATCH, Squiss} from './Squiss';
import {IMessageToSend, ResubmitterConfig} from './Types';
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
    private numHandledMessages = 0;
    private handledMessages = new Set<string>();

    constructor(private config: ResubmitterConfig) {
        this.squissFrom = new Squiss({
            ...this.config.resubmitFromQueueConfig,
            ...DEFAULT_SQUISS_OPTS,
        });
        this.squissTo = new Squiss({
            ...this.config.resubmitToQueueConfig,
            ...DEFAULT_SQUISS_OPTS,
        });
    }

    public run() {
        this.numHandledMessages = 0;
        this.handledMessages = new Set<string>();
        return this._iteration();
    }

    private _readMessages(numberOfMessageToRead: number) {
        return this.squissFrom.getManualBatch(numberOfMessageToRead);
    }

    private _sendMessage(messageToSend: IMessageToSend, message: Message) {
        return this.squissTo.sendMessage(messageToSend, undefined, message.attributes);
    }

    private _changeMessageVisibility(message: Message) {
        return message.changeVisibility(this.config.releaseTimeoutSeconds);
    }

    private _handleMessage(message: Message): Promise<void> {
        return Promise.resolve().then(() => {
            console.log(`${++this.numHandledMessages} messages handled`);
            const location = message.raw.MessageId ?? '';
            if (this.numHandledMessages > this.config.limit || this.handledMessages.has(location)) {
                return this._changeMessageVisibility(message);
            }
            this.handledMessages.add(location);
            let body = message.body;
            if (this.config.customMutator) {
                body = this.config.customMutator(body);
            }
            return this._sendMessage(body, message)
                .then(() => {
                    return message.del();
                })
                .catch((err) => {
                    return this._changeMessageVisibility(message)
                        .then(() => {
                            return Promise.reject(err);
                        });
                });
        });
    }

    private _iteration(): Promise<void> {
        if (this.numHandledMessages >= this.config.limit || this.config.limit <= 0) {
            return Promise.resolve();
        }
        const numberOfMessageToRead =
            Math.min(SQS_MAX_RECEIVE_BATCH, Math.max(this.config.limit - this.numHandledMessages, 0));
        if (numberOfMessageToRead <= 0) {
            return Promise.resolve();
        }
        return this._readMessages(numberOfMessageToRead)
            .then((messages) => {
                if (!messages.length) {
                    this.numHandledMessages = this.config.limit;
                    return Promise.resolve();
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
