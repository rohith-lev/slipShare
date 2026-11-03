/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Allow LAN access from any local subnet for HMR in dev
  allowedDevOrigins: ['192.168.*', '10.*', '172.16.*', 'localhost', '127.0.0.1'],

  // Global CORS + private network access headers (required for phone→server LAN requests)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS,PATCH' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
          { key: 'Access-Control-Allow-Private-Network', value: 'true' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
    ];
  },
  // NOTE: No rewrites — API routes live in app/api/ and are handled directly by Next.js
};

export default nextConfig;
