# Api docs for Squiss-TS

See <a href="https://squiss-ts.pruvo.com">https://squiss-ts.pruvo.com<a/> for the published version

## Development

To test locally, run 

```shell
bundle exec middleman server
```

and go <a href="http://localhost:4567">http://localhost:4567<a/> for the published version

To publish, run

```shell
./deploy.sh
```

Documentation can be found at <a href="https://github.com/lord/slate">https://github.com/lord/slate<a/>

## Setup

### Prerequisites

You're going to need:

 - **Linux or macOS** — Windows may work, but is unsupported.
 - **Ruby, version 2.3.1 or newer**
 - **Bundler** — If Ruby is already installed, but the `bundle` command doesn't work, just run `gem install bundler` in a terminal.

### Getting Set Up

```shell
bundle install
```

## Updating contributes list

Clone [github-contributors-list](https://github.com/mgechev/github-contributors-list) and run:

```bash
./bin/githubcontrib --owner PruvoNet --repo squiss-ts --cols 6 --sortBy login --showlogin true > cont.md
```
