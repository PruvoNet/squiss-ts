'use strict';

import {Message} from './Message';
import {IS3Upload} from './s3Utils';
import {StrictEventEmitter} from './EventEmitterTypesHelper';
import {EventEmitter} from 'events';
import {S3Facade} from './facades/S3Facade';
import {
    BatchResultErrorEntry,
    SendMessageBatchRequestEntry,
    SendMessageBatchResponse,
    SendMessageResponse,
    SQSFacade
} from './facades/SQSFacade';
import {IMessageAttributes} from './attributeUtils';
import {TimeoutExtender} from './TimeoutExtender';

export interface IMessageDeletedEventPayload {
    msg: Message;
    successId: string;
}

export interface IMessageErrorEventPayload {
    message: Message;
    error: Error;
}

export interface IMessageDeleteErrorEventPayload {
    message: Message;
    error: BatchResultErrorEntry;
}

export interface IMessageS3EventPayload {
    message: Message;
    data: IS3Upload;
}

export type ISendMessageRequest = Omit<SendMessageBatchRequestEntry, 'Id'>

export interface IObject {
    [k: string]: any;
}

export type IMessageToSend = IObject | string;

export type BodyFormat = 'json' | 'plain' | undefined;

export interface ISquissOptions {
    SQS: SQSFacade | (new () => SQSFacade);
    S3: S3Facade | (new () => S3Facade);
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
    minS3Size?: number;
}

export interface IDeleteQueueItem {
    msg: Message;
    Id: string;
    ReceiptHandle: string;
    resolve: () => void;
    reject: (reason?: any) => void;
}

export interface IDeleteQueueItemById {
    [k: string]: IDeleteQueueItem;
}

export const optDefaults: Partial<ISquissOptions> = {
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

export interface ISquissEvents {
    delQueued: Message;
    handled: Message;
    released: Message;
    timeoutReached: Message;
    extendingTimeout: Message;
    timeoutExtended: Message;
    message: Message;
    keep: Message;
    drained: void;
    queueEmpty: void;
    maxInFlight: void;
    deleted: IMessageDeletedEventPayload;
    gotMessages: number;
    error: Error;
    aborted: Error;
    delError: IMessageDeleteErrorEventPayload;
    autoExtendFail: IMessageErrorEventPayload;
    autoExtendError: IMessageErrorEventPayload;
    s3Download: IMessageS3EventPayload;
    s3Delete: IMessageS3EventPayload;
    s3Upload: IS3Upload;
}

export type SquissEmitter = StrictEventEmitter<EventEmitter, ISquissEvents>;

export interface ISquiss extends SquissEmitter {
    // TODO remove
    _timeoutExtender: TimeoutExtender | undefined;
    inFlight: number;
    running: boolean;

    changeMessageVisibility(msg: Message | string, timeoutInSeconds: number): Promise<void>;

    createQueue(): Promise<string>;

    deleteMessage(msg: Message): Promise<void>;

    deleteQueue(): Promise<void>;

    getQueueUrl(): Promise<string>;

    getQueueVisibilityTimeout(): Promise<number>;

    getQueueMaximumMessageSize(): Promise<number>;

    handledMessage(msg: Message): void;

    releaseMessage(msg: Message): Promise<void>;

    purgeQueue(): Promise<void>;

    sendMessage(message: IMessageToSend, delay?: number, attributes?: IMessageAttributes)
        : Promise<SendMessageResponse>;

    sendMessages(messages: IMessageToSend[] | IMessageToSend, delay?: number,
                 attributes?: IMessageAttributes | IMessageAttributes[])
        : Promise<SendMessageBatchResponse>;

    start(): Promise<void>;

    stop(soft?: boolean, timeout?: number): Promise<boolean>;

    getS3(): S3Facade;
}
