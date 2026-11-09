const nextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://localhost:8000"}/api/:path*/`,
      },
      {
        source: "/media/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://localhost:8000"}/media/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
