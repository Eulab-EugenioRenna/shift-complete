FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run prisma:generate && npx nx build api
EXPOSE 3333
CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && node dist/apps/api/main.js"]
