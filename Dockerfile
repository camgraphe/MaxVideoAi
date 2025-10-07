FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production --silent && npm cache clean --force

COPY fixtures ./fixtures
COPY mock-server.js ./mock-server.js

ENV PORT=3333
ENV HOST=0.0.0.0
ENV CORS_ORIGIN="*"

EXPOSE 3333

CMD ["npm", "start"]
