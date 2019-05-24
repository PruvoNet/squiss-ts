'use strict';

import {SQS, S3, AWSError} from 'aws-sdk';
import {BodyFormat, Squiss} from '.';
import {IMessageAttributes, parseMessageAttributes} from './attributeUtils';
import {EventEmitter} from 'events';
import {GZIP_MARKER, decompressMessage} from './gzipUtils';
import {deleteBlob, getBlob, IS3Upload, S3_MARKER} from './s3Utils';
import {BatchResultErrorEntry} from 'aws-sdk/clients/sqs';
import {EventEmitterOverride} from './EventEmitterTypesHelper';

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
    s3Retriever: () => S3;
    s3Retain: boolean;
}

interface SNSBody {
    Message?: string;
    Subject: string;
    TopicArn: string;
}

interface IMessageEvents {
    delQueued: void;
    handled: void;
    released: void;
    timeoutReached: void;
    extendingTimeout: void;
    timeoutExtended: void;
    keep: void;
    delError: BatchResultErrorEntry;
    deleted: string;
    autoExtendFail: AWSError;
    autoExtendError: AWSError;
}

export class Message extends EventEmitter implements EventEmitterOverride<IMessageEvents> {

    /**
     * Parses a message according to the given format.
     * @param {string} msg The message to be parsed
     * @param {string} format The format of the message. Currently supports "json".
     * @returns {Object|string} The parsed message, or the original message string if the format type is unknown.
     * @private
     */
    private static formatMessage(msg: string | undefined, format: BodyFormat) {
        switch (format) {
            case 'json':
                return JSON.parse(msg || EMPTY_BODY);
            default:
                return msg;
        }
    }

    public raw: SQS.Message;
    public body?: string | any;
    public subject?: string;
    public topicArn?: string;
    public topicName?: string;
    public attributes: IMessageAttributes;
    public sqsAttributes: { [k: string]: string };
    private _squiss: Squiss;
    private _handled: boolean;
    private _opts: IMessageOpts;
    private _deleteCallback?: () => Promise<void>;
    private _s3Retriever: () => S3;
    private _s3Retain: boolean;

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
        super();
        this._opts = opts;
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
        this._squiss = opts.squiss;
        this._handled = false;
        this.attributes = parseMessageAttributes(opts.msg.MessageAttributes);
        this.sqsAttributes = opts.msg.Attributes || {};
        this._s3Retriever = opts.s3Retriever;
        this._s3Retain = opts.s3Retain;
    }

    public parse(): Promise<string | any> {
        if (this.body === undefined || this.body === null) {
            return Promise.resolve();
        }
        let promise: Promise<string>;
        if (this.attributes[S3_MARKER]) {
            delete this.attributes[S3_MARKER];
            const uploadData: IS3Upload = JSON.parse(this.body);
            const s3 = this._s3Retriever();
            promise = getBlob(s3, uploadData)
                .then((resolvedBody) => {
                    if (!this._s3Retain) {
                        this._deleteCallback = () => {
                            return deleteBlob(s3, uploadData);
                        };
                    }
                    return Promise.resolve(resolvedBody);
                });
        } else {
            promise = Promise.resolve(this.body);
        }
        promise = promise
            .then((resolvedBody) => {
                if (this.attributes[GZIP_MARKER] === 1) {
                    delete this.attributes[GZIP_MARKER];
                    return decompressMessage(resolvedBody);
                } else {
                    return Promise.resolve(resolvedBody);
                }
            });
        return promise
            .then((parsedBody) => {
                this.body = Message.formatMessage(parsedBody, this._opts.bodyFormat);
            });
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
            let promise: Promise<void>;
            if (this._deleteCallback) {
                promise = this._deleteCallback();
            } else {
                promise = Promise.resolve();
            }
            return promise
                .then(() => {
                    return this._squiss.deleteMessage(this);
                })
                .catch(() => {
                    this._handled = false;
                });
        } else {
            return Promise.resolve();
        }
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
            this._handled = true;
            return this._squiss.releaseMessage(this)
                .catch(() => {
                    this._handled = false;
                });
        }
        return Promise.resolve();
    }

    /**
     * Changes the visibility timeout of the message.
     */
    public changeVisibility(timeoutInSeconds: number): Promise<void> {
        return this._squiss.changeMessageVisibility(this, timeoutInSeconds);
    }

}
