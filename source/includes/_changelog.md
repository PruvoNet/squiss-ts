# Changelog

This project adheres to [Semantic Versioning](http://semver.org/).

## Development
- nothing yet

## v4.0.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v3.0.1...v4.0.0)

### Fixed

- `delError` event on the `squiss` class returns the relevant message handler as well (BREAKING CHANGE)
- Fixed type safety of event handling on all classes
- Updated npm dependencies

### Added

- Moved documentation to <a href="https://squiss-ts.pruvo.com">here</a>
- Added issue and PR templates
- Added a new logo!
- Added S3 related events [#38](https://github.com/PruvoNet/squiss-ts/issues/38)

## v3.0.1

[diff](https://github.com/PruvoNet/squiss-ts/compare/v3.0.0...v3.0.1)

### Fixed

- Fixed documentation [#31](https://github.com/PruvoNet/squiss-ts/issues/31)

### Added

- Added [minS3Size](#squiss-class-constructor-options-s3-options-mins3size) option to set the min size that will cause upload to S3 [#33](https://github.com/PruvoNet/squiss-ts/issues/33)

## v3.0.0

[diff](https://github.com/PruvoNet/squiss-ts/compare/v2.0.0...v3.0.0)

### Added

- Added missing documentation on the `timeoutReached` event [#24](https://github.com/PruvoNet/squiss-ts/issues/24) (Thanks to [UpGo](https://github.com/upugo-dev) for the PR)
- Added contributes list
- Added typings for all events
- Emit event on `keep` event - [#27](https://github.com/PruvoNet/squiss-ts/issues/27)
- `deleted` event payload on `Squiss` class to also contain the message itself - [#28](https://github.com/PruvoNet/squiss-ts/issues/28) (BREAKING CHANGE)
- `deleted` event payload on `Message` class to contain the success id - [#28](https://github.com/PruvoNet/squiss-ts/issues/28) (BREAKING CHANGE)
- send `autoExtendError` event instead of `error` event on `Squiss` class - [#28](https://github.com/PruvoNet/squiss-ts/issues/28) (BREAKING CHANGE)
- `aborted` event payload on `Squiss` class to be the error instance - [#28](https://github.com/PruvoNet/squiss-ts/issues/28)

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
- If message extended time is finished, release the message slot, mark it as handled and emit `timeoutReached` event
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
- Added `purge queue` capability
- Revised the doubly linked list to be used by an external (and lean) library
- Deleting a message now returns a promise that will be fulfilled upon success.
- Batch messaging now supports attribute map per message
