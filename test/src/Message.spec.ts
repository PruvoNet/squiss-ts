'use strict';

import {Message} from '../../dist/Message';
import {SquissStub} from '../stubs/SquissStub';
import {Squiss} from '../../dist';
import {SQS, S3} from 'aws-sdk';
import {S3Stub} from '../stubs/S3Stub';

const getSquissStub = () => {
  return new SquissStub() as any as Squiss;
};

const getS3Stub = () => {
  return new S3Stub() as any as S3;
};

function getSQSMsg(body?: string): SQS.Message {
  return {
    MessageId: 'msgId',
    ReceiptHandle: 'handle',
    MD5OfBody: 'abcdeabcdeabcdeabcdeabcdeabcde12',
    Body: body,
    MessageAttributes: {
      SomeNumber: {
        DataType: 'Number',
        StringValue: '1',
      },
      SomeString: {
        DataType: 'String',
        StringValue: 's',
      },
      SomeBinary: {
        DataType: 'Binary',
        BinaryValue: new Buffer(['s']),
      },
      SomeCustomBinary: {
        DataType: 'CustomBinary',
        BinaryValue: new Buffer(['c']),
      },
    },
  };
}

const snsMsg = {
  Type: 'Notification',
  MessageId: 'some-id',
  TopicArn: 'arn:aws:sns:us-east-1:1234567890:sns-topic-name',
  Subject: 'some-subject',
  Message: 'foo',
  Timestamp: '2015-11-25T04:17:37.741Z',
  SignatureVersion: '1',
  Signature: 'dGVzdAo=',
  SigningCertURL: 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-bb750dd426d95ee9390147a5624348ee.pem',
  UnsubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:1234567890:sns-topic-name:12345678-1234-4321-1234-123456789012',
};

describe('Message', () => {
  it('unwraps an SNS message', () => {
    const msg = new Message({
      squiss: getSquissStub(),
      msg: getSQSMsg(JSON.stringify(snsMsg)),
      unwrapSns: true,
      bodyFormat: 'plain',
      s3Retriever: getS3Stub,
    });
    msg.should.have.property('body').equal('foo');
    msg.should.have.property('subject').equal('some-subject');
    msg.should.have.property('topicArn').equal(snsMsg.TopicArn);
    msg.should.have.property('topicName').equal('sns-topic-name');
  });
  it('unwraps an SNS message with empty body', () => {
    const msg = new Message({
      squiss: getSquissStub(),
      msg: getSQSMsg(''),
      unwrapSns: true,
      bodyFormat: 'plain',
      s3Retriever: getS3Stub,
    });
    msg.should.have.property('body').equal(undefined);
    msg.should.have.property('subject').equal(undefined);
    msg.should.have.property('topicArn').equal(undefined);
  });
  it('parses JSON', () => {
    const msg = new Message({
      squiss: getSquissStub(),
      msg: getSQSMsg('{"Message":"foo","bar":"baz"}'),
      bodyFormat: 'json',
      s3Retriever: getS3Stub,
    });
    return msg.parse()
      .then(() => {
        msg.should.have.property('body');
        msg.body!.should.be.an('object');
        msg.body!.should.have.property('Message').equal('foo');
        msg.body!.should.have.property('bar').equal('baz');
        msg.attributes.should.be.eql({
          SomeNumber: 1,
          SomeString: 's',
          SomeBinary: new Buffer(['s']),
          SomeCustomBinary: new Buffer(['c']),
        });
      });
  });
  it('parses gzipped JSON', () => {
    const rawMsg = getSQSMsg('iwOAeyJpIjogMX0D');
    rawMsg.MessageAttributes!.__SQS_MESSAGE_GZIPPED__ = {
      DataType: 'Number',
      StringValue: '1',
    };
    const msg = new Message({
      squiss: getSquissStub(),
      msg: rawMsg,
      bodyFormat: 'json',
      s3Retriever: getS3Stub,
    });
    return msg.parse()
      .then(() => {
        msg.should.have.property('body');
        msg.body!.should.be.an('object');
        msg.body!.should.have.property('i').equal(1);
      });
  });
  it('parses gzipped plain', () => {
    const rawMsg = getSQSMsg('iwOAeyJpIjogMX0D');
    rawMsg.MessageAttributes!.__SQS_MESSAGE_GZIPPED__ = {
      DataType: 'Number',
      StringValue: '1',
    };
    const msg = new Message({
      squiss: getSquissStub(),
      msg: rawMsg,
      s3Retriever: getS3Stub,
    });
    return msg.parse()
      .then(() => {
        msg.should.have.property('body');
        msg.body!.should.eql('{"i": 1}');
      });
  });
  it('not parse empty gzipped body', () => {
    const rawMsg = getSQSMsg(undefined);
    rawMsg.MessageAttributes!.__SQS_MESSAGE_GZIPPED__ = {
      DataType: 'Number',
      StringValue: '1',
    };
    const msg = new Message({
      squiss: getSquissStub(),
      msg: rawMsg,
      s3Retriever: getS3Stub,
    });
    return msg.parse()
      .then(() => {
        msg.should.have.property('body').equals(undefined);
      });
  });
  it('parses empy string as json', () => {
    const msg = new Message({
      squiss: getSquissStub(),
      msg: getSQSMsg(''),
      bodyFormat: 'json',
      s3Retriever: getS3Stub,
    });
    return msg.parse()
      .then(() => {
        msg.should.have.property('body');
        msg.body!.should.be.an('object');
      });
  });
  it('not parse empty body', () => {
    const msg = new Message({
      squiss: getSquissStub(),
      msg: getSQSMsg(undefined),
      bodyFormat: 'json',
      s3Retriever: getS3Stub,
    });
    return msg.parse()
      .then(() => {
        msg.should.have.property('body').equal(undefined);
      });
  });
  it('calls Squiss.deleteMessage on delete', (done) => {
    const msg = new Message({
      msg: getSQSMsg('{"Message":"foo","bar":"baz"}'),
      bodyFormat: 'json',
      squiss: {
        deleteMessage: (toDel: Message) => {
          toDel.should.equal(msg);
          done();
        },
      } as any as Squiss,
      s3Retriever: getS3Stub,
    });
    msg.del();
  });
  it('calls Squiss.handledMessage on keep', (done) => {
    const msg = new Message({
      msg: getSQSMsg('{"Message":"foo","bar":"baz"}'),
      bodyFormat: 'json',
      squiss: {
        handledMessage: () => done(),
      } as any as Squiss,
      s3Retriever: getS3Stub,
    });
    msg.keep();
  });
  it('treats del(), keep(), and release() as idempotent', () => {
    let calls = 0;
    const msg = new Message({
      msg: getSQSMsg('{"Message":"foo","bar":"baz"}'),
      bodyFormat: 'json',
      squiss: {
        deleteMessage: () => {
          calls += 1;
        },
        handledMessage: () => {
          calls += 10;
        },
        releaseMessage: () => {
          calls += 100;
        },
      } as any as Squiss,
      s3Retriever: getS3Stub,
    });
    msg.del();
    msg.keep();
    msg.release();
    msg.del();
    calls.should.equal(1);
  });
  it('calls Squiss.changeMessageVisibility on changeVisibility', (done) => {
    const timeout = 10;
    const message = new Message({
      msg: getSQSMsg('{"Message":"foo","bar":"baz"}'),
      bodyFormat: 'json',
      squiss: {
        changeMessageVisibility: (msg: Message, timeoutInSeconds: number) => {
          msg.should.be.eql(message);
          timeoutInSeconds.should.be.eql(timeout);
          done();
        },
      } as any as Squiss,
      s3Retriever: getS3Stub,
    });
    message.changeVisibility(timeout);
  });
  it('calls Squiss.releaseMessage on release', (done) => {
    const message = new Message({
      msg: getSQSMsg('{"Message":"foo","bar":"baz"}'),
      bodyFormat: 'json',
      squiss: {
        releaseMessage: (msg: Message) => {
          msg.should.eql(message);
          return Promise.resolve();
        },
      } as any as Squiss,
      s3Retriever: getS3Stub,
    });
    message.release()
      .then(() => {
        done();
      });
  });
});
