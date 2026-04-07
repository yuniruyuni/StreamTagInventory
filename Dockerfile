FROM oven/bun:1.3.3 AS build-client
WORKDIR /work
COPY package.json bun.lock /work/
COPY client/package.json /work/client/
COPY server/package.json /work/server/
COPY e2e/package.json /work/e2e/
RUN bun install --frozen-lockfile
COPY client/ /work/client/
WORKDIR /work/client
RUN bun run build

FROM oven/bun:1.3.3 AS build-server
WORKDIR /work
COPY package.json bun.lock /work/
COPY client/package.json /work/client/
COPY server/package.json /work/server/
COPY e2e/package.json /work/e2e/
RUN bun install --frozen-lockfile
COPY server/ /work/server/
WORKDIR /work/server
RUN bun build src/index.ts --compile --outfile /work/dist/server

FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=build-server /work/dist/server /app/server
COPY --from=build-client /work/client/static/ /app/static/
ENV STATIC_DIR=./static
EXPOSE 3000
CMD ["./server"]
