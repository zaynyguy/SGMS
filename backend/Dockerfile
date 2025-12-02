
FROM node:20-alpine
# RUN addgroup app && adduser -S -G app app
# USER app
RUN apk add --no-cache bash netcat-openbsd
WORKDIR /app
COPY package*.json ./
# USER root
# RUN chown -R app:app .
# USER app
RUN npm ci
COPY . .

EXPOSE 5000
# Assumes your package.json has a "dev" script that runs node (e.g. "node index.js" or "node ./bin/www")
CMD ["npm", "run", "dev"]