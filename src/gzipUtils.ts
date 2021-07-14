'use strict';
// tslint:disable:no-var-requires

import {gte} from 'semver';

type Compress = (buf: Buffer) => Promise<Buffer>;


let compress: Compress;
let decompress: Compress;

/* istanbul ignore next */
if (gte(process.version, '10.16.0')) {
    const {brotliCompress, brotliDecompress} = require('zlib');
    const {promisify} = require('util');
    compress = promisify(brotliCompress);
    decompress = promisify(brotliDecompress);
} else {
    const iltorb = require('iltorb');
    compress = iltorb.compress;
    decompress = iltorb.decompress;
}

export const GZIP_MARKER = '__SQS_GZIP__';

export const compressMessage = <T>(message: string): Promise<string> => {
  return compress(Buffer.from(message))
    .then((buffer): Promise<string> => {
      return Promise.resolve(Buffer.from(buffer).toString('base64'));
    });
};

export const decompressMessage = (body: string): Promise<string> => {
  return decompress(Buffer.from(body, 'base64'))
    .then((bufferUnziped) => {
      return Promise.resolve(bufferUnziped.toString('utf8'));
    });
};
