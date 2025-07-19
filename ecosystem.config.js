module.exports = {
  "apps": [
    {
      "name": "sync-erp-woocommerce",
      "script": "./app.js",
      "cwd": "C:\\e-Commerce-Services\\sync-erp-woocommerce",
      "instances": 1,
      "exec_mode": "fork",
      "watch": false,
      "max_memory_restart": "1G",
      "restart_delay": 5000,
      "max_restarts": 10,
      "min_uptime": "10s",
      "env": {
        "NODE_ENV": "production",
        "PORT": 3001
      },
      "error_file": "./logs/pm2-error.log",
      "out_file": "./logs/pm2-out.log",
      "log_file": "./logs/pm2-combined.log",
      "time": true,
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "merge_logs": true,
      "autorestart": true,
      "kill_timeout": 5000
    }
  ]
};