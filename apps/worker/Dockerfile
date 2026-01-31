FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/worker/package.json apps/worker/tsconfig.json ./apps/worker/

RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

RUN npm run build -w packages/shared
RUN npm run build -w apps/worker

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/worker ./apps/worker
WORKDIR /app/apps/worker
CMD ["npm", "run", "start"]
