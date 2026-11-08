FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w apps/api --include-workspace-root
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# pull in patched Alpine packages the base image may not include yet
RUN apk upgrade --no-cache
COPY package*.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w apps/api --include-workspace-root --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
