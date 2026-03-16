FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run prisma:generate && npx tsc -p apps/api/tsconfig.app.json
EXPOSE 3333
CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && node dist/apps/api/main.js"]
