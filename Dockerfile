# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app
ENV NODE_ENV="production"

ARG PNPM_VERSION=10.29.3
RUN npm install -g pnpm@$PNPM_VERSION


# Prod-deps stage — only production dependencies
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/domain/package.json packages/domain/
COPY packages/app/package.json packages/app/
RUN pnpm install --frozen-lockfile --prod


# Build stage — all dependencies (including dev)
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/domain/package.json packages/domain/
COPY packages/app/package.json packages/app/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build


# Final stage — prod deps + build output
FROM base

# Production node_modules (no dev deps)
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/packages/domain/node_modules /app/packages/domain/node_modules
COPY --from=deps /app/packages/app/node_modules /app/packages/app/node_modules

# Workspace root
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/

# Domain package — compiled JS output
COPY --from=build /app/packages/domain/package.json /app/packages/domain/
COPY --from=build /app/packages/domain/dist /app/packages/domain/dist

# App package — compiled server + built client assets
COPY --from=build /app/packages/app/package.json /app/packages/app/
COPY --from=build /app/packages/app/dist /app/packages/app/dist

EXPOSE 4000
CMD [ "pnpm", "run", "start" ]
