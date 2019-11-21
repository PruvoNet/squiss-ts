'use strict';

import * as brotli from 'iltorb';
import {deleteBlob, getBlob, IS3Upload, S3_MARKER, uploadBlob} from '../s3Utils';
import {GZIP_MARKER} from '../gzipUtils';
import {SQS, S3} from 'aws-sdk';
import {Squiss} from '../Squiss';

const SQS_MAX_MESSAGES_FETCH = 10;
const unzip = brotli.decompress;
const gzip = brotli.compress;

export type Mutator = (body: any) => any;

export interface ResubmitConfig {
    readonly queueName: string;
    readonly dealLetterQueueName: string;
    readonly isFifo: boolean;
    readonly limit: number;
    readonly mutate: boolean;
    readonly isJson: boolean;
    readonly customMutator: Mutator;
    readonly baseQueueUrl: string;
    readonly releaseTimeoutSeconds: number;
    readonly s3Prefix: string;
    readonly awsConfig: SQS.Types.ClientConfiguration;
}

export const resubmit = (config: ResubmitConfig) => {
    const runContext = buildRunContext(config);
    const handledMessages = new Set<string>();
    return iteration({
        handledMessages,
        numHandledMessages: 0,
        runContext,
        limit: config.limit,
        customMutator: config.mutate ? config.customMutator : undefined,
    });
};

const iteration = (context: IterationContext): Promise<void> => {
    if (context.numHandledMessages >= context.limit || context.limit <= 0) {
        return Promise.resolve();
    }
    const remaining = Math.max(context.limit - context.numHandledMessages, 0);
    const numberOfMessageToRead = Math.min(SQS_MAX_MESSAGES_FETCH, remaining);
    if (numberOfMessageToRead <= 0) {
        return Promise.resolve();
    }
    return readMessage(numberOfMessageToRead, context.runContext)
        .then((messages: SQS.Message[]) => {
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
                        return releaseMessage(msgContext);
                    }
                    const location = message.MessageId ?? '';
                    if (context.handledMessages.has(location)) {
                        return releaseMessage(msgContext);
                    }
                    context.handledMessages.add(location);
                    return handleMessage(context.customMutator, msgContext)
                        .catch((err) => {
                            releaseMessage(msgContext);
                            return Promise.reject(err);
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

interface IterationContext {
    readonly limit: number;
    readonly runContext: RunContext;
    numHandledMessages: number;
    readonly customMutator?: Mutator;
    readonly handledMessages: Set<string>;
}

interface RunContext {
    readonly s3Prefix: string;
    readonly s3: S3;
    readonly sqs: SQS;
    readonly queueName: string;
    readonly fullQueueName: string;
    readonly deadLetterFullQueueName: string;
    readonly releaseTimeoutSeconds: number;
    readonly isJson: boolean;
}

interface MessageContext extends RunContext {
    readonly message: SQS.Message;
}

const buildRunContext = (config: ResubmitConfig): RunContext => {
    const deadLetterFullQueueName =
        `${config.baseQueueUrl}${config.dealLetterQueueName}${config.isFifo ? '.fifo' : ''}`;
    const fullQueueName = `${config.baseQueueUrl}${config.queueName}${config.isFifo ? '.fifo' : ''}`;
    const squiss = new Squiss({
        awsConfig: config.awsConfig,
        queueName: fullQueueName,
    });
    const sqs = squiss.sqs;
    const s3 = squiss.getS3();
    return {
        sqs,
        s3,
        deadLetterFullQueueName,
        fullQueueName,
        queueName: config.queueName,
        releaseTimeoutSeconds: config.releaseTimeoutSeconds,
        s3Prefix: config.s3Prefix,
        isJson: config.isJson,
    };
};

const releaseMessage = (context: MessageContext): Promise<any> => {
    return context.sqs.changeMessageVisibility({
        QueueUrl: context.deadLetterFullQueueName,
        ReceiptHandle: context.message.ReceiptHandle ?? '',
        VisibilityTimeout: context.releaseTimeoutSeconds,
    }).promise();
};

const readMessage = (numberOfMessageToRead: number, context: RunContext)
    : Promise<SQS.Message[]> => {
    return context.sqs
        .receiveMessage({
            QueueUrl: context.deadLetterFullQueueName,
            MaxNumberOfMessages: numberOfMessageToRead,
            MessageAttributeNames: ['All'],
            AttributeNames: ['All'],
        })
        .promise()
        .then((data) => {
            const messages = data.Messages || [];
            return Promise.resolve(messages);
        });
};

const deleteMessage = (context: MessageContext): Promise<any> => {
    return context.sqs.deleteMessage({
        QueueUrl: context.deadLetterFullQueueName,
        ReceiptHandle: context.message.ReceiptHandle ?? '',
    }).promise();
};

const handleMessage = (customMutator: Mutator | undefined, context: MessageContext): Promise<any> => {
    cleanMessage(context);
    let s3UploadData: IS3Upload | undefined;
    let getBodyPromise: Promise<string>;
    if (!customMutator) {
        getBodyPromise = Promise.resolve(context.message.Body ?? '');
    } else {
        const mutateResult = mutateMessageToSend(customMutator, context);
        s3UploadData = mutateResult.s3UploadData;
        getBodyPromise = mutateResult.mutatePromise;
    }
    return getBodyPromise
        .then((body) => {
            return sendMessage(body, context);
        })
        .then(() => {
            return deleteMessage(context);
        })
        .then(() => {
            if (!customMutator || !isS3Message(context) || !s3UploadData) {
                return Promise.resolve();
            }
            deleteBlob(context.s3, s3UploadData);
            return Promise.resolve();
        });
};

const cleanMessage = (context: MessageContext) => {
    if (!context.message.MessageAttributes) {
        return;
    }
    const attributes = context.message.MessageAttributes;
    for (const key in attributes) {
        if (attributes.hasOwnProperty(key)) {
            const attribute = attributes[key];
            if (!attribute.BinaryListValues || !attribute.BinaryListValues.length) {
                delete attribute.BinaryListValues;
            }
            if (!attribute.StringListValues || !attribute.StringListValues.length) {
                delete attribute.StringListValues;
            }
        }
    }
};

const sendMessage = (body: string, context: MessageContext) => {
    return context.sqs
        .sendMessage({
            QueueUrl: context.fullQueueName,
            MessageAttributes: context.message.MessageAttributes,
            MessageBody: body,
            MessageDeduplicationId: context.message.MessageAttributes?.MessageId?.StringValue,
            MessageGroupId: context.message.MessageAttributes?.MessageId?.StringValue,
        })
        .promise();
};

const isGzipMessage = (context: MessageContext) => {
    return Boolean(context.message.MessageAttributes &&
        context.message.MessageAttributes[GZIP_MARKER] &&
        context.message.MessageAttributes[GZIP_MARKER].StringValue === '1');
};

const isS3Message = (context: MessageContext) => {
    return Boolean(context.message.MessageAttributes &&
        context.message.MessageAttributes[S3_MARKER] &&
        context.message.MessageAttributes[S3_MARKER].StringValue);
};

const getMessageBodyFromS3 = (body: string, context: MessageContext) => {
    if (isS3Message(context)) {
        const s3UploadData: IS3Upload = JSON.parse(body);
        return {promise: getBlob(context.s3, s3UploadData), s3UploadData};
    }
    return {promise: Promise.resolve(body)};
};

const uploadMessageBodyToS3 = (body: string, s3UploadData: IS3Upload | undefined, context: MessageContext) => {
    if (!isS3Message(context) || !s3UploadData) {
        return Promise.resolve(body);
    }
    return uploadBlob(context.s3, s3UploadData.bucket, body, context.s3Prefix)
        .then((newUploadData) => {
            return Promise.resolve(JSON.stringify(newUploadData));
        });
};

const unzipMessage = (body: string, context: MessageContext) => {
    if (!isGzipMessage(context)) {
        return Promise.resolve(body);
    }
    return new Promise<string>((resolve, reject) => {
        const buffer = new Buffer(body, 'base64');
        unzip(buffer, (err, res: Buffer) => {
            if (err) {
                return reject(err);
            }
            resolve(res.toString('utf8'));
        });
    });
};

const zipMessage = (body: string, context: MessageContext) => {
    if (!isGzipMessage(context)) {
        return Promise.resolve(body);
    }
    return new Promise<string>((resolve, reject) => {
        gzip(new Buffer(body), (err, res: Buffer) => {
            if (err) {
                return reject(err);
            }
            resolve(res.toString('base64'));
        });
    });
};

const mutateMessageToSend = (customMutator: Mutator, context: MessageContext) => {
    const originalBody = context.message.Body ?? '';
    const getMessageBodyFromS3Result = getMessageBodyFromS3(originalBody, context);
    const s3UploadData = getMessageBodyFromS3Result.s3UploadData;
    const mutatePromise = getMessageBodyFromS3Result.promise
        .then((bodyToDigest) => {
            return unzipMessage(bodyToDigest, context);
        })
        .then((bodyStr: string): Promise<string> => {
            const toMutate = context.isJson ? JSON.parse(bodyStr) : bodyStr;
            const mutatedObject = customMutator(toMutate);
            const mutated = context.isJson ? JSON.stringify(mutatedObject) : mutatedObject;
            return zipMessage(mutated, context);
        })
        .then((toSendBody) => {
            return uploadMessageBodyToS3(toSendBody, s3UploadData, context);
        });
    return {mutatePromise, s3UploadData};
};
