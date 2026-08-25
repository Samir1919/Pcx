const apiOrigin = process.env.PCX_API_ORIGIN ?? "http://127.0.0.1:4000";

// Next.js `allowedDevOrigins` does label-wise wildcard matching: `*` matches
// exactly one segment (octet), so RFC1918/169.254 private ranges are expressed
// as one `*` per octet. The dev-only `*` below expands to those ranges so the
// dev server is reachable from any device on the local WiFi without hardcoding
// the IP. Production never consults this list.
const PRIVATE_DEV_ORIGINS = [
  "10.*.*.*",
  "192.168.*.*",
  "172.16.*.*", "172.17.*.*", "172.18.*.*", "172.19.*.*", "172.20.*.*",
  "172.21.*.*", "172.22.*.*", "172.23.*.*", "172.24.*.*", "172.25.*.*",
  "172.26.*.*", "172.27.*.*", "172.28.*.*", "172.29.*.*", "172.30.*.*", "172.31.*.*",
  "169.254.*.*"
];

const allowedDevOrigins = (process.env.PCX_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean)
  .flatMap((host) => (host === "*" ? PRIVATE_DEV_ORIGINS : [host]));

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
