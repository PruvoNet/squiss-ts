# Api docs for Squiss-TS

See <a href="https://squiss-ts.pruvo.com">https://squiss-ts.pruvo.com<a/> for the published version

## Development

To test locally, run 

```shell
docker run -p 4567:4567 --rm --name slate -v $(pwd)/build:/srv/slate/build -v $(pwd)/source:/srv/slate/source slatedocs/slate serve
```

and go <a href="http://localhost:4567">http://localhost:4567<a/> for the published version

To publish, run

```shell
docker run --rm --name slate -v $(pwd)/build:/srv/slate/build -v $(pwd)/source:/srv/slate/source slatedocs/slate build
./deploy.sh
```

Documentation can be found at <a href="https://github.com/lord/slate">https://github.com/lord/slate<a/>

## Updating contributes list

Clone [github-contributors-list](https://github.com/mgechev/github-contributors-list) and run:

```bash
./bin/githubcontrib --owner PruvoNet --repo squiss-ts --cols 6 --sortBy login --showlogin true > cont.md
```

## Framework

[slate](https://github.com/lord/slate)
