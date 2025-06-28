# Optimized Dockerfile for Node.js + TypeScript
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/input ./input
COPY --from=build /app/output ./output
COPY --from=build /app/example.csv ./example.csv
CMD ["node", "dist/index.js"] 
