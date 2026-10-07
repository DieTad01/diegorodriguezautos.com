// Configuración de PM2: mantiene el servidor vivo y lo reinicia si se cae
// o si el VPS se reinicia. Uso:  pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'diegorodriguezautos',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
