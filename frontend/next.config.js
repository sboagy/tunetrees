/** @type {import('next').NextConfig} */
// const nextConfig = {}

// module.exports = nextConfig
/** @type {import("next").NextConfig} */
module.exports = {
  output: "standalone",
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true,
  },
};

