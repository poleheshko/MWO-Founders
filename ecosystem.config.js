// PM2 ecosystem configuration for auto-restart
// Install PM2: npm install -g pm2
// Start: pm2 start ecosystem.config.js
// Monitor: pm2 monit
// Logs: pm2 logs
// Stop: pm2 stop ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'mwo-founders-bot',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      // Restart on crash
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // Auto-restart on file changes (optional, disable in production)
      ignore_watch: ['node_modules', 'logs', 'dist'],
    },
  ],
};
