import {MessageAttributeValue} from '@aws-sdk/client-sqs'
import {isBoolean, isNumber, isString} from 'ts-type-guards';
import {MessageBodyAttributeMap} from './Types';

const EMPTY_OBJ = {};
const STRING_TYPE = 'String';
const NUMBER_TYPE = 'Number';
const BINARY_TYPE = 'Binary';

export type IMessageAttribute = number | string | Uint8Array | undefined | boolean;

export interface IMessageAttributes {
  FIFO_MessageDeduplicationId?: string;
  FIFO_MessageGroupId?: string;

  [k: string]: IMessageAttribute;
}

export const parseMessageAttributes = (messageAttributes: MessageBodyAttributeMap | undefined)
  : IMessageAttributes => {
  const _messageAttributes = messageAttributes || EMPTY_OBJ as MessageBodyAttributeMap;
  return Object.keys(_messageAttributes).reduce((parsedAttributes: IMessageAttributes, name: string) => {
    parsedAttributes[name] = parseAttributeValue(_messageAttributes[name]);
    return parsedAttributes;
  }, {});
};

const parseAttributeValue = (unparsedAttribute: MessageAttributeValue): IMessageAttribute => {
  const type = unparsedAttribute.DataType;
  const stringValue = unparsedAttribute.StringValue;
  const binaryValue = unparsedAttribute.BinaryValue;

  switch (type) {
    case 'Number':
      return Number(stringValue);
    case 'Binary':
      return binaryValue;
    default:
      return stringValue || binaryValue;
  }
};

export const createMessageAttributes = (messageAttributes: IMessageAttributes)
  : MessageBodyAttributeMap | undefined => {
  const keys = Object.keys(messageAttributes);
  if (keys.length === 0) {
    return ;
  }
  return Object.keys(messageAttributes).reduce((parsedAttributes: MessageBodyAttributeMap, name: string) => {
    parsedAttributes[name] = createAttributeValue(messageAttributes[name]);
    return parsedAttributes;
  }, {});
};

const createAttributeValue = (unparsedAttribute: IMessageAttribute): MessageAttributeValue => {
  if (unparsedAttribute === undefined || unparsedAttribute === null) {
    unparsedAttribute = '';
  }
  if (isNumber(unparsedAttribute)) {
    return {
      DataType: NUMBER_TYPE,
      StringValue: String(unparsedAttribute),
    };
  } else if (isString(unparsedAttribute)) {
    return {
      DataType: STRING_TYPE,
      StringValue: unparsedAttribute,
    };
  } else if (isBoolean(unparsedAttribute)) {
    return {
      DataType: STRING_TYPE,
      StringValue: `${unparsedAttribute}`,
    };
  } else {
    return {
      DataType: BINARY_TYPE,
      BinaryValue: unparsedAttribute,
    };
  }
};
