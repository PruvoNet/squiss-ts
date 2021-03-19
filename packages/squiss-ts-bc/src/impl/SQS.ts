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
import * as url from 'url';
import {SQS} from 'aws-sdk';
import {isString} from 'ts-type-guards';

class SQSImpl implements SQSFacade {
    constructor(private readonly client: SQS) {
    }

    public async getEndpoint(): Promise<url.UrlObject> {
        const endpoint = this.client.config.endpoint;
        if (!endpoint) {
            throw new Error('Failed to get queue endpoint');
        }
        if (isString(endpoint)) {
            return url.parse(endpoint);
        }
        return {
            ...endpoint,
            protocol: endpoint.protocol,
            host: endpoint.host,
            hostname: endpoint.hostname,
            port: endpoint.port,
            href: endpoint.href,
        }
    }

    public async changeMessageVisibility(request: ChangeMessageVisibilityRequest): Promise<void> {
        await this.client.changeMessageVisibility({
            ...request,
            QueueUrl: request.QueueUrl,
            ReceiptHandle: request.ReceiptHandle,
            VisibilityTimeout: request.VisibilityTimeout,
        }).promise();
    }

    public async createQueue(request: CreateQueueRequest): Promise<CreateQueueResponse> {
        const result = await this.client.createQueue({
            ...request,
            QueueName: request.QueueName,
            Attributes: request.Attributes as Record<string, string>,
        }).promise();
        if (!result.QueueUrl) {
            throw new Error('Create queue did not return the queue url');
        }
        return {
            QueueUrl: result.QueueUrl,
        };
    }

    public async deleteMessageBatch(request: DeleteMessageBatchRequest): Promise<DeleteMessageBatchResponse> {
        return this.client.deleteMessageBatch({
            ...request,
            QueueUrl: request.QueueUrl,
            Entries: request.Entries,
        }).promise();
    }

    public async deleteQueue(request: DeleteQueueRequest): Promise<void> {
        await this.client.deleteQueue({
            ...request,
            QueueUrl: request.QueueUrl,
        }).promise();
    }

    public async getQueueAttributes<A extends keyof IQueueAttributes>(request: GetQueueAttributesRequest<A>)
        : Promise<GetQueueAttributesResponse<A>> {
        const result = await this.client.getQueueAttributes({
            ...request,
            AttributeNames: request.AttributeNames,
            QueueUrl: request.QueueUrl,
        }).promise();
        return {Attributes: result.Attributes} as GetQueueAttributesResponse<A>;
    }

    public async getQueueUrl(request: GetQueueUrlRequest): Promise<GetQueueUrlResponse> {
        const result = await this.client.getQueueUrl({
            ...request,
            QueueName: request.QueueName,
            QueueOwnerAWSAccountId: request.QueueOwnerAWSAccountId,
        }).promise();
        if (!result.QueueUrl) {
            throw new Error('Get queue ur did not return the queue url');
        }
        return {
            QueueUrl: result.QueueUrl,
        };
    }

    public async purgeQueue(request: PurgeQueueRequest): Promise<void> {
        await this.client.purgeQueue({
            ...request,
            QueueUrl: request.QueueUrl,
        }).promise();
    }

    public receiveMessage(request: ReceiveMessageRequest): Abortable<ReceiveMessageResponse> {
        const result = this.client.receiveMessage({
            ...request,
            AttributeNames: request.AttributeNames,
            MaxNumberOfMessages: request.MaxNumberOfMessages,
            MessageAttributeNames: request.MessageAttributeNames,
            QueueUrl: request.QueueUrl,
            ReceiveRequestAttemptId: request.ReceiveRequestAttemptId,
            WaitTimeSeconds: request.WaitTimeSeconds,
            VisibilityTimeout: request.VisibilityTimeout,
        });
        return {
            promise: () => {
                return result.promise();
            },
            abort: () => {
                result.abort();
            },
        }
    }

    public async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
        return this.client.sendMessage({
            ...request,
            DelaySeconds: request.DelaySeconds,
            MessageAttributes: request.MessageAttributes,
            MessageBody: request.MessageBody,
            MessageDeduplicationId: request.MessageDeduplicationId,
            MessageGroupId: request.MessageGroupId,
            QueueUrl: request.QueueUrl,
        }).promise();
    }

    public async sendMessageBatch(request: SendMessageBatchRequest): Promise<SendMessageBatchResponse> {
        return this.client.sendMessageBatch({
            ...request,
            QueueUrl: request.QueueUrl,
            Entries: request.Entries,
        }).promise();
    }
}

export const buildS3FacadeLazyGetter = (configuration: SQS.ClientConfiguration, client?: SQS | typeof SQS) => {
    return buildLazyGetter<SQSFacade>(() => {
        const instance = classGetter<SQS, SQS.ClientConfiguration>(SQS, configuration, client);
        return new SQSImpl(instance);
    })
}

