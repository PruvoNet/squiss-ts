'use strict';

import {parseMessage, prepareMessage} from '../../dist/gzipUtils';

describe('gzipUtils', () => {

  it('should compress message', () => {
    return prepareMessage('{"i": 1}')
      .then((gzipped) => {
        gzipped.should.eql('iwOAeyJpIjogMX0D');
      });
  });

  it('should decompress message', () => {
    return parseMessage('iwOAeyJpIjogMX0D')
      .then((parsed) => {
        parsed.should.eql('{"i": 1}');
      });
  });

  it('compressed and decompressed valued should be equal', () => {
    const message = '{"i": 1}';
    return prepareMessage(message)
      .then((gzipped) => {
        return parseMessage(gzipped);
      })
      .then((parsed) => {
        parsed.should.eql(message);
      });
  });
});
