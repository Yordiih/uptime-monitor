FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM nginxinc/nginx-unprivileged:alpine
USER root
# pull in patched Alpine packages the base image may not include yet
ARG APK_REFRESH=2026-11-11
RUN apk upgrade --no-cache
USER 101
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
