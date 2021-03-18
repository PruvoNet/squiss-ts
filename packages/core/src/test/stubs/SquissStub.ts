
import {EventEmitter} from 'events';
import {IMessageToSend, ISquiss} from '../../types';
import {Message} from '../../Message';
import {S3Facade} from '../../facades/S3Facade';
import {IMessageAttributes, SendMessageBatchResponse, SendMessageResponse} from '../../index';
import {TimeoutExtender} from '../../TimeoutExtender';

export class SquissStub extends EventEmitter implements ISquiss {
    public changeMessageVisibility() {
        return Promise.resolve();
    }

    public handledMessage() {
        return Promise.resolve();
    }

    public get inFlight(): number {
        return 0;
    }

    public get running(): boolean {
        return true;
    }

    createQueue(): Promise<string> {
        return Promise.resolve('');
    }

    deleteMessage(msg: Message): Promise<void> {
        return Promise.resolve(undefined);
    }

    deleteQueue(): Promise<void> {
        return Promise.resolve(undefined);
    }

    getQueueMaximumMessageSize(): Promise<number> {
        return Promise.resolve(0);
    }

    getQueueUrl(): Promise<string> {
        return Promise.resolve('');
    }

    getQueueVisibilityTimeout(): Promise<number> {
        return Promise.resolve(0);
    }

    getS3(): S3Facade {
        return undefined as any;
    }

    purgeQueue(): Promise<void> {
        return Promise.resolve(undefined);
    }

    releaseMessage(msg: Message): Promise<void> {
        return Promise.resolve(undefined);
    }

    sendMessage(message: IMessageToSend, delay?: number, attributes?: IMessageAttributes)
        : Promise<SendMessageResponse> {
        return Promise.resolve(undefined as any);
    }

    sendMessages(messages: IMessageToSend[] | IMessageToSend, delay?: number,
                 attributes?: IMessageAttributes | IMessageAttributes[]): Promise<SendMessageBatchResponse> {
        return Promise.resolve(undefined as any);
    }

    start(): Promise<void> {
        return Promise.resolve(undefined);
    }

    stop(soft?: boolean, timeout?: number): Promise<boolean> {
        return Promise.resolve(false);
    }

    // TODO remove it
    _timeoutExtender: TimeoutExtender | undefined;
}
