'use strict';

import * as proxyquire from 'proxyquire';

const uuidStub = () => {
    return 'my_uuid';
};
(uuidStub as any)['@global'] = true;
const stubs = {
    'uuid/v4': uuidStub,
};
// tslint:disable-next-line
const {Squiss: SquissPatched} = proxyquire('../../', stubs);

import {Resubmitter} from '../../resubmitter';
import {SQSStub} from '../stubs/SQSStub';
import {SQS} from 'aws-sdk';

describe('resubmitter', () => {

    it('should work', () => {
        const squissFrom = new SquissPatched({queueUrl: 'foo_DLQ'});
        squissFrom!.sqs = new SQSStub(15, 0) as any as SQS;
        const squissTo = new SquissPatched({queueUrl: 'foo'});
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
