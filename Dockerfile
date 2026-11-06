FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=4173
ENV DATA_DIR=/data

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 4173

CMD ["node", "server.js"]
