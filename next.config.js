/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera output standalone — necessário para Railway/Docker
  output: 'standalone',
  // Permite que o servidor customizado funcione
  experimental: {
    serverComponentsExternalPackages: ['socket.io'],
  },
  // Headers de segurança básicos
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
