FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run prisma:generate
EXPOSE 3333
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run prisma:seed && npx nx serve api --host=0.0.0.0"]
