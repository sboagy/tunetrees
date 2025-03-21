# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.9.0

# Use node image for base image for all stages.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS deps

# Set working directory for all build stages.
WORKDIR /usr/src/app

# Copy necessary configuration files
COPY eslint.config.mjs .prettierrc .prettierrc.js next.config.mjs next.config.mjs *.d.ts ./

# Copy necessary configuration files
COPY tsconfig.json  ./tsconfig.json
COPY tsconfig.theme-script.json  ./tsconfig.theme-script.json

# Install necessary dependencies
RUN npm install --save-dev @next/eslint-plugin-next
RUN npm install gts
RUN npx gts init --no

# Remove the src directory created by gts
RUN rm -rf src

# # Verify the presence of tsconfig-google.json
# RUN (echo "Checking for tsconfig-google.json (1)" && \
#     ls -l /usr/src/app/node_modules/gts/tsconfig-google.json && \
#     echo "Done checking for tsconfig-google.json (1)")

# re-copy the configuration files to since gts is evil and overwrites them
COPY eslint.config.mjs .prettierrc .prettierrc.js next.config.mjs next.config.mjs *.d.ts ./

# Copy necessary configuration files
COPY tsconfig.json  ./tsconfig.json
COPY tsconfig.theme-script.json  ./tsconfig.theme-script.json

# Install TypeScript globally
RUN npm install -g typescript@5.7.2

# # Verify the presence of tsconfig-google.json
# RUN (echo "Checking for tsconfig-google.json (2)" && \
#     ls -l /usr/src/app/node_modules/gts/tsconfig-google.json && \
#     echo "Done checking for tsconfig-google.json (2)")

# Install type definitions
RUN npm install --save-dev @types/node

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# # Verify the presence of tsconfig-google.json
# RUN (echo "Checking for tsconfig-google.json (3)" && \
#     ls -l /usr/src/app/node_modules/gts/tsconfig-google.json && \
#     echo "Done checking for tsconfig-google.json (3)")

# RUN (echo "Dumping tsconfig-google.json (3)" && \
#     cat /usr/src/app/node_modules/gts/tsconfig-google.json && \
#     echo "Done Dumping tsconfig-google.json (3)")

# RUN (echo "Running pwd" && \
#     pwd && \
#     echo "Done running pwd")

# # Print the environment variables
# RUN echo "Printing environment variables" && \
#     printenv && \
#     echo "Done printing environment variables"

# # Print the contents of tsconfig.json
# RUN echo "Printing tsconfig.json contents" && \
#     cat tsconfig.json && \
#     echo "Done printing tsconfig.json contents"

# # Print the contents of node_modules/gts
# RUN echo "Printing contents of node_modules/gts" && \
#     ls -l /usr/src/app/node_modules/gts && \
#     echo "Done printing contents of node_modules/gts"

# # Print the contents of the current directory
# RUN echo "Printing contents of the current directory" && \
#     ls -l /usr/src/app && \
#     echo "Done printing contents of the current directory"

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and package-lock.json to avoid having to copy them
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
  --mount=type=bind,source=package-lock.json,target=package-lock.json \
  --mount=type=cache,target=/root/.npm \
  npm ci --omit=dev

################################################################################
# Create a stage for building the application.
FROM deps AS build

# Set the working directory
WORKDIR /usr/src/app

# Download additional development dependencies before building, as some projects require
# "devDependencies" to be installed to build. If you don't need this, remove this step.
RUN --mount=type=bind,source=package.json,target=package.json \
  --mount=type=bind,source=package-lock.json,target=package-lock.json \
  --mount=type=cache,target=/root/.npm \
  npm ci

# Copy the main application directories.
COPY app app
COPY auth auth
COPY hooks hooks
COPY components components
COPY public public
COPY lib lib
COPY src src

COPY middleware.ts ./
COPY components.json next.config.mjs next.config.mjs postcss.config.mjs ./
COPY tailwind.config.mjs ./
COPY tsconfig.json ./
COPY tsconfig.theme-script.json  ./

COPY eslint.config.mjs .prettierrc .prettierrc.js ./

# Run the build script.
RUN npm run build

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM node:${NODE_VERSION}-alpine AS final

# Set the working directory
WORKDIR /usr/src/app

# Use production node environment by default.
ENV NODE_ENV=production

# Do this before we change the user. Curl is added for developer fooling around 
# in terminal. Maybe do this only in a dev container later.
RUN apk --no-cache add curl

# Run the application as a non-root user.
USER node

# Copy package.json so that package manager commands can be used.
COPY package.json .

# Copy the production dependencies, built application, and public assets
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/.next ./.next
COPY --from=build /usr/src/app/public ./public
COPY --from=build /usr/src/app/src ./src

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application.
CMD ["npm", "start"]
