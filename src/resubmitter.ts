'use strict';

import {SQS_MAX_RECEIVE_BATCH, Squiss} from './Squiss';
import {IMessageToSend, ResubmitterConfig} from './Types';
import {Message} from './Message';

interface MessageContext {
    readonly message: Message;
}

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

    private _sendMessage(messageToSend: IMessageToSend, context: MessageContext) {
        return this.squissTo.sendMessage(messageToSend, undefined, context.message.attributes);
    }

    private _handleMessage(context: MessageContext): Promise<any> {
        return Promise.resolve()
            .then(() => {
                let body = context.message.body;
                if (this.config.customMutator) {
                    body = this.config.customMutator(body);
                }
                return this._sendMessage(body, context);
            });
    }

    private _iteration(): Promise<void> {
        if (this.numHandledMessages >= this.config.limit || this.config.limit <= 0) {
            return Promise.resolve();
        }
        const remaining = Math.max(this.config.limit - this.numHandledMessages, 0);
        const numberOfMessageToRead = Math.min(SQS_MAX_RECEIVE_BATCH, remaining);
        if (numberOfMessageToRead <= 0) {
            return Promise.resolve();
        }
        return this._readMessages(numberOfMessageToRead)
            .then((messages) => {
                if (!messages.length) {
                    // Make sure the iteration stops
                    this.numHandledMessages = this.config.limit;
                    return Promise.resolve();
                }
                const promises = messages.map((message) => {
                    const msgContext: MessageContext = {
                        message,
                    };
                    return Promise.resolve().then(() => {
                        console.log(`${++this.numHandledMessages} messages handled`);
                        if (this.numHandledMessages > this.config.limit) {
                            return message.changeVisibility(this.config.releaseTimeoutSeconds);
                        }
                        const location = message.raw.MessageId ?? '';
                        if (this.handledMessages.has(location)) {
                            return message.changeVisibility(this.config.releaseTimeoutSeconds);
                        }
                        this.handledMessages.add(location);
                        return this._handleMessage(msgContext)
                            .then(() => {
                                return message.del();
                            })
                            .catch((err) => {
                                return message.changeVisibility(this.config.releaseTimeoutSeconds)
                                    .then(() => {
                                        return Promise.reject(err);
                                    });
                            });
                    });
                });
                return Promise.all(promises).then(() => {
                    return Promise.resolve();
                });
            })
            .then(() => {
                return this._iteration();
            });
    }
}
