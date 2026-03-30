FROM node:20-slim
WORKDIR /gigiapp
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
