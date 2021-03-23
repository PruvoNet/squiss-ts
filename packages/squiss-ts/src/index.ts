import * as Core from '@squiss/core';

export import Types = Core.Types;
import {messageGzip} from './utils/gzip';
import {buildS3FacadeLazyGetter} from './impl/S3';
import {buildSQSFacadeLazyGetter} from './impl/SQS';
import {S3Client, S3ClientConfig} from '@aws-sdk/client-s3';
import {SQSClient, SQSClientConfig} from '@aws-sdk/client-sqs';

export type IAwsConfig = Types.IAwsConfig<SQSClientConfig, SQSClient, S3ClientConfig, S3Client>;

export const squiss = (opts: Types.ISquissOptions, awsConfig?: IAwsConfig): Types.ISquiss => {
    const s3Config = awsConfig?.s3;
    const s3 = Core.utils.isFacadeConfig(s3Config) ?
        s3Config.facade :
        buildS3FacadeLazyGetter(s3Config?.configuration ?? {}, s3Config?.client);
    const sqsConfig = awsConfig?.sqs;
    const sqs = Core.utils.isFacadeConfig(sqsConfig) ?
        sqsConfig.facade :
        buildSQSFacadeLazyGetter(sqsConfig?.configuration ?? {}, sqsConfig?.client);
    return new Core.Squiss({
        ...opts,
        messageGzip,
        SQS: sqs,
        S3: s3,
    });
}
