# Build stage
FROM node:18 AS build
WORKDIR /app
COPY package.json package-lock.json ./

# --legacy-peer-deps: i18next lists an optional typescript peer (^5||^6||^7)
# that's newer than the typescript react-scripts@5.0.1 itself pins (^3||^4).
# It's a peerOptional -- i18next doesn't actually need typescript at runtime
# -- so this is a safe resolution, and matches how the lockfile itself was
# generated locally (a plain `npm install` here would fail with ERESOLVE).
RUN npm install --legacy-peer-deps
COPY . .

# Build-time config: Render injects dashboard Environment Variables as
# build args for any ARG declared here with a matching name.
ARG REACT_APP_API_BASE
ARG REACT_APP_API_PREFIX
ARG REACT_APP_WITH_CREDENTIALS
ARG REACT_APP_VERSION
# RENDER_GIT_COMMIT is auto-injected by Render as a build arg on every
# deploy (no dashboard config needed) -- baking it in lets the UI show
# exactly which commit is actually deployed, no manual version bump needed.
ARG RENDER_GIT_COMMIT
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE \
    REACT_APP_API_PREFIX=$REACT_APP_API_PREFIX \
    REACT_APP_WITH_CREDENTIALS=$REACT_APP_WITH_CREDENTIALS \
    REACT_APP_VERSION=$REACT_APP_VERSION \
    REACT_APP_GIT_COMMIT=$RENDER_GIT_COMMIT

RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
