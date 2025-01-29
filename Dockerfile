FROM oven/bun:latest AS build

WORKDIR /work

ADD package.json /work
ADD bun.lock /work
RUN bun install --frozen-lockfile

ADD . /work
RUN bun run build

FROM nginx:alpine-slim

COPY conf.d/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /work/static/* /usr/share/nginx/html/
