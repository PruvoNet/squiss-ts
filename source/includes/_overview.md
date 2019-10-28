# Overview

[![Npm Version](https://img.shields.io/npm/v/squiss-ts.svg?style=popout)](https://www.npmjs.com/package/squiss-ts)
[![Build Status](https://travis-ci.com/PruvoNet/squiss-ts.svg?branch=master)](https://travis-ci.com/PruvoNet/squiss-ts)
[![Test Coverage](https://api.codeclimate.com/v1/badges/64f26f52c548c8d1e010/test_coverage)](https://codeclimate.com/github/PruvoNet/squiss-ts/test_coverage)
[![Maintainability](https://api.codeclimate.com/v1/badges/64f26f52c548c8d1e010/maintainability)](https://codeclimate.com/github/PruvoNet/squiss-ts/maintainability)
[![Known Vulnerabilities](https://snyk.io/test/github/PruvoNet/squiss-ts/badge.svg?targetFile=package.json)](https://snyk.io/test/github/PruvoNet/squiss-ts?targetFile=package.json)
[![dependencies Status](https://david-dm.org/PruvoNet/squiss-ts/status.svg)](https://david-dm.org/PruvoNet/squiss-ts)
[![devDependencies Status](https://david-dm.org/PruvoNet/squiss-ts/dev-status.svg)](https://david-dm.org/PruvoNet/squiss-ts?type=dev)

## Abstract

> Install

```shell
npm install squiss-ts
```

High-volume Amazon SQS Poller and single-queue client for Node.js 6 and up with full typescript support  
The library is production ready and is being stress used in a full blown production environment

## Main features

> Quick example

```typescript
import {Squiss, Message} from 'squiss-ts';

const awsConfig = {
  accessKeyId: '<accessKeyId>',
  secretAccessKey: '<secretAccessKey>',
  region: '<region>',
};

const squiss = new Squiss({
  awsConfig,
  queueName: 'my-sqs-queue',
  bodyFormat: 'json',
  maxInFlight: 15
});

squiss.on('message', (message: Message) => {
  console.log(`${message.body.name} says: ${JSON.stringify(message.body.message)} and has attripute p1 with value ${message.attributes.p1}`);
  message.del();
});

squiss.start();

const messageToSend = {
    name: 'messageName',
    message: {
        a: 1,
        b: 2,
    },;
}

const propsToSend = {
    p1: 1,
    p2: 2,
};

squiss.sendMessage(messageToSend, 0, propsToSend);
```

- Control how many messages can be handled at any given point
- Efficiently auto pull new messages when concurrency is not fully utilized
- Easy message lifecycle management
- Options to auto renew messages visibility timeout for long message processing
- Option to automatically gzip incoming and outgoing messages (based on message size) to decrease message sizes and save SQS costs
- Option to auto upload large messages to s3 and retrieve the message from s3 upon receive, in order to decrease message size,
save SQS costs and be able to send messages bigger than SQS message size limit
- Full typescript support

## How it works

Squiss processes as many messages simultaneously as possible.  
Set the [maxInFlight](#squiss-class-constructor-options-polling-options-maxinflight) option to the number of messages your app can handle at one time without choking, and Squiss will keep
that many messages flowing through your app, grabbing more as you mark each message as handled or ready for deletion.  
If the queue is empty, Squiss will maintain an open connection to SQS, waiting for any messages that appear in real time.  
Squiss can also handle renewing the visibility timeout for your messages until you handle the message, or message handling time 
(set up by you) has passed (see [autoExtendTimeout](#squiss-class-constructor-options-auto-extend-options)).  
Bonus: Squiss will also automatically handle the message attributes formatting and parsing when receiving and sending messages. 

## Versioning

This project adheres to [Semantic Versioning](http://semver.org/)

Current version

[![Npm Version](https://img.shields.io/npm/v/squiss-ts.svg?style=popout)](https://www.npmjs.com/package/squiss-ts)
