FROM oven/bun:1-alpine

WORKDIR /app
COPY server.ts .

RUN mkdir -p /watch/processed

EXPOSE 8085

CMD ["bun", "run", "server.ts"]
