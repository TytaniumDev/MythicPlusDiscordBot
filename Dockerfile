FROM node:22-slim

WORKDIR /app

ARG GIT_SHA=
ENV GIT_SHA=${GIT_SHA}

# Copy workspace configs first for better layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot/package.json packages/bot/

RUN npm ci --workspace=packages/shared --workspace=packages/bot

# Copy source code
COPY packages/ packages/

CMD ["node", "node_modules/.bin/tsx", "packages/bot/src/bot.ts"]
