import {EventEmitter} from 'events';

export class SquissStub extends EventEmitter {
  public changeMessageVisibility() {
    return Promise.resolve();
  }
  public handledMessage() {
    return Promise.resolve();
  }
}
