# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# Install workspace dependencies first (better layer caching)
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --include-workspace-root

# Build server + client
COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --omit=dev --include-workspace-root

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
COPY ml/models ml/models

EXPOSE 5000
CMD ["node", "server/dist/index.js"]
