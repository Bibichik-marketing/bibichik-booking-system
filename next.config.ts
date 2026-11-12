import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return [{source:'/:locale/status',headers:[{key:'Cache-Control',value:'no-store'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'X-Frame-Options',value:'DENY'}]}]}
};

export default nextConfig;
