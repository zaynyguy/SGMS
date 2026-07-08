
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ARG VITE_API_PROXY_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_PROXY_URL=${VITE_API_PROXY_URL}
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]


# RUN npm run build
# FROM nginx:stable-alpine
# COPY nginx.conf /etc/nginx/conf.d/default.conf
# RUN rm -rf /usr/share/nginx/html/*

# COPY --from=build /app/dist /usr/share/nginx/html

# CMD ["nginx", "-g", "daemon off;"]