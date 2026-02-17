/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Use a separate dir for dev/build to avoid EPERM on locked .next folder.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = nextConfig;
