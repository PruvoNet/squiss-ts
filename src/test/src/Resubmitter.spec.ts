'use strict';

import {Resubmitter} from '../../index';
import {SQSStub} from '../stubs/SQSStub';
import {Squiss, SQS} from '../../index';
// @ts-ignore
import * as sinon from 'sinon';

describe('resubmitter', () => {

    it('should work', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ', deleteWaitMs: 1});
        squissFrom!.sqs = new SQSStub(2, 0) as any as SQS;
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const resubmitter = new Resubmitter({
            limit: 1,
            releaseTimeoutSeconds: 30,
            queues: {
                resubmitFromQueueConfig: {
                    queueUrl: 'foo_DLQ',
                },
                resubmitToQueueConfig: {
                    queueUrl: 'foo',
                },
            },
        });
        resubmitter._squissFrom = squissFrom;
        resubmitter._squissTo = squissTo;
        return resubmitter.run();
    });

    it('should work with mutation', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ', deleteWaitMs: 1});
        squissFrom!.sqs = new SQSStub(2, 0) as any as SQS;
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const resubmitter = new Resubmitter({
            limit: 1,
            releaseTimeoutSeconds: 30,
            queues: {
                resubmitFromQueueConfig: {
                    queueUrl: 'foo_DLQ',
                },
                resubmitToQueueConfig: {
                    queueUrl: 'foo',
                },
            },
            customMutator: (obj) => {
                return Promise.resolve(obj);
            },
        });
        resubmitter._squissFrom = squissFrom;
        resubmitter._squissTo = squissTo;
        return resubmitter.run();
    });

    it('should not do anything if limit is not positive', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ', deleteWaitMs: 1});
        squissFrom!.sqs = new SQSStub(2, 0) as any as SQS;
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const resubmitter = new Resubmitter({
            limit: 0,
            releaseTimeoutSeconds: 30,
            queues: {
                resubmitFromQueueConfig: {
                    queueUrl: 'foo_DLQ',
                },
                resubmitToQueueConfig: {
                    queueUrl: 'foo',
                },
            },
        });
        resubmitter._squissFrom = squissFrom;
        resubmitter._squissTo = squissTo;
        return resubmitter.run();
    });

    it('should stop if no more messages in queue', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ', deleteWaitMs: 1});
        squissFrom!.sqs = new SQSStub(1, 0) as any as SQS;
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const resubmitter = new Resubmitter({
            limit: 2,
            releaseTimeoutSeconds: 30,
            queues: {
                resubmitFromQueueConfig: {
                    queueUrl: 'foo_DLQ',
                },
                resubmitToQueueConfig: {
                    queueUrl: 'foo',
                },
            },
        });
        resubmitter._squissFrom = squissFrom;
        resubmitter._squissTo = squissTo;
        return resubmitter.run();
    });

    it('should release message if failed to parse it', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ', deleteWaitMs: 1, bodyFormat: 'json'});
        const stub = new SQSStub(0, 0);
        squissFrom!.sqs = stub as any as SQS;
        stub.sendMessage({
            MessageBody: '{',
            QueueUrl: 'url__',
        });
        const visibilitySpy = sinon.spy(squissFrom!.sqs, 'changeMessageVisibility');
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const spy = sinon.spy();
        const resubmitter = new Resubmitter({
            limit: 1,
            releaseTimeoutSeconds: 45,
            queues: {
                resubmitFromQueueConfig: {
                    queueUrl: 'foo_DLQ',
                },
                resubmitToQueueConfig: {
                    queueUrl: 'foo',
                },
            },
            customMutator: spy,
        });
        resubmitter._squissFrom = squissFrom;
        resubmitter._squissTo = squissTo;
        return resubmitter.run()
            .then(() => {
                spy.should.not.be.called();
                visibilitySpy.should.be.calledWith({
                    QueueUrl: 'foo_DLQ',
                    ReceiptHandle: 'url__',
                    VisibilityTimeout: 45,
                });
            });
    });

    it('should release message if failed to parse it and no visibility timeout', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ', deleteWaitMs: 1, bodyFormat: 'json'});
        const stub = new SQSStub(0, 0);
        squissFrom!.sqs = stub as any as SQS;
        stub.sendMessage({
            MessageBody: '{',
            QueueUrl: 'url__',
        });
        const visibilitySpy = sinon.spy(squissFrom!.sqs, 'changeMessageVisibility');
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const spy = sinon.spy();
        const resubmitter = new Resubmitter({
            limit: 1,
            releaseTimeoutSeconds: 0,
            queues: {
                resubmitFromQueueConfig: {
                    queueUrl: 'foo_DLQ',
                },
                resubmitToQueueConfig: {
                    queueUrl: 'foo',
                },
            },
            customMutator: spy,
        });
        resubmitter._squissFrom = squissFrom;
        resubmitter._squissTo = squissTo;
        return resubmitter.run()
            .then(() => {
                spy.should.not.be.called();
                visibilitySpy.should.be.calledWith({
                    QueueUrl: 'foo_DLQ',
                    ReceiptHandle: 'url__',
                    VisibilityTimeout: 0,
                });
            });
    });

    it('should properly handle messages without id', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ', deleteWaitMs: 1});
        const stub = new SQSStub(1, 0);
        squissFrom!.sqs = stub as any as SQS;
        if (stub.msgs[0]) {
            stub.msgs[0].MessageId = undefined;
        }
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const spy = sinon.stub().resolvesArg(0);
        const resubmitter = new Resubmitter({
            limit: 1,
            releaseTimeoutSeconds: 45,
            queues: {
                resubmitFromQueueConfig: {
                    queueUrl: 'foo_DLQ',
                },
                resubmitToQueueConfig: {
                    queueUrl: 'foo',
                },
            },
            customMutator: spy,
        });
        resubmitter._squissFrom = squissFrom;
        resubmitter._squissTo = squissTo;
        return resubmitter.run()
            .then(() => {
                spy.should.have.callCount(1);
            });
    });

    it('should properly handle duplicate messages without same id', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ', deleteWaitMs: 1});
        const stub = new SQSStub(2, 0);
        squissFrom!.sqs = stub as any as SQS;
        if (stub.msgs[0]) {
            stub.msgs[0].MessageId = 'myId';
        }
        if (stub.msgs[1]) {
            stub.msgs[1].MessageId = 'myId';
        }
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const spy = sinon.stub().resolvesArg(0);
        const resubmitter = new Resubmitter({
            limit: 2,
            releaseTimeoutSeconds: 45,
            queues: {
                resubmitFromQueueConfig: {
                    queueUrl: 'foo_DLQ',
                },
                resubmitToQueueConfig: {
                    queueUrl: 'foo',
                },
            },
            customMutator: spy,
        });
        resubmitter._squissFrom = squissFrom;
        resubmitter._squissTo = squissTo;
        return resubmitter.run()
            .then(() => {
                spy.should.have.callCount(1);
            });
    });

});
