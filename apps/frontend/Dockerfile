FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/frontend/package.json ./package.json
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
COPY --from=deps /app/node_modules ./node_modules
COPY apps/frontend ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
