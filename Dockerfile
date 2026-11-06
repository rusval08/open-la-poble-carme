FROM node:24-alpine

RUN apk add --no-cache su-exec

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=4173
ENV DATA_DIR=/data

RUN mkdir -p /data && chown -R node:node /app /data
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/cpool-entrypoint
USER root
ENTRYPOINT ["/usr/local/bin/cpool-entrypoint"]

EXPOSE 4173

CMD ["node", "server.js"]
