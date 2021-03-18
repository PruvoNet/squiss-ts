import {
    ChangeMessageVisibilityRequest, CreateQueueRequest,
    CreateQueueResponse,
    DeleteMessageBatchRequest,
    DeleteMessageBatchResponse,
    DeleteQueueRequest,
    GetQueueAttributesRequest,
    GetQueueAttributesResponse,
    GetQueueUrlRequest,
    GetQueueUrlResponse,
    ReceiveMessageRequest,
    PurgeQueueRequest,
    ReceiveMessageResponse,
    Abortable,
    SendMessageResponse,
    SendMessageRequest,
    SendMessageBatchRequest,
    SendMessageBatchResponse,
    SQSFacade, buildLazyGetter, classGetter, IQueueAttributes
} from '@squiss/core';
import {
    ChangeMessageVisibilityCommand,
    CreateQueueCommand,
    DeleteMessageBatchCommand,
    DeleteQueueCommand,
    GetQueueAttributesCommand,
    GetQueueUrlCommand,
    PurgeQueueCommand,
    ReceiveMessageCommand, SendMessageBatchCommand, SendMessageCommand,
    SQSClient,
    SQSClientConfig
} from '@aws-sdk/client-sqs';
import {UrlObject} from 'url';
import {AbortController} from '@aws-sdk/abort-controller';

class SQSImpl implements SQSFacade {
    constructor(private readonly client: SQSClient) {
    }

    public async getEndpoint(): Promise<UrlObject> {
        const endpointObj = await this.client.config.endpoint();
        return {
            ...endpointObj,
            pathname: endpointObj.path,
            protocol: endpointObj.protocol,
            hostname: endpointObj.hostname,
            port: endpointObj.port,
            query: endpointObj.query,
        };
    }

    public async changeMessageVisibility(request: ChangeMessageVisibilityRequest): Promise<void> {
        const command = new ChangeMessageVisibilityCommand({
            ...request,
            QueueUrl: request.QueueUrl,
            ReceiptHandle: request.ReceiptHandle,
            VisibilityTimeout: request.VisibilityTimeout,
        });
        await this.client.send(command);
    }

    public async createQueue(request: CreateQueueRequest): Promise<CreateQueueResponse> {
        const command = new CreateQueueCommand({
            ...request,
            QueueName: request.QueueName,
            Attributes: request.Attributes as Record<string, string>,
        });
        const result = await this.client.send(command);
        if (!result.QueueUrl) {
            throw new Error('Create queue did not return the queue url');
        }
        return {
            QueueUrl: result.QueueUrl,
        };
    }

    public async deleteMessageBatch(request: DeleteMessageBatchRequest): Promise<DeleteMessageBatchResponse> {
        const command = new DeleteMessageBatchCommand({
            ...request,
            QueueUrl: request.QueueUrl,
            Entries: request.Entries,
        });
        const result = await this.client.send(command);
        return {
            Failed: result.Failed || [],
            Successful: result.Successful || [],
        };
    }

    public async deleteQueue(request: DeleteQueueRequest): Promise<void> {
        const command = new DeleteQueueCommand({
            ...request,
            QueueUrl: request.QueueUrl,
        });
        await this.client.send(command);
    }

    public async getQueueAttributes<A extends keyof IQueueAttributes>(request: GetQueueAttributesRequest<A>)
        : Promise<GetQueueAttributesResponse<A>> {
        const command = new GetQueueAttributesCommand({
            ...request,
            AttributeNames: request.AttributeNames,
            QueueUrl: request.QueueUrl,
        });
        const result = await this.client.send(command);
        return {Attributes: result.Attributes} as GetQueueAttributesResponse<A>;
    }

    public async getQueueUrl(request: GetQueueUrlRequest): Promise<GetQueueUrlResponse> {
        const command = new GetQueueUrlCommand({
            ...request,
            QueueName: request.QueueName,
            QueueOwnerAWSAccountId: request.QueueOwnerAWSAccountId,
        });
        const result = await this.client.send(command);
        if (!result.QueueUrl) {
            throw new Error('Get queue ur did not return the queue url');
        }
        return {
            QueueUrl: result.QueueUrl,
        };
    }

    public async purgeQueue(request: PurgeQueueRequest): Promise<void> {
        const command = new PurgeQueueCommand({
            ...request,
            QueueUrl: request.QueueUrl,
        });
        await this.client.send(command);
    }

    public receiveMessage(request: ReceiveMessageRequest): Abortable<ReceiveMessageResponse> {
        const command = new ReceiveMessageCommand({
            ...request,
            AttributeNames: request.AttributeNames,
            MaxNumberOfMessages: request.MaxNumberOfMessages,
            MessageAttributeNames: request.MessageAttributeNames,
            QueueUrl: request.QueueUrl,
            ReceiveRequestAttemptId: request.ReceiveRequestAttemptId,
            WaitTimeSeconds: request.WaitTimeSeconds,
            VisibilityTimeout: request.VisibilityTimeout,
        });
        const abortController = new AbortController()
        const promise = this.client.send(command, {
            abortSignal: abortController.signal,
        });
        return {
            promise: async () => {
                const result = await promise;
                return {
                    Messages: result.Messages,
                }
            },
            abort: () => {
                abortController.abort();
            },
        }
    }

    public async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
        const command = new SendMessageCommand({
            ...request,
            DelaySeconds: request.DelaySeconds,
            MessageAttributes: request.MessageAttributes,
            MessageBody: request.MessageBody,
            MessageDeduplicationId: request.MessageDeduplicationId,
            MessageGroupId: request.MessageGroupId,
            QueueUrl: request.QueueUrl,
        });
        const result = await this.client.send(command);
        return {
            SequenceNumber: result.SequenceNumber,
            MessageId: result.MessageId,
            MD5OfMessageSystemAttributes: result.MD5OfMessageSystemAttributes,
            MD5OfMessageBody: result.MD5OfMessageBody,
            MD5OfMessageAttributes: result.MD5OfMessageAttributes,
        };
    }

    public async sendMessageBatch(request: SendMessageBatchRequest): Promise<SendMessageBatchResponse> {
        const command = new SendMessageBatchCommand({
            ...request,
            QueueUrl: request.QueueUrl,
            Entries: request.Entries,
        });
        const result = await this.client.send(command);
        return {
            Failed: result.Failed || [],
            Successful: result.Successful || [],
        };
    }
}

export const buildS3FacadeLazyGetter = (configuration: SQSClientConfig, client?: SQSClient | typeof SQSClient) => {
    return buildLazyGetter<SQSFacade>(() => {
        const instance = classGetter<SQSClient, SQSClientConfig>(SQSClient, configuration, client);
        return new SQSImpl(instance);
    })
}