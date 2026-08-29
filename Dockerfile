FROM oven/bun:1.4.0 AS build-client
# client bundle に焼き込む public env (client/bin/build.ts の allowlist と対応)。
# build-arg 未指定時は localhost (= ローカル開発用 default) になるため、production
# image を作る場合は必ず GitHub Actions 側で --build-arg を渡すこと。
ARG BUN_PUBLIC_TWITCH_CLIENT_ID=d2kz8x5se7k6b1n0picux0r7kaozi3
ARG BUN_PUBLIC_APP_BASE_URL=http://localhost:3000
ENV BUN_PUBLIC_TWITCH_CLIENT_ID=$BUN_PUBLIC_TWITCH_CLIENT_ID
ENV BUN_PUBLIC_APP_BASE_URL=$BUN_PUBLIC_APP_BASE_URL
WORKDIR /work
COPY package.json bun.lock /work/
COPY client/package.json /work/client/
COPY server/package.json /work/server/
COPY e2e/package.json /work/e2e/
RUN bun install --frozen-lockfile
COPY shared/ /work/shared/
COPY scripts/ /work/scripts/
COPY client/ /work/client/
WORKDIR /work/client
RUN bun run build

FROM oven/bun:1.4.0 AS build-server
WORKDIR /work
COPY package.json bun.lock /work/
COPY client/package.json /work/client/
COPY server/package.json /work/server/
COPY e2e/package.json /work/e2e/
RUN bun install --frozen-lockfile
COPY shared/ /work/shared/
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
