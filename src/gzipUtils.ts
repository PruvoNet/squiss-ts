import {brotliCompress, brotliDecompress} from 'zlib';
import {promisify }from 'util';

const compress  =promisify(brotliCompress);
const decompress=  promisify(brotliDecompress);

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
