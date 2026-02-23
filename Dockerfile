# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app
ENV NODE_ENV="production"

ARG PNPM_VERSION=10.29.3
RUN npm install -g pnpm@$PNPM_VERSION


# Build stage
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install ALL dependencies (including dev) for building
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/domain/package.json packages/domain/
COPY packages/app/package.json packages/app/
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build

# Deploy production-only bundle (resolves workspace deps + prod deps)
RUN pnpm --filter @rotorsoft/es-course-app deploy /prod
# pnpm deploy skips gitignored dist/, so copy build output manually
RUN cp -r packages/app/dist /prod/dist


# Final stage — only copy what's needed
FROM base

COPY --from=build /prod/package.json /app/packages/app/
COPY --from=build /prod/node_modules /app/packages/app/node_modules
COPY --from=build /prod/dist /app/packages/app/dist

WORKDIR /app/packages/app
EXPOSE 4000
CMD [ "node", "dist/server.js" ]
