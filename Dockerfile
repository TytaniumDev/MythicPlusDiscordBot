FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app
# The bot writes its log file (mythic_bot.log) to the working directory.
RUN chown node:node /app

ARG GIT_SHA=
ENV GIT_SHA=${GIT_SHA}

# Copy workspace configs first for better layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot/package.json packages/bot/

RUN npm ci --omit=dev --workspace=packages/shared --workspace=packages/bot \
  && npm cache clean --force

# Copy source code (only the two workspaces the bot runs)
COPY packages/shared/ packages/shared/
COPY packages/bot/ packages/bot/

USER node

CMD ["node", "node_modules/.bin/tsx", "packages/bot/src/main.ts"]
