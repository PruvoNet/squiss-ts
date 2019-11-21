'use strict';

import {Resubmitter} from '../../index';
import {SQSStub} from '../stubs/SQSStub';
import {Squiss, SQS} from '../../index';

describe('resubmitter', () => {

    it('should work', function() {
        this.timeout(2000000);
        const squissFrom = new Squiss({queueUrl: 'foo_DLQ'});
        squissFrom!.sqs = new SQSStub(2, 0) as any as SQS;
        const squissTo = new Squiss({queueUrl: 'foo'});
        squissTo!.sqs = new SQSStub(0, 0) as any as SQS;
        const resubmitter = new Resubmitter({
            limit: 1,
            releaseTimeoutSeconds: 30,
            resubmitFromQueueConfig: {
                queueUrl: 'foo_DLQ',
            },
            resubmitToQueueConfig: {
                queueUrl: 'foo',
            },
        });
        resubmitter.squissFrom = squissFrom;
        resubmitter.squissTo = squissTo;
        return resubmitter.run();
    });

});
