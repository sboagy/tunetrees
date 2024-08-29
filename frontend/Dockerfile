# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=22.7.0

################################################################################
# Use node image for base image for all stages.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS deps

# Set working directory for all build stages.
WORKDIR /usr/src/app

COPY tsconfig.json .eslintrc.json .eslintignore .prettierrc .prettierrc.js ./

RUN npm install --save-dev @next/eslint-plugin-next

RUN npm install gts
RUN npx gts init --yes

# Install TypeScript globally
RUN npm install -g typescript@5.5.4

RUN npm install --save-dev @types/node

COPY package.json package-lock.json ./

# Copy the main application direectories.  I'm not totally sure why 
# it needs the source in this layer if it's just installing the dependencies, 
# maybe something to do with install-time linting?
# COPY app app
# COPY auth auth
# COPY components components
# COPY public public
# COPY lib lib

# COPY middleware.ts ./

# COPY components.json next.config.js next.config.mjs postcss.config.js ./

# COPY tailwind.config.js tailwind.config.js ./

# COPY tsconfig.json ./

# RUN npm install gts

# RUN npx gts init --yes

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and package-lock.json to avoid having to copy them
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
# RUN npm ci --omit=dev
# CMD ["sleep", "infinity"]

################################################################################
# Create a stage for building the application.
FROM deps AS build

# Set the working directory
WORKDIR /usr/src/app

# ENV NEXT_PUBLIC_TT_BASE_URL="http://server:8000/tunetrees"

# Download additional development dependencies before building, as some projects require
# "devDependencies" to be installed to build. If you don't need this, remove this step.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

# Copy the main application direectories.  I'm not totally sure why 
# it needs the source in this layer if it's just installing the dependencies, 
# maybe something to do with install-time linting?
COPY app app
COPY auth auth
COPY components components
COPY public public
COPY lib lib

COPY middleware.ts ./

COPY components.json next.config.js next.config.mjs postcss.config.js ./

COPY tailwind.config.js tailwind.config.js ./

COPY tsconfig.json ./

COPY .eslintignore .eslintrc.json .prettierrc .prettierrc.js ./

# I don't know where that src directory is coming from, but it's not in the repo.
RUN rm -rf src

# Run the build script.
RUN npm run build
# CMD ["sleep", "infinity"]

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM node:${NODE_VERSION}-alpine AS final

# Set the working directory
WORKDIR /usr/src/app

# Use production node environment by default.
ENV NODE_ENV=production

# # Do this before we change the user.  Curl is added for developer fooling around 
# # in terminal.  Maybe do this only in a dev container later.
RUN apk --no-cache add curl

# Run the application as a non-root user.
USER node

# Copy package.json so that package manager commands can be used.
COPY package.json .

# Copy the production dependencies from the deps stage and also
# the built application from the build stage into the image.
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/.next ./.next

# ENV NEXT_PUBLIC_TT_BASE_URL="http://server:8000/tunetrees"

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application.
CMD ["npm", "start"]
# CMD npm run dev
