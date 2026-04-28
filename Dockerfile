FROM --platform=$BUILDPLATFORM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm i

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache dumb-init wget

COPY package.json ./
RUN npm i && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
