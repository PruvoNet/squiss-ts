# Squiss-TS Change Log
This project adheres to [Semantic Versioning](http://semver.org/).

## [v1.2.2]
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

[v1.2.2]: https://github.com/PruvoNet/squiss-ts/compare/v1.2.2...v1.2.1
