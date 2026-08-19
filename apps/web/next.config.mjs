const apiOrigin = process.env.PCX_API_ORIGIN ?? "http://127.0.0.1:4000";
const allowedDevOrigins = (process.env.PCX_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  }
};
export default nextConfig;
