import {brotliCompress, brotliDecompress} from 'zlib';
import {promisify} from 'util';
import {getMessageGzip, MessageGzip} from '@squiss/core';

const compress = promisify(brotliCompress);
const decompress = promisify(brotliDecompress);

export const messageGzip: MessageGzip = getMessageGzip({
    compress,
    decompress,
})
