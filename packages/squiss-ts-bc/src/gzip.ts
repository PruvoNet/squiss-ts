import {compress, decompress} from 'iltorb';
import {getMessageGzip, MessageGzip} from '@squiss/core';

export const messageGzip: MessageGzip = getMessageGzip({
    compress,
    decompress,
})
