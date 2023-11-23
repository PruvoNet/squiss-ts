/* istanbul ignore file */
import {SQS, QueueAttributeName} from '@aws-sdk/client-sqs'
export {SQS, QueueAttributeName}
import {S3} from '@aws-sdk/client-s3'
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
