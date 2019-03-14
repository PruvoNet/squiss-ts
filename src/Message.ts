'use strict';

import {SQS} from 'aws-sdk';
import {BodyFormat, Squiss} from '.';
import {IMessageAttributes, parseMessageAttributes} from './attributeUtils';

const EMPTY_BODY = '{}';

/**
 * The message class is a wrapper for Amazon SQS messages that provides the raw and parsed message body,
 * optionally removed SNS wrappers, and provides convenience functions to delete or keep a given message.
 */

export interface IMessageOpts {
  msg: SQS.Message;
  unwrapSns?: boolean;
  bodyFormat?: BodyFormat;
  squiss: Squiss;
}

interface SNSBody {
  Message?: string;
  Subject: string;
  TopicArn: string;
}

export class Message {

  /**
   * Parses a message according to the given format.
   * @param {string} msg The message to be parsed
   * @param {string} format The format of the message. Currently supports "json".
   * @returns {Object|string} The parsed message, or the original message string if the format type is unknown.
   * @private
   */
  public static _formatMessage(msg: string | undefined, format: BodyFormat) {
    switch (format) {
      case 'json':
        return JSON.parse(msg || EMPTY_BODY);
      default:
        return msg;
    }
  }

  public raw: SQS.Message;
  public body?: string;
  public subject?: string;
  public topicArn?: string;
  public topicName?: string;
  public attributes: IMessageAttributes;
  private _squiss: Squiss;
  private _handled: boolean;

  /**
   * Creates a new Message.
   * @param {Object} opts A mapping of message-creation options
   * @param {Object} opts.msg A parsed SQS response as returned from the official aws-sdk
   * @param {boolean} [opts.unwrapSns=false] Set to `true` to denote that each message should be treated as though
   *    it comes from a queue subscribed to an SNS endpoint, and automatically extract the message from the SNS
   *    metadata wrapper.
   * @param {string} opts.bodyFormat "plain" to not parse the message body, or "json" to pass it through JSON.parse
   *    on creation
   * @param {Squiss} opts.squiss The squiss instance responsible for retrieving this message. This will be used to
   *    delete the message and update inFlight count tracking.
   */
  constructor(opts: IMessageOpts) {
    this.raw = opts.msg;
    this.body = opts.msg.Body;
    if (opts.unwrapSns) {
      const unwrapped: SNSBody = JSON.parse(this.body || EMPTY_BODY);
      this.body = unwrapped.Message;
      this.subject = unwrapped.Subject;
      this.topicArn = unwrapped.TopicArn;
      if (this.topicArn) {
        this.topicName = unwrapped.TopicArn.substr(unwrapped.TopicArn.lastIndexOf(':') + 1);
      }
    }
    this.body = Message._formatMessage(this.body, opts.bodyFormat);
    this._squiss = opts.squiss;
    this._handled = false;
    this.attributes = parseMessageAttributes(opts.msg.MessageAttributes);
  }

  public isHandled() {
    return this._handled;
  }

  /**
   * Queues this message for deletion.
   */
  public del(): Promise<void> {
    if (!this._handled) {
      this._handled = true;
      return this._squiss.deleteMessage(this);
    }
    return Promise.resolve();
  }

  /**
   * Keeps this message, but releases its inFlight slot in Squiss.
   */
  public keep(): void {
    if (!this._handled) {
      this._squiss.handledMessage(this);
      this._handled = true;
    }
  }

  /**
   * Changes the visibility timeout of the message to 0.
   */
  public release(): Promise<void> {
    if (!this._handled) {
      return this._squiss.releaseMessage(this)
        .then(() => {
          this._handled = true;
        });
    } else {
      return Promise.resolve();
    }
  }

  /**
   * Changes the visibility timeout of the message.
   */
  public changeVisibility(timeoutInSeconds: number): Promise<any> {
    return this._squiss.changeMessageVisibility(this, timeoutInSeconds);
  }

}
