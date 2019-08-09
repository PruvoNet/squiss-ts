'use strict';

import {Message} from './Message';
import {AWSError, SQS, S3} from 'aws-sdk';
import {BatchResultErrorEntry} from 'aws-sdk/clients/sqs';
import {IS3Upload} from './s3Utils';

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
    minS3Size?: number;
}
