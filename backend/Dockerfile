FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN addgroup -S app && adduser -S app -G app
USER app

# Lambda container images run the handler; local dev uses server.js via npm start
CMD ["node", "server.js"]
