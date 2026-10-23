FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Default: stdio, so directory scanners (Glama, MCP inspectors) and "docker run -i" can introspect the tool list.
# Hosted HTTP mode: override the command, e.g. `docker run -p 8080:8080 <image> node dist/http.js` (the VPS compose file does this).
EXPOSE 8080
CMD ["node", "dist/index.js"]
