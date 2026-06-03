FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=4173
ENV DATA_DIR=/data

EXPOSE 4173

CMD ["node", "server.js"]
