# Auto-Restart Configuration

The bot includes automatic restart and recovery mechanisms to handle crashes and unexpected disconnections.

## Built-in Auto-Restart Features

### 1. Global Error Handlers
- **Uncaught Exceptions**: Logged but don't crash the app immediately
- **Unhandled Rejections**: Logged but don't crash the app immediately
- **Graceful Shutdown**: Handles SIGTERM and SIGINT signals properly

### 2. Discord Auto-Reconnect
- Automatically reconnects on disconnect
- Retries failed login attempts
- Handles shard errors gracefully
- Logs all connection events

### 3. NestJS Graceful Shutdown
- Enabled shutdown hooks for clean resource cleanup
- Proper error handling in bootstrap process

## Using PM2 (Recommended for Production)

PM2 is a process manager that provides:
- Automatic restart on crash
- Memory limit monitoring
- Log management
- Process monitoring

### Installation

```bash
npm install -g pm2
```

### Usage

1. **Build the application:**
```bash
npm run build
```

2. **Start with PM2:**
```bash
npm run pm2:start
# or
pm2 start ecosystem.config.js
```

3. **Monitor:**
```bash
npm run pm2:monit
# or
pm2 monit
```

4. **View logs:**
```bash
npm run pm2:logs
# or
pm2 logs
```

5. **Restart:**
```bash
npm run pm2:restart
# or
pm2 restart ecosystem.config.js
```

6. **Stop:**
```bash
npm run pm2:stop
# or
pm2 stop ecosystem.config.js
```

### PM2 Configuration

The `ecosystem.config.js` file includes:
- **Auto-restart**: Enabled by default
- **Memory limit**: Restarts if memory exceeds 500MB
- **Max restarts**: 10 restarts within 10 seconds
- **Restart delay**: 4 seconds between restarts
- **Logs**: Saved to `./logs/` directory

### PM2 Commands

- `pm2 list` - List all processes
- `pm2 info mwo-founders-bot` - Show detailed info
- `pm2 logs mwo-founders-bot` - Show logs for this app
- `pm2 restart mwo-founders-bot` - Restart the app
- `pm2 delete mwo-founders-bot` - Stop and remove from PM2
- `pm2 save` - Save current process list
- `pm2 startup` - Generate startup script (for auto-start on server boot)

## Alternative: Using systemd (Linux)

For Linux servers, you can create a systemd service:

```ini
[Unit]
Description=MWO Founders Discord Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/mwo-founders
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Save as `/etc/systemd/system/mwo-founders-bot.service` and:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mwo-founders-bot
sudo systemctl start mwo-founders-bot
```

## Monitoring

### Check if bot is running:
- **PM2**: `pm2 list`
- **systemd**: `sudo systemctl status mwo-founders-bot`
- **Manual**: Check if port 3000 is listening

### View recent errors:
- **PM2**: `pm2 logs mwo-founders-bot --err`
- **systemd**: `sudo journalctl -u mwo-founders-bot -n 100`

## Troubleshooting

### Bot keeps restarting:
1. Check logs for error patterns
2. Verify environment variables are set correctly
3. Check database connectivity
4. Verify Discord token is valid

### Bot doesn't reconnect:
1. Check network connectivity
2. Verify Discord API status
3. Check firewall settings
4. Review Discord rate limits

### High memory usage:
1. PM2 will auto-restart at 500MB
2. Check for memory leaks in logs
3. Review scheduled tasks frequency
