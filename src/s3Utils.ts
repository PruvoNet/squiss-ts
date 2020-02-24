'use strict';

import {S3} from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {getSizeInBytes} from './messageSizeUtils';

export const S3_MARKER = '__SQS_S3__';

export interface IS3Upload {
  bucket: string;
  key: string;
  uploadSize: number;
}

export const uploadBlob = (s3: S3, bucket: string, blob: string, prefix: string): Promise<IS3Upload> => {
  const key = `${prefix}${uuidv4()}`;
  const size = getSizeInBytes(blob);
  return s3.putObject({
    Body: blob,
    Bucket: bucket,
    Key: key,
    ContentLength: size,
  }).promise()
    .then(() => {
      return Promise.resolve({
        uploadSize: size,
        bucket,
        key,
      });
    });
};

export const getBlob = (s3: S3, uploadData: IS3Upload): Promise<string> => {
  const key = uploadData.key;
  const bucket = uploadData.bucket;
  return s3.getObject({
    Key: key,
    Bucket: bucket,
  }).promise()
    .then((s3Result) => {
      return s3Result.Body!.toString('utf-8');
    });
};

export const deleteBlob = (s3: S3, uploadData: IS3Upload): Promise<void> => {
  const key = uploadData.key;
  const bucket = uploadData.bucket;
  return s3.deleteObject({
    Key: key,
    Bucket: bucket,
  }).promise()
    .then(() => {
      return Promise.resolve();
    });
};
