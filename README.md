[![Npm Version](https://img.shields.io/npm/v/squiss-ts.svg?style=popout)](https://www.npmjs.com/package/squiss-ts)
[![node](https://img.shields.io/node/v-lts/squiss-ts)](https://travis-ci.com/PruvoNet/squiss-ts)
[![Build Status](https://github.com/PruvoNet/squiss-ts/actions/workflows/ci.yml/badge.svg?branch=master)](https://travis-ci.com/PruvoNet/squiss-ts)
[![Test Coverage](https://api.codeclimate.com/v1/badges/177b18abdb55fdf90cf8/test_coverage)](https://codeclimate.com/github/PruvoNet/squiss-ts/test_coverage)
[![Maintainability](https://api.codeclimate.com/v1/badges/177b18abdb55fdf90cf8/maintainability)](https://codeclimate.com/github/PruvoNet/squiss-ts/maintainability)
[![Known Vulnerabilities](https://snyk.io/test/github/PruvoNet/squiss-ts/badge.svg?targetFile=package.json)](https://snyk.io/test/github/PruvoNet/squiss-ts?targetFile=package.json)
[![dependencies Status](https://david-dm.org/PruvoNet/squiss-ts/status.svg)](https://david-dm.org/PruvoNet/squiss-ts)
[![devDependencies Status](https://david-dm.org/PruvoNet/squiss-ts/dev-status.svg)](https://david-dm.org/PruvoNet/squiss-ts?type=dev)

<p align="center">
  <a href="https://squiss-ts.pruvo.com"><img src="https://github.com/PruvoNet/squiss-ts/blob/docs/source/images/logo.png?raw=true" /></a>
</p>

# Squiss-TS 
High-volume Amazon SQS Poller and single-queue client for Node.js 6 and up with full typescript support  
The library is production ready and is being stress used in a full blown production environment

## Main features
- Control how many messages can be handled at any given point
- Efficiently auto pull new messages when concurrency is not fully utilized
- Easy message lifecycle management
- Options to auto renew messages visibility timeout for long message processing
- Option to automatically gzip incoming and outgoing messages (based on message size) to decrease message sizes and save SQS costs
- Option to auto upload large messages to s3 and retrieve the message from s3 upon receive, in order to decrease message sizes, save SQS costs and be able to send messages bigger than SQS size limit
- Full typescript support

## Documentation

Please see full documentation <a href="https://squiss-ts.pruvo.com">here</a>

## Quick example
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
    },
}

const propsToSend = {
    p1: 1,
    p2: 2,
};

squiss.sendMessage(messageToSend, 0, propsToSend);
```

## Install
```bash
npm install squiss-ts
```

## How it works
Squiss processes as many messages simultaneously as possible.  
Set the [maxInFlight](https://squiss-ts.pruvo.com/#squiss-class-constructor-options-polling-options-maxinflight) option to the number of messages your app can handle at one time without choking, and Squiss will keep
that many messages flowing through your app, grabbing more as you mark each message as handled or ready for deletion.  
If the queue is empty, Squiss will maintain an open connection to SQS, waiting for any messages that appear in real time.  
Squiss can also handle renewing the visibility timeout for your messages until you handle the message, or message handling time 
(set up by you) has passed (see [autoExtendTimeout](https://squiss-ts.pruvo.com/#squiss-class-constructor-options-auto-extend-options-autoextendtimeout)).  
Bonus: Squiss will also automatically handle the message attributes formatting and parsing when receiving and sending messages. 

## Versions
Squiss supports Node 6 LTS and higher.

## Credits
This project is a typescript port (with better performance, bug fixes and new features) of the wonderful and unmaintnaed project [TomFrost/Squiss](https://www.github.com/TomFrost/Squiss)  
Squiss was originally created at [TechnologyAdvice](http://www.technologyadvice.com) in Nashville, TN.

## Contributing

All contributions are happily welcomed!  
Please make all pull requests to the `master` branch from your fork and ensure tests pass locally.
