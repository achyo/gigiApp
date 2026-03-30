FROM node:20-alpine
WORKDIR /gigiapp
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY prisma prisma
RUN npx prisma@5 generate
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "npx prisma@5 migrate deploy && npm run dev"]
