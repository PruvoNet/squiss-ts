'use strict';

import {EventEmitter} from 'events';
import * as S3 from 'aws-sdk/clients/s3';

export interface Blobs {
  [k: string]: { [k: string]: string };
}

export class S3Stub extends EventEmitter {

  private blobs: Blobs;

  constructor(blobs?: Blobs) {
    super();
    this.blobs = blobs || {};
  }

  public getObject({Key, Bucket}: S3.Types.GetObjectRequest) {
    return this._makeReq(() => {
      if (this.blobs[Bucket] && this.blobs[Bucket][Key]) {
        return Promise.resolve({Body: this.blobs[Bucket][Key]});
      } else {
        return Promise.reject('Blob doesnt exist');
      }
    });
  }

  public putObject({Key, Bucket, Body}: S3.Types.PutObjectRequest) {
    return this._makeReq(() => {
      if (!this.blobs[Bucket]) {
        this.blobs[Bucket] = {};
      }
      // @ts-ignore
      this.blobs[Bucket][Key] = Body;
      return Promise.resolve();
    });
  }

  public deleteObject({Key, Bucket}: S3.Types.DeleteObjectRequest) {
    return this._makeReq(() => {
      if (this.blobs[Bucket] && this.blobs[Bucket][Key]) {
        delete this.blobs[Bucket][Key];
        return Promise.resolve();
      } else {
        return Promise.reject('Blob doesnt exist');
      }
    });
  }

  private _makeReq(func: any) {
    return {
      promise: func,
      abort: () => {
        this.emit('abort');
      },
    };
  }
}
