FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run prisma:generate
RUN npx nx build api

COPY docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3333

ENTRYPOINT ["/usr/local/bin/api-entrypoint.sh"]
