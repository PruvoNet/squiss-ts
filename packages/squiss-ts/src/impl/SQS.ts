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
    SQSFacade, buildLazyGetter, classGetter
} from '@squiss/core';
import {
    ChangeMessageVisibilityCommand,
    CreateQueueCommand,
    DeleteMessageBatchCommand,
    SQSClient,
    SQSClientConfig
} from '@aws-sdk/client-sqs';
import * as url from 'url';

class SQSImpl implements SQSFacade {
    constructor(private readonly client: SQSClient) {
    }

    public async getEndpoint(): Promise<string> {
        const endpointObj = await this.client.config.endpoint();
        return url.format({
            ...endpointObj,
            pathname: endpointObj.path,
            protocol: endpointObj.protocol,
            hostname: endpointObj.hostname,
            port: endpointObj.port,
            query: endpointObj.query,
        });
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
        return Promise.resolve(undefined);
    }

    public async getQueueAttributes<A>(request: GetQueueAttributesRequest<A>): Promise<GetQueueAttributesResponse<A>> {
        return Promise.resolve(undefined);
    }

    public async getQueueUrl(request: GetQueueUrlRequest): Promise<GetQueueUrlResponse> {
        return Promise.resolve(undefined);
    }

    public async purgeQueue(request: PurgeQueueRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

    public async receiveMessage(request: ReceiveMessageRequest): Abortable<ReceiveMessageResponse> {
        return undefined;
    }

    public async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
        return Promise.resolve(undefined);
    }

    public async sendMessageBatch(request: SendMessageBatchRequest): Promise<SendMessageBatchResponse> {
        return Promise.resolve(undefined);
    }
}

export const buildS3FacadeLazyGetter = (configuration: SQSClientConfig, client?: SQSClient | typeof SQSClient) => {
    return buildLazyGetter<SQSFacade>(() => {
        const instance = classGetter<SQSClient, SQSClientConfig>(SQSClient, configuration, client);
        return new SQSImpl(instance);
    })
}
