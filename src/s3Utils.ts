import {S3} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import {getSizeInBytes} from './messageSizeUtils';
import {Readable} from 'stream';

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
  })
    .then(() => {
      return Promise.resolve({
        uploadSize: size,
        bucket,
        key,
      });
    });
};

export const getBlob = async (s3: S3, uploadData: IS3Upload): Promise<string> => {
  const key = uploadData.key;
  const bucket = uploadData.bucket;
  const s3Result = await s3.getObject({
    Key: key,
    Bucket: bucket,
  });
  const s3ResponseStream = s3Result.Body as Readable;
  const chunks: any[] = [];
  for await (const chunk of s3ResponseStream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
};

export const deleteBlob = (s3: S3, uploadData: IS3Upload): Promise<void> => {
  const key = uploadData.key;
  const bucket = uploadData.bucket;
  return s3.deleteObject({
    Key: key,
    Bucket: bucket,
  })
    .then(() => {
      return Promise.resolve();
    });
};
