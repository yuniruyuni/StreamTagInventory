FROM oven/bun:latest AS build

WORKDIR /work

ADD package.json /work
ADD bun.lockb /work
RUN bun install --frozen-lockfile

ADD . /work
RUN bun run build

FROM nginx:alpine-slim

COPY --from=build /work/static/* /usr/share/nginx/html/