FROM node:25-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
RUN npm ci -w apps/worker --include-workspace-root
COPY apps/worker apps/worker
RUN npm run build -w apps/worker

FROM node:25-alpine
WORKDIR /app
ENV NODE_ENV=production
# pull in patched Alpine packages the base image may not include yet
ARG APK_REFRESH=2026-11-11
RUN apk upgrade --no-cache
COPY package*.json ./
COPY apps/worker/package.json apps/worker/
RUN npm ci -w apps/worker --include-workspace-root --omit=dev
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-v1.22.22 /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build /app/apps/worker/dist apps/worker/dist
USER node
EXPOSE 4100
CMD ["node", "apps/worker/dist/index.js"]
