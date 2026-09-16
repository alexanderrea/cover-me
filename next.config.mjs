/** @type {import('next').NextConfig} */
const nextConfig = {
  // unpdf and mammoth ship prebuilt parsers that don't survive bundling into
  // the serverless output — keep them external so the route can require them.
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
