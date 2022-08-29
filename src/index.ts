'use strict';

/* istanbul ignore file */
import * as SQS from 'aws-sdk/clients/sqs'
export {SQS}
import * as S3 from 'aws-sdk/clients/s3'
export {S3}
export {Squiss} from './Squiss';
export {
    BodyFormat,
    IMessageDeletedEventPayload,
    IMessageDeleteErrorEventPayload,
    IMessageErrorEventPayload,
    IMessageS3EventPayload,
    IMessageToSend,
    IObject,
    ISendMessageRequest,
    ISquissOptions,
} from './Types';
export {IMessageAttributes} from './attributeUtils';
export {Message} from './Message';
