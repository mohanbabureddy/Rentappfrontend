# Build stage
FROM node:18 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

# Build-time config: Render injects dashboard Environment Variables as
# build args for any ARG declared here with a matching name.
ARG REACT_APP_API_BASE
ARG REACT_APP_API_PREFIX
ARG REACT_APP_WITH_CREDENTIALS
ARG REACT_APP_VERSION
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE \
    REACT_APP_API_PREFIX=$REACT_APP_API_PREFIX \
    REACT_APP_WITH_CREDENTIALS=$REACT_APP_WITH_CREDENTIALS \
    REACT_APP_VERSION=$REACT_APP_VERSION

RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
