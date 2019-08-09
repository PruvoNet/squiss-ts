'use strict';

import {Message} from './Message';
import {AWSError, SQS, S3} from 'aws-sdk';
import {BatchResultErrorEntry} from 'aws-sdk/clients/sqs';
import {IS3Upload} from './s3Utils';
import {StrictEventEmitter} from './EventEmitterTypesHelper';
import {EventEmitter} from 'events';

export interface IMessageDeletedEventPayload {
    msg: Message;
    successId: string;
}

export interface IMessageErrorEventPayload {
    message: Message;
    error: AWSError;
}

export interface IMessageDeleteErrorEventPayload {
    message: Message;
    error: BatchResultErrorEntry;
}

export interface IMessageS3EventPayload {
    message: Message;
    data: IS3Upload;
}

export interface ISendMessageRequest {
    MessageBody: string;
    DelaySeconds?: number;
    MessageAttributes?: SQS.MessageBodyAttributeMap;
    MessageDeduplicationId?: string;
    MessageGroupId?: string;
}

export interface IObject {
    [k: string]: any;
}

export type IMessageToSend = IObject | string;

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

export const optDefaults: ISquissOptions = {
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
    aborted: AWSError;
    delError: IMessageDeleteErrorEventPayload;
    autoExtendFail: IMessageErrorEventPayload;
    autoExtendError: IMessageErrorEventPayload;
    s3Download: IMessageS3EventPayload;
    s3Delete: IMessageS3EventPayload;
    s3Upload: IS3Upload;
}

export type SquissEmitter = StrictEventEmitter<EventEmitter, ISquissEvents>;
