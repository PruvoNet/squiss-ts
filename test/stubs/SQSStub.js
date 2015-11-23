/*
 * Copyright (c) 2015 TechnologyAdvice
 */

class SQSStub {
  constructor(msgCount, timeout) {
    this.msgs = [];
    this.timeout = timeout === undefined ? 20 : timeout;
    this.msgCount = msgCount;
    for (let i = 0; i < msgCount; i++) {
      this.msgs.push({
        MessageId: `id_${i}`,
        ReceiptHandle: `${i}`,
        body: `{"num": ${i}}`
      });
    }
  }

  deleteMessageBatch(params, cb) {
    const res = {
      Successful: [],
      Failed: []
    };
    params.Entries.forEach((entry) => {
      if (parseInt(entry.ReceiptHandle, 10) < this.msgCount) {
        res.Successful.push({Id: entry.Id});
      } else {
        res.Failed.push({
          Id: entry.Id,
          SenderFault: true,
          Code: '404',
          Message: 'Does not exist'
        });
      }
    });
    setImmediate(cb.bind(null, null, res));
  }

  receiveMessage(query, cb) {
    const msgs = this.msgs.splice(0, query.MaxNumberOfMessages);
    const done = cb.bind(null, null, {Messages: msgs});
    if (msgs.length) setImmediate(done);
    else setTimeout(done, this.timeout * 1000);
  }
}

export default SQSStub;