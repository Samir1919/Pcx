const apiOrigin=process.env.PCX_API_ORIGIN??"http://127.0.0.1:4000";
const nextConfig = { output: "standalone", poweredByHeader: false, agentRules: false, async rewrites(){return[{source:"/api/:path*",destination:`${apiOrigin}/api/:path*`}];} };
export default nextConfig;
