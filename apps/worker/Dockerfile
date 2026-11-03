FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
RUN npm ci -w apps/worker --include-workspace-root
COPY apps/worker apps/worker
RUN npm run build -w apps/worker

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/worker/package.json apps/worker/
RUN npm ci -w apps/worker --include-workspace-root --omit=dev
COPY --from=build /app/apps/worker/dist apps/worker/dist
USER node
EXPOSE 4100
CMD ["node", "apps/worker/dist/index.js"]
