# Squiss-TS Change Log
This project adheres to [Semantic Versioning](http://semver.org/).

## [v1.2.0]
### Added
- Feature: Support message deletion resolving with Promise

## [v1.1.0]
### Added
- Bug fix: After stop, don't pull any more messages
- Feature: Added support for customizing the requested message attributes
- Feature: Stop method now returns promise that will be resolved when queue drains or timeout passes

## [v1.0.0]
### Added
- Ported from [TomFrost/Squiss](https://www.github.com/TomFrost/Squiss) v2.2.1 (__no backward compatibility__)
- complete rewrite in typescript
- move to the newest AWS sdk (v2.418.0)
- Improve the performance by always filling the handled messages and not waiting for an entire batch size to be fetched
- Parse the message attributes into a plain object in send and receive of messages
- Added `purge queue` capability
- Revised the doubly linked list to be used by an external (and lean) library
- Deleting a message now returns a promise that will be fulfilled upon success.
- Batch messaging now supports attribute map per message
