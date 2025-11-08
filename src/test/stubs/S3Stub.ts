import {EventEmitter} from 'events';
import {
  DeleteObjectOutput,
  DeleteObjectRequest,
  GetObjectCommandInput,
  GetObjectOutput,
  PutObjectCommandInput,
  PutObjectOutput
} from '@aws-sdk/client-s3';
import {Readable} from 'stream';

export interface Blobs {
  [k: string]: { [k: string]: string };
}

export class S3Stub extends EventEmitter {

  private blobs: Blobs;

  constructor(blobs?: Blobs) {
    super();
    this.blobs = blobs || {};
  }

  public getObject({Key, Bucket}: GetObjectCommandInput): Promise<GetObjectOutput> {
    if (Bucket && Key && this.blobs[Bucket] && this.blobs[Bucket][Key]) {
      const body = new Readable();
      body.push(this.blobs[Bucket][Key]);
      body.push(null);
      return Promise.resolve({Body: body });
    } else {
      return Promise.reject(new Error('Blob doesnt exist'));
    }
  }

  public putObject({Key, Bucket, Body}: PutObjectCommandInput): Promise<PutObjectOutput> {
    if (Bucket && !this.blobs[Bucket]) {
      this.blobs[Bucket] = {};
    }
    // @ts-ignore
    this.blobs[Bucket][Key] = Body;
    return Promise.resolve({});
  }

  public deleteObject({Key, Bucket}: DeleteObjectRequest): Promise<DeleteObjectOutput> {
    if (Bucket && Key && this.blobs[Bucket] && this.blobs[Bucket][Key]) {
      delete this.blobs[Bucket][Key];
      return Promise.resolve({});
    } else {
      return Promise.reject(new Error('Blob doesnt exist'));
    }
  }
}
