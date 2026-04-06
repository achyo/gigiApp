FROM node:22-alpine
WORKDIR /gigiapp
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY prisma prisma
RUN npx prisma generate
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "npm run db:generate && npm run db:migrate:prod && npm run dev"]
