# Overview

## Abstract

High-volume Amazon SQS Poller and single-queue client for Node.js 6 and up with full typescript support  
The library is production ready and is being stress used in a full blown production environment

## Main features
- Control how many messages can be handled at any given point
- Efficiently auto pull new messages when concurrency is not fully utilized
- Easy message lifecycle management
- Options to auto renew messages visibility timeout for long message processing
- Option to automatically gzip incoming and outgoing messages (based on message size) to decrease message sizes and save SQS costs
- Option to auto upload large messages to s3 and retrieve the message from s3 upon receive, in order to decrease message sizes and save SQS costs
- Full typescript support


## Versioning

We follow semver versioning

Current version

[![Npm Version](https://img.shields.io/npm/v/squiss-ts.svg?style=popout)](https://www.npmjs.com/package/squiss-ts)

