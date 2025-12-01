
FROM node:20-alpine AS build
# RUN addgroup app && adduser -S -G app app
# USER app
WORKDIR /app
COPY package*.json ./
# USER root
# RUN chown -R app:app .
# USER app
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