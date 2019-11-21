'use strict';

import {SQS_MAX_RECEIVE_BATCH, Squiss} from './Squiss';
import {IMessageToSend, ResubmitterConfig, ResubmitterMutator} from './Types';
import {Message} from './Message';

interface IterationContext {
    readonly limit: number;
    readonly runContext: RunContext;
    numHandledMessages: number;
    readonly customMutator?: ResubmitterMutator;
    readonly handledMessages: Set<string>;
    readonly releaseTimeoutSeconds: number;
}

interface RunContext {
    readonly squissFrom: Squiss;
    readonly squissTo: Squiss;
}

interface MessageContext extends RunContext {
    readonly message: Message;
}

const DEFAULT_SQUISS_OPTS = {
    receiveAttributes: ['All'],
    receiveSqsAttributes: ['All'],
    minReceiveBatchSize: 0,
    unwrapSns: false,
};

const iteration = (context: IterationContext): Promise<void> => {
    if (context.numHandledMessages >= context.limit || context.limit <= 0) {
        return Promise.resolve();
    }
    const remaining = Math.max(context.limit - context.numHandledMessages, 0);
    const numberOfMessageToRead = Math.min(SQS_MAX_RECEIVE_BATCH, remaining);
    if (numberOfMessageToRead <= 0) {
        return Promise.resolve();
    }
    return readMessages(numberOfMessageToRead, context.runContext)
        .then((messages) => {
            if (!messages.length) {
                // Make sure the iteration stops
                context.numHandledMessages = context.limit;
                return Promise.resolve();
            }
            const promises = messages.map((message) => {
                const msgContext: MessageContext = {
                    ...context.runContext,
                    message,
                };
                return Promise.resolve().then(() => {
                    console.log(`${++context.numHandledMessages} messages handled`);
                    if (context.numHandledMessages > context.limit) {
                        return message.changeVisibility(context.releaseTimeoutSeconds);
                    }
                    const location = message.raw.MessageId ?? '';
                    if (context.handledMessages.has(location)) {
                        return message.changeVisibility(context.releaseTimeoutSeconds);
                    }
                    context.handledMessages.add(location);
                    return handleMessage(context.customMutator, msgContext)
                        .then(() => {
                            return message.del();
                        })
                        .catch((err) => {
                            return message.changeVisibility(context.releaseTimeoutSeconds)
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
            return iteration(context);
        });
};

const buildRunContext = (config: ResubmitterConfig): RunContext => {
    const squissFrom = new Squiss({
        ...config.resubmitFromQueueConfig,
        ...DEFAULT_SQUISS_OPTS,
    });
    const squissTo = new Squiss({
        ...config.resubmitToQueueConfig,
        ...DEFAULT_SQUISS_OPTS,
    });
    return {
        squissFrom,
        squissTo,
    };
};

const readMessages = (numberOfMessageToRead: number, context: RunContext) => {
    return context.squissFrom.getManualBatch(numberOfMessageToRead);
};

const sendMessage = (messageToSend: IMessageToSend, context: MessageContext) => {
    return context.squissTo.sendMessage(messageToSend, undefined, context.message.attributes);
};

const handleMessage = (customMutator: ResubmitterMutator | undefined, context: MessageContext): Promise<any> => {
    return Promise.resolve()
        .then(() => {
            let body = context.message.body;
            if (customMutator) {
                body = customMutator(body);
            }
            return sendMessage(body, context);
        });
};

export const resubmitMessages = (config: ResubmitterConfig) => {
    const runContext = buildRunContext(config);
    const handledMessages = new Set<string>();
    return iteration({
        releaseTimeoutSeconds: config.releaseTimeoutSeconds,
        handledMessages,
        numHandledMessages: 0,
        runContext,
        limit: config.limit,
        customMutator: config.customMutator,
    });
};
