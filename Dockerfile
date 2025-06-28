# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc

# Production image
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-build /app/package*.json ./
RUN npm install --omit=dev
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/src ./src
COPY --from=backend-build /app/src/locales ./dist/src/locales
COPY --from=backend-build /app/uploads ./uploads
COPY --from=backend-build /app/example.csv ./example.csv
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
CMD ["node", "dist/src/main.js"] 
