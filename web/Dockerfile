FROM node:22.19.0-bookworm-slim

WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
