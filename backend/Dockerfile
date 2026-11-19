FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY shared shared
COPY database database
COPY frontend frontend
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
ENV HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --workspace=backend
COPY shared shared
COPY backend backend
COPY database database
COPY --from=frontend /app/frontend/dist frontend/dist
USER node
EXPOSE 5000
CMD ["node", "backend/server.js"]
