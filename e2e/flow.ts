import {Squiss, Message} from '../src';
import {SQSClientConfig} from '@aws-sdk/client-sqs';
import {S3} from '@aws-sdk/client-s3';

const awsConfig: SQSClientConfig = {
    region: 'elasticmq',
    endpoint: 'http://localhost:9324',
    credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
    },
};

const s3 = new S3({
    endpoint: 'http://localhost:9000/s3',
    credentials: {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    },
})

const squiss = new Squiss({
    awsConfig,
    queueName: 'my-sqs-queue',
    bodyFormat: 'json',
    maxInFlight: 15,
    S3: s3,
    gzip: true,
    minGzipSize: 1,
    s3Fallback: true,
    s3Bucket: 'test',
    minS3Size: 1,
    correctQueueUrl: true,
});

(async () => {
    await await s3.createBucket({
        Bucket: 'test',
    });
    await squiss.createQueue();
    squiss.on('message', async (message: Message) => {
        console.log(`${message.body.name} says: ${JSON.stringify(message.body.message)} and has attripute p1 with value ${message.attributes.p1}`);
        await message.del();
    });
    squiss.on('error', (error: Error) => {
        console.log(`squiss error`, error);
    });
    await squiss.start();

    const messageToSend = {
        name: 'messageName',
        message: {
            a: 1,
            b: 2,
        },
    };

    const propsToSend = {
        p1: 1,
        p2: 2,
    };

    await squiss.sendMessage(messageToSend, 0, propsToSend);
})();
