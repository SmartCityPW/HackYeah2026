# Obraz frontendu: build Angulara w Node, potem statyczne pliki w nginx.
# Wersje są parametrami: docker build --build-arg NODE_VERSION=24 --build-arg NGINX_VERSION=1.29 .
ARG NODE_VERSION=24
ARG NGINX_VERSION=1.29

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:${NGINX_VERSION}-alpine
# Szablon: oficjalny obraz nginx podstawia w nim zmienne środowiskowe z filtra (tylko FRONTEND_*) przy starcie kontenera.
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
ENV FRONTEND_CONFIG=app-config.production.yaml \
    NGINX_ENVSUBST_FILTER=^FRONTEND_
COPY --from=build /app/dist/HackYeah2026/browser /usr/share/nginx/html
# Konfiguracja aplikacji (adres backendu, tryby api.mode.*, limity) to zwykły plik YAML: docker-compose podmienia go z hosta,
# więc zmiana nie wymaga przebudowy obrazu. Bez tego działa wersja wbudowana w obraz.
EXPOSE 80
