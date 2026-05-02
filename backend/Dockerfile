FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Lambda container images run the handler; local dev uses server.js via npm start
CMD ["node", "server.js"]
