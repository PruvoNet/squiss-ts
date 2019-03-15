'use strict';

import {ISendMessageRequest} from './index';
import {SQS, S3} from 'aws-sdk';
import * as uuid from 'uuid/v4';

export const S3_MARKER = '__SQS_MESSAGE_S3__';

export interface IS3Upload {
  bucket: string;
  key: string;
  uploadSize: number;
}

export const uploadBlob = (s3: S3, bucket: string, blob: string): Promise<IS3Upload> => {
  const key = uuid();
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

export const getMessageSize = (message: ISendMessageRequest): number => {
  const msgAttributesSize = getMsgAttributesSize(message.MessageAttributes);
  const msgBodySize = getSizeInBytes(message.MessageBody);
  return msgAttributesSize + msgBodySize;
};

const getSizeInBytes = (obj?: string | NodeJS.TypedArray | DataView | ArrayBuffer | SharedArrayBuffer): number => {
  return obj ? Buffer.byteLength(obj) : 0;
};

const getMsgAttributesSize = (attributes?: SQS.MessageBodyAttributeMap): number => {
  let totalMsgAttributesSize = 0;
  if (attributes) {
    for (const attribute in attributes) {
      if (attributes.hasOwnProperty(attribute)) {
        totalMsgAttributesSize += getSizeInBytes(attribute);
        const val = attributes[attribute];
        if (val) {
          totalMsgAttributesSize += getSizeInBytes(val.DataType);
          totalMsgAttributesSize += getSizeInBytes(val.StringValue);
          // @ts-ignore
          totalMsgAttributesSize += getSizeInBytes(val.BinaryValue);
        }
      }
    }
  }
  return totalMsgAttributesSize;
};
