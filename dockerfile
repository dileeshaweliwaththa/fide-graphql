# FROM node:lts-alpine3.17 As development
FROM node:20.10.0-alpine As development


RUN apk add --no-cache \
    autoconf \
    automake \
    bash \
    g++ \
    libc6-compat \
    libjpeg-turbo-dev \
    libpng-dev \
    make \
    nasm \
    libtool

ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV

WORKDIR /app

RUN npm install -g @nestjs/cli

COPY package.json ./
COPY package-lock.json ./

RUN npm install 

COPY . .

RUN npm run build


FROM node:20.10.0-alpine as dev

RUN apk add --no-cache \
    autoconf \
    automake \
    bash \
    g++ \
    libc6-compat \
    libjpeg-turbo-dev \
    libpng-dev \
    make \
    nasm \
    libtool

ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV

WORKDIR /app

RUN npm install -g @nestjs/cli

COPY package.json ./
COPY package-lock.json ./

RUN npm install 

COPY . .

RUN npm run build

COPY --from=development /app/dist ./dist

CMD ["node", "dist/main"]

