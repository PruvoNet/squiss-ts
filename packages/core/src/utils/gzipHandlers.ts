// tslint:disable:no-var-requires

import {gte} from 'semver';

export type Compress = (buf: Buffer) => Promise<Buffer>;

let _compress: Compress;
let _decompress: Compress;

if (gte(process.version, '10.16.0')) {
    const {brotliCompress, brotliDecompress} = require('zlib');
    const {promisify} = require('util');
    _compress = promisify(brotliCompress);
    _decompress = promisify(brotliDecompress);
} else {
    const iltorb = require('iltorb');
    _compress = iltorb.compress;
    _decompress = iltorb.decompress;
}

export const compress = _compress;
export const decompress = _decompress;
