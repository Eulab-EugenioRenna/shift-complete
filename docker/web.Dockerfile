FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx nx build web
EXPOSE 4200
CMD ["npx", "nx", "serve", "web", "--host=0.0.0.0", "--port=4200"]
