# Dockerfile for processing CSV with Node.js and TypeScript
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm install --production
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"] 
