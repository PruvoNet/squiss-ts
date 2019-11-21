// 'use strict';
//
// import {SQS} from 'aws-sdk';
// import {SQS_MAX_RECEIVE_BATCH, Squiss} from '../Squiss';
// import {ISquissOptions} from '../Types';
//
// const DEFAULT_SQUISS_OPTS = {
//     receiveAttributes: ['All'],
//     receiveSqsAttributes: ['All'],
//     minReceiveBatchSize: 0,
// };
//
// export type Mutator = (body: any) => any;
//
// export interface ResubmitConfig {
//     readonly resubmitFromQueueConfig: ISquissOptions;
//     readonly resubmitToQueueConfig: ISquissOptions;
//     readonly limit: number;
//     readonly customMutator?: Mutator;
//     readonly releaseTimeoutSeconds: number;
// }
//
// export const resubmit = (config: ResubmitConfig) => {
//     const runContext = buildRunContext(config);
//     const handledMessages = new Set<string>();
//     return iteration({
//         handledMessages,
//         numHandledMessages: 0,
//         runContext,
//         limit: config.limit,
//         customMutator: config.customMutator,
//     });
// };
//
// const iteration = (context: IterationContext): Promise<void> => {
//     if (context.numHandledMessages >= context.limit || context.limit <= 0) {
//         return Promise.resolve();
//     }
//     const remaining = Math.max(context.limit - context.numHandledMessages, 0);
//     const numberOfMessageToRead = Math.min(SQS_MAX_RECEIVE_BATCH, remaining);
//     if (numberOfMessageToRead <= 0) {
//         return Promise.resolve();
//     }
//     return readMessages(numberOfMessageToRead, context.runContext)
//         .then((messages) => {
//             if (!messages.length) {
//                 // Make sure the iteration stops
//                 context.numHandledMessages = context.limit;
//                 return Promise.resolve();
//             }
//             const promises = messages.map((message) => {
//                 const msgContext: MessageContext = {
//                     ...context.runContext,
//                     message,
//                 };
//                 return Promise.resolve().then(() => {
//                     console.log(`${++context.numHandledMessages} messages handled`);
//                     if (context.numHandledMessages > context.limit) {
//                         return releaseMessage(msgContext);
//                     }
//                     const location = message.MessageId ?? '';
//                     if (context.handledMessages.has(location)) {
//                         return releaseMessage(msgContext);
//                     }
//                     context.handledMessages.add(location);
//                     return handleMessage(context.customMutator, msgContext)
//                         .catch((err) => {
//                             releaseMessage(msgContext);
//                             return Promise.reject(err);
//                         });
//                 });
//             });
//             return Promise.all(promises).then(() => {
//                 return Promise.resolve();
//             });
//         })
//         .then(() => {
//             return iteration(context);
//         });
// };
//
// interface IterationContext {
//     readonly limit: number;
//     readonly runContext: RunContext;
//     numHandledMessages: number;
//     readonly customMutator?: Mutator;
//     readonly handledMessages: Set<string>;
// }
//
// interface RunContext {
//     readonly squissFrom: Squiss;
//     readonly squissTo: Squiss;
//     readonly releaseTimeoutSeconds: number;
// }
//
// interface MessageContext extends RunContext {
//     readonly message: SQS.Message;
// }
//
// const buildRunContext = (config: ResubmitConfig): RunContext => {
//     const squissFrom = new Squiss({
//         ...config.resubmitFromQueueConfig,
//         ...DEFAULT_SQUISS_OPTS,
//     });
//     const squissTo = new Squiss({
//         ...config.resubmitToQueueConfig,
//         ...DEFAULT_SQUISS_OPTS,
//     });
//     return {
//         squissFrom,
//         squissTo,
//         releaseTimeoutSeconds: config.releaseTimeoutSeconds,
//     };
// };
//
// const readMessages = (numberOfMessageToRead: number, context: RunContext) => {
//     return context.squissFrom.getManualBatch(numberOfMessageToRead);
// };
//
// const handleMessage = (customMutator: Mutator | undefined, context: MessageContext): Promise<any> => {
//     let getBodyPromise: Promise<string>;
//     if (!customMutator) {
//         getBodyPromise = Promise.resolve(context.message.Body ?? '');
//     } else {
//         const mutateResult = mutateMessageToSend(customMutator, context);
//         getBodyPromise = mutateResult.mutatePromise;
//     }
//     return getBodyPromise
//         .then((body) => {
//             return sendMessage(body, context);
//         })
//         .then(() => {
//             return deleteMessage(context);
//         });
// };
//
// const sendMessage = (body: string, context: MessageContext) => {
//     return context.sqs
//         .sendMessage({
//             QueueUrl: context.fullQueueName,
//             MessageAttributes: context.message.MessageAttributes,
//             MessageBody: body,
//             MessageDeduplicationId: context.message.MessageAttributes?.MessageId?.StringValue,
//             MessageGroupId: context.message.MessageAttributes?.MessageId?.StringValue,
//         })
//         .promise();
// };
//
// const mutateMessageToSend = (customMutator: Mutator, context: MessageContext) => {
//     const originalBody = context.message.Body ?? '';
//     const getMessageBodyFromS3Result = getMessageBodyFromS3(originalBody, context);
//     const s3UploadData = getMessageBodyFromS3Result.s3UploadData;
//     const mutatePromise = getMessageBodyFromS3Result.promise
//         .then((bodyToDigest) => {
//             return unzipMessage(bodyToDigest, context);
//         })
//         .then((bodyStr: string): Promise<string> => {
//             const toMutate = context.isJson ? JSON.parse(bodyStr) : bodyStr;
//             const mutatedObject = customMutator(toMutate);
//             const mutated = context.isJson ? JSON.stringify(mutatedObject) : mutatedObject;
//             return zipMessage(mutated, context);
//         })
//         .then((toSendBody) => {
//             return uploadMessageBodyToS3(toSendBody, s3UploadData, context);
//         });
//     return {mutatePromise, s3UploadData};
// };
