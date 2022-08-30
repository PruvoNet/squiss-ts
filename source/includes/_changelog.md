# Changelog

This project adheres to [Semantic Versioning](http://semver.org/).

## Development
- nothing yet

## v4.4.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.1.1...v4.4.0)

### Fixed

- improved compilation time (#120) thanks @Raiszo for your contribution!
- added support for node 18. Thanks @ted-pulsen for noticing and contributing :-)
- fixed semver node 6 support (#113)
- fixed windows support #110
- Stop using travis.ci as it is not free anymore #106
- Allow node 16 and test on it #105
  
## v4.1.1

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.1.0...v4.1.1)

### Fixed

- Change license to apache 2 [#90](https://github.com/PruvoNet/squiss-ts/issues/90)
- Updated dependencies [#91](https://github.com/PruvoNet/squiss-ts/pull/91)
- Added tests for node 14  [#91](https://github.com/PruvoNet/squiss-ts/pull/91)

## v4.1.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.10...v4.1.0)

### Fixed

- Consider migrating to the compression built into zlib [#87](https://github.com/PruvoNet/squiss-ts/issues/87)

## v4.0.10

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.9...v4.0.10)

### Fixed

- Updated dependencies [#81](https://github.com/PruvoNet/squiss-ts/issues/81)

## v4.0.9

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.8...v4.0.9)

### Fixed

- Fixed test coverage random breakage [#55(https://github.com/PruvoNet/squiss-ts/issues/55)
- Fixed usage of Buffer constructor is deprecated in Node 10 [#67](https://github.com/PruvoNet/squiss-ts/issues/67)

## v4.0.8

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.7...v4.0.8)

### Fixed

- Updated depndencies [#53](https://github.com/PruvoNet/squiss-ts/issues/53)
- Fixed readme broken links [#53](https://github.com/PruvoNet/squiss-ts/issues/53)

## v4.0.7

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.6...v4.0.7)

### Fixed

- UnhandledPromiseRejection when call to SQS deleteMessageBatch rejects [#50](https://github.com/PruvoNet/squiss-ts/issues/50)

## v4.0.6

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.5...v4.0.6)

### Fixed

- Publish only relevant files to npm

## v4.0.5

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.4...v4.0.5)

### Fixed

- Removed bad `error` event on `Message` class

## v4.0.4

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.3...v4.0.4)

### Fixed

- Fixed ailed parse messages is not handled [#48](https://github.com/PruvoNet/squiss-ts/issues/48)

## v4.0.3

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.2...v4.0.3)

### Fixed

- Fixed codeclimate issues

## v4.0.2

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.1...v4.0.2)

### Fixed

- Updated npm dependencies

## v4.0.1

[diff](https://github.com/PruvoNet/squiss-ts/compare/v4.0.0...v4.0.1)

### Fixed

- Fixed failed test in node 6
- Removed map files from npm package
- Updated npm dependencies

### Added

- CI tests for node 12

## v4.0.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v3.0.1...v4.0.0)

### Fixed

- [delError](#message-class-events-lifecycle-events-delerror-lt-batchresulterrorentry-gt) event on the
[squiss](#squiss-class) class returns the relevant message handler as well (BREAKING CHANGE)
- Fixed type safety of event handling on all classes
- Updated npm dependencies

### Added

- Moved documentation to <a href="https://squiss-ts.pruvo.com">here</a>
- Added issue and PR templates
- Added a new logo!
- Added [S3 related events](#message-class-events-s3-events) [#38](https://github.com/PruvoNet/squiss-ts/issues/38)

## v3.0.1

[diff](https://github.com/PruvoNet/squiss-ts/compare/v3.0.0...v3.0.1)

### Fixed

- Fixed documentation [#31](https://github.com/PruvoNet/squiss-ts/issues/31)

### Added

- Added [minS3Size](#squiss-class-constructor-options-s3-options-mins3size) option to set the min size that will cause upload to S3 [#33](https://github.com/PruvoNet/squiss-ts/issues/33)

## v3.0.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v2.0.0...v3.0.0)

### Added

- Added missing documentation on the [timeoutReached](#message-class-events-timeout-events-timeoutreached) event [#24](https://github.com/PruvoNet/squiss-ts/issues/24) (Thanks to [UpGo](https://github.com/upugo-dev) for the PR)
- Added contributes list
- Added typings for all events
- Emit event on [keep](#message-class-events-timeout-events-keep) - [#27](https://github.com/PruvoNet/squiss-ts/issues/27)
- [deleted](#squiss-class-events-message-events-deleted-lt-message-message-successid-string-gt) event payload on [squiss](#squiss-class) class to also contain the message itself - [#28](https://github.com/PruvoNet/squiss-ts/issues/28) (BREAKING CHANGE)
- [deleted](#message-class-events-timeout-events-deleted) event payload on [Message](#message-class) class to contain the success id - [#28](https://github.com/PruvoNet/squiss-ts/issues/28) (BREAKING CHANGE)
- send [autoExtendError](#message-class-events-timeout-events-autoextenderror-lt-awserror-gt) event instead of [error](#squiss-class-events-queue-events-error-lt-error-gt) event on [squiss](#squiss-class) class - [#28](https://github.com/PruvoNet/squiss-ts/issues/28) (BREAKING CHANGE)
- [aborted](#squiss-class-events-queue-events-aborted-lt-awserror-gt) event payload on [squiss](#squiss-class) class to be the error instance - [#28](https://github.com/PruvoNet/squiss-ts/issues/28)

### Fixed

- deduplicate messages in delete batches [#26](https://github.com/PruvoNet/squiss-ts/issues/26)

## v2.0.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.5.0...v2.0.0)

Marking the library as stable after stress usage in a full blown production environment 

## v1.5.2

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.5.1...v1.5.2)

### Fixed

- `deleteMessageBatch` causes error [#20](https://github.com/PruvoNet/squiss-ts/issues/20)

## v1.5.1

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.5.0...v1.5.1)

### Fixed

- Timeout extender doesn't extend message on time [#22](https://github.com/PruvoNet/squiss-ts/issues/22)

## v1.5.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.4.0...v1.5.0)

### Added

- Optionally retain s3 blobs on message delete [#16](https://github.com/PruvoNet/squiss-ts/issues/16)
- Optionally set prefix for s3 blob names [#15](https://github.com/PruvoNet/squiss-ts/issues/15)

### Fixed

- Batch messaging to create batches by max of 10 messages, or by max message size [#14](https://github.com/PruvoNet/squiss-ts/issues/14)

## v1.4.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.3.0...v1.4.0)

### Added

- Add ability to control SQS attributes returned and expose them in Message object [#4](https://github.com/PruvoNet/squiss-ts/issues/4)
- Option to auto gzip messages to reduce message sizes [#5](https://github.com/PruvoNet/squiss-ts/issues/5)
- Updated npm packages versions
- Add support to auto upload large messages to s3 [#6](https://github.com/PruvoNet/squiss-ts/issues/6) (same behaviour like [amazon-sqs-java-extended-client-lib](https://github.com/awslabs/amazon-sqs-java-extended-client-lib))
- Add support to define minimum message size to gzip when gzip feature is enabled [#9](https://github.com/PruvoNet/squiss-ts/issues/9)

### Fixed

- Batch message sending to handle FIFO message attributes properly
- Message properties parser to handle boolean values properly

## v1.3.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.2.4...v1.3.0)

### Added

- Expose method to check if message was handled
- If message extended time is finished, release the message slot, mark it as handled and emit [timeoutReached](#message-class-events-timeout-events-timeoutreached) event
- Message is now also event emitter, and all event related to a message will also be emitted on it
- Expose SQS typings for direct usage of the underlying SQS instance without adding it as a dependency to your project
- Allow to pass `MessageGroupId` and `MessageDeduplicationId` FIFO related parameters when sending a message

### Fixed

- Fix mocha test options

## v1.2.4

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.2.3...v1.2.4)

### Fixed

- Fix package.json to point to typing files

## v1.2.3

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.2.2...v1.2.3)

### Fixed

- Upgraded npm packages

## v1.2.2

[diff](https://github.com/PruvoNet/squiss-ts/compare/v1.2.1...v1.2.2)

### Fixed

- Upgraded linked-list version to avoid redundant typing files

## v1.2.1

### Fixed

- Upgraded mocha version to avoid security risks

## v1.2.0

### Added

- Support message deletion resolving with Promise

## v1.1.0

### Fixed

- After stop, don't pull any more messages

### Added

- Added support for customizing the requested message attributes
- Stop method now returns promise that will be resolved when queue drains or timeout passes

## v1.0.0

### Added

- Ported from [TomFrost/Squiss](https://www.github.com/TomFrost/Squiss) v2.2.1 (__no backward compatibility__)
- Complete rewrite in typescript
- Move to the newest AWS sdk (v2.418.0)
- Improve the performance by always filling the handled messages and not waiting for an entire batch size to be fetched
- Parse the message attributes into a plain object in send and receive of messages
- Added [purge queue](#squiss-class-methods-queue-methods-purgequeue-promise-lt-void-gt) capability
- Revised the doubly linked list to be used by an external (and lean) library
- Deleting a message now returns a promise that will be fulfilled upon success.
- Batch messaging now supports attribute map per message
