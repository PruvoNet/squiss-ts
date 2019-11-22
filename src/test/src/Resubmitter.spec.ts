'use strict';

import {Resubmitter} from '../../index';
import {SQSStub} from '../stubs/SQSStub';
import {Squiss, SQS} from '../../index';

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
        resubmitter.squissFrom = squissFrom;
        resubmitter.squissTo = squissTo;
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
                return obj;
            },
        });
        resubmitter.squissFrom = squissFrom;
        resubmitter.squissTo = squissTo;
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
        resubmitter.squissFrom = squissFrom;
        resubmitter.squissTo = squissTo;
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
        resubmitter.squissFrom = squissFrom;
        resubmitter.squissTo = squissTo;
        return resubmitter.run();
    });

});
