'use strict';

import {Squiss} from './index';
import {Message} from './Message';
import * as LinkedList from 'linked-list';
import {Item} from 'linked-list';
import {AWSError} from 'aws-sdk';

/**
 * The maximum age, in milliseconds, that a message can reach before AWS will no longer accept VisibilityTimeout
 * extensions.
 * @type {number}
 */
const MAX_MESSAGE_AGE_MS = 43200000;

class Node extends Item {
  constructor(public message: Message, public receivedOn: number, public timerOn: number) {
    super();
  }
}

export interface ITimeoutExtenderOptions {
  visibilityTimeoutSecs?: number;
  noExtensionsAfterSecs?: number;
  advancedCallMs?: number;
}

interface MessageIndex {
  [k: string]: Node;
}

/**
 * Option defaults.
 * @type {Object}
 */
const optDefaults: ITimeoutExtenderOptions = {
  visibilityTimeoutSecs: 30,
  noExtensionsAfterSecs: MAX_MESSAGE_AGE_MS / 1000,
  advancedCallMs: 5000,
};

/**
 * The TimeoutExtender is a module that attaches itself to a Squiss instance via event
 * listeners, and uses the instance's public API to automatically extend the
 * VisibilityTimeout of the message until it is either handled (which includes actions
 * such as deleting or releasing the message) or it reaches an age that is greater than
 * the `noExtensionsAfterSecs` option. Functionally, this class could be distributed as a
 * third party module and attached to a Squiss instance by the user, however the common
 * and convenient use case is for this class to be used internally by Squiss itself.
 *
 * For efficient operation, the TimeoutExtender combines a doubly-linked list with a
 * hash map, keeping an index of every message while not incurring the RAM or CPU overhead
 * of having to re-create an array every time a message is deleted from the middle of a
 * sorted queue. Every operation in this class has a time complexity of O(1) and a space
 * complexity of O(n).
 */
export class TimeoutExtender {

  public readonly _index: MessageIndex;
  public _linkedList: LinkedList<Node>;
  public _opts: ITimeoutExtenderOptions;
  private _squiss: Squiss;
  private _timer: NodeJS.Timeout | undefined;
  private readonly _visTimeout: number;
  private readonly _stopAfter: number;
  private readonly _apiLeadMs: number;

  /**
   * Creates a new TimeoutExtender.
   * @param {Squiss} squiss The Squiss instance on which this extender should operate
   * @param {Object} opts An object containing options mappings
   * @param {number} [opts.visibilityTimeoutSecs=30] The queue's VisibilityTimeout, in
   * seconds. This will be used to know when to extend a message. It will also be the
   * amount of time by which the timeout gets extended.
   * @param {number} [opts.noExtensionsAfterSecs=43200] The number of seconds after which
   * a message's VisibilityTimeout should not be extended. The default and maximum value
   * (imposed by AWS) is 43200 (12 hours).
   * @param {number} [opts.advancedCallMs=5000] The amount of time before a message's
   * VisibilityTimeout expiration to make the API call to extend it. Setting this too
   * high will cause a message to be extended within a time frame where it may be deleted
   * anyway; setting too low may cause the message to expire before the API call can
   * complete. The max is `opts.visibilityTimeoutSecs * 1000`.
   */
  constructor(squiss: Squiss, opts?: ITimeoutExtenderOptions) {
    this._opts = Object.assign({}, optDefaults, opts || {});
    this._index = {};
    this._timer = undefined;
    this._squiss = squiss;
    this._linkedList = new LinkedList<Node>();
    this._squiss.on('handled', (msg: Message) => {
      return this.deleteMessage(msg);
    });
    this._squiss.on('message', (msg: Message) => {
      return this.addMessage(msg);
    });
    this._visTimeout = this._opts.visibilityTimeoutSecs! * 1000;
    this._stopAfter = Math.min(this._opts.noExtensionsAfterSecs! * 1000, MAX_MESSAGE_AGE_MS);
    this._apiLeadMs = Math.min(this._opts.advancedCallMs!, this._visTimeout);
  }

  /**
   * Adds a new message to the tracker.
   * @param {Message} message A Squiss Message object
   */
  public addMessage(message: Message) {
    const now = Date.now();
    this._addNode(new Node(message, now, now + this._visTimeout - this._apiLeadMs));
  }

  /**
   * Deletes a message from the tracker, if the message is currently being tracked.
   * @param {Message} message A Squiss Message object
   */
  public deleteMessage(message: Message) {
    const node = this._index[message.raw.MessageId!];
    if (node) {
      this._deleteNode(node);
    }
  }

  /**
   * Adds a message wrapper node to the linked list and hash map index.
   * @param {{message: Message, receivedOn: number, timerOn: number}} node The node
   * object to be added
   * @private
   */
  public _addNode(node: Node) {
    this._index[node.message.raw.MessageId!] = node;
    this._linkedList.append(node);
    if (!node.prev) {
      this._headChanged();
    }
  }

  /**
   * Deletes a message wrapper node from the linked list and hash map index.
   * @param {{message: Message, receivedOn: number, timerOn: number}} node The node
   * object to be removed
   * @private
   */
  public _deleteNode(node: Node) {
    const msgId = node.message.raw.MessageId!;
    delete this._index[msgId];
    const isFirst = !node.prev;
    node.detach();
    if (isFirst) {
      this._headChanged();
    }
  }

  /**
   * Gets the current millisecond age of a tracked message, projected `opts.advancedCallMs`
   * into the future.
   * @param node The node to be checked
   * @returns {number} The age of the message in milliseconds
   * @private
   */
  public _getNodeAge(node: Node) {
    return Date.now() - node.receivedOn + this._apiLeadMs;
  }

  /**
   * Called internally when the head of the linked list has changed in any way. This
   * function is responsible for maintaining the timer that determines the tracker's next
   * action.
   * @returns {boolean} true if a timer was set in response to the changed head; false
   * otherwise.
   * @private
   */
  public _headChanged() {
    if (this._timer) {
      clearTimeout(this._timer);
    }
    if (!this._linkedList.head) {
      return false;
    }
    const node = this._linkedList.head;
    this._timer = setTimeout(() => {
      if (this._getNodeAge(node) >= this._stopAfter) {
        this._deleteNode(node);
        node.message.keep();
        node.message.emit('keep');
        this._squiss.emit('keep', node.message);
        node.message.emit('timeoutReached');
        this._squiss.emit('timeoutReached', node.message);
        return;
      }
      return this._renewNode(node);
    }, node.timerOn - Date.now());
    return true;
  }

  /**
   * Extends the VisibilityTimeout of the message contained in the provided wrapper node,
   * and moves the node to the tail of the linked list.
   * @param {{message: Message, receivedOn: number, timerOn: number}} node The node
   * object to be renewed
   * @private
   */
  public _renewNode(node: Node) {
    const extendByMs = Math.min(this._visTimeout, MAX_MESSAGE_AGE_MS - this._getNodeAge(node));
    const extendBySecs = Math.floor(extendByMs / 1000);
    node.message.emit('extendingTimeout');
    this._squiss.emit('extendingTimeout', node.message);
    this._squiss.changeMessageVisibility(node.message, extendBySecs)
      .then(() => {
        node.message.emit('timeoutExtended');
        this._squiss.emit('timeoutExtended', node.message);
      })
      .catch((err: AWSError) => {
        if (err.message.match(/Message does not exist or is not available/)) {
          this._deleteNode(node);
          node.message.emit('autoExtendFail', err);
          this._squiss.emit('autoExtendFail', {message: node.message, error: err});
        } else {
          node.message.emit('autoExtendError', err);
          this._squiss.emit('autoExtendError', {message: node.message, error: err});
        }
      });
    this._deleteNode(node);
    node.timerOn = Date.now() + extendByMs - this._apiLeadMs;
    this._addNode(node);
  }
}
