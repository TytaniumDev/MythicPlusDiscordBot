#!/bin/bash
set -e

npm -w packages/shared run build
# Firebase loads shared via Node.js which can't resolve .ts sources,
# so point main at the compiled output for deploy only
jq '.main = "dist/index.js"' packages/shared/package.json > /tmp/pkg.json \
  && mv /tmp/pkg.json packages/shared/package.json
npm -w packages/functions run build

# Firebase uploads only the functions dir to Cloud Build, which can't
# resolve workspace dependencies. Bundle shared as a local file dep.
cp -r packages/shared packages/functions/shared
jq '.dependencies["@mythicplus/shared"] = "file:./shared"' \
  packages/functions/package.json > /tmp/fn-pkg.json \
  && mv /tmp/fn-pkg.json packages/functions/package.json
