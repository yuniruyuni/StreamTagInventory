FROM oven/bun:latest AS build

WORKDIR /work

ADD package.json /work
ADD bun.lockb /work
RUN bun install --frozen-lockfile

ADD . /work
RUN bun run build

FROM joseluisq/static-web-server:latest

COPY --from=build /work/static/* /public/