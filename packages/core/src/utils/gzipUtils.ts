import {compress, decompress} from './gzipHandlers';

export const GZIP_MARKER = '__SQS_GZIP__';

export const compressMessage = <T>(message: string): Promise<string> => {
  return compress(Buffer.from(message))
    .then((buffer): Promise<string> => {
      return Promise.resolve(Buffer.from(buffer).toString('base64'));
    });
};

export const decompressMessage = (body: string): Promise<string> => {
  return decompress(Buffer.from(body, 'base64'))
    .then((bufferUnzipped) => {
      return Promise.resolve(bufferUnzipped.toString('utf8'));
    });
};
