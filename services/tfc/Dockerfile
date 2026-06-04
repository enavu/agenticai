# Stage 1: Build React client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=client-builder /app/client/dist ./public
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "node db/migrate.js && node index.js"]
