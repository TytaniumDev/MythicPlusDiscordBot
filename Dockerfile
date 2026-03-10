FROM node:22-slim

WORKDIR /app

ARG GIT_SHA=
ENV GIT_SHA=${GIT_SHA}

# Copy workspace configs first for better layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot/package.json packages/bot/

# Install dependencies (including devDependencies for tsc)
RUN npm ci

# Copy source code
COPY packages/ packages/
COPY tsconfig*.json ./

# Build the TypeScript code
RUN npm run build

# Only keep production dependencies to save space
RUN npm ci --omit=dev

# Run the compiled JS output directly with node
CMD ["node", "packages/bot/dist/src/main.js"]
