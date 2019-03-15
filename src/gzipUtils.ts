'use strict';

import {compress, decompress} from 'iltorb';

export const GZIP_MARKER = '__SQS_MESSAGE_GZIPPED__';

export const compressMessage = <T>(message: string): Promise<string> => {
  return compress(new Buffer(message))
    .then((buffer): Promise<string> => {
      return Promise.resolve(new Buffer(buffer).toString('base64'));
    });
};

export const decompressMessage = (body: string): Promise<string> => {
  return decompress(new Buffer(body, 'base64'))
    .then((bufferUnziped) => {
      return Promise.resolve(bufferUnziped.toString('utf8'));
    });
};
