# 🚀 Hostinger VPS Deployment Guide

Complete guide to deploy your animated bus booking website to Hostinger VPS.

## 📋 Prerequisites

1. **Hostinger VPS Account** with root access
2. **Domain name** (optional but recommended)
3. **Local project** ready for deployment

## 🔧 Step 1: VPS Initial Setup

### Connect to your VPS

```bash
ssh root@your-vps-ip
```

### Update system packages

```bash
apt update && apt upgrade -y
```

### Install essential packages

```bash
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw
```

## 📦 Step 2: Install Node.js & npm

### Install Node.js 20 (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### Verify installation

```bash
node --version
npm --version
```

## 🗄️ Step 3: Install PostgreSQL Database

### Install PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
```

### Start and enable PostgreSQL

```bash
systemctl start postgresql
systemctl enable postgresql
```

### Create database and user

```bash
sudo -u postgres psql
```

In PostgreSQL console:

```sql
CREATE DATABASE bus_ticket_db;
CREATE USER busticket_user WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE bus_ticket_db TO busticket_user;
\q
```

## 🔒 Step 4: Setup Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

## 📁 Step 5: Deploy Your Application

### Create app directory

```bash
mkdir -p /var/www/bus-ticket
cd /var/www/bus-ticket
```

### Clone or upload your project

**Option A: Using Git (Recommended)**

```bash
git clone https://github.com/yourusername/bus-ticket.git .
```

**Option B: Upload files via SCP from your local machine**

```bash
# Run this from your local machine
scp -r /Users/pino/Documents/live/company/bus-ticket/* root@your-vps-ip:/var/www/bus-ticket/
```

### Set proper ownership

```bash
chown -R www-data:www-data /var/www/bus-ticket
chmod -R 755 /var/www/bus-ticket
```

## ⚙️ Step 6: Configure Environment Variables

### Create production environment file

```bash
cd /var/www/bus-ticket
cp .env.example .env.production
nano .env.production
```

### Add your production environment variables

```bash
# Database
DATABASE_URL="postgresql://busticket_user:your_strong_password@localhost:5432/bus_ticket_db"

# NextAuth
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="https://yourdomain.com"

# Google OAuth (if using)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Production settings
NODE_ENV="production"
```

### Generate NextAuth secret

```bash
openssl rand -base64 32
```

## 📦 Step 7: Install Dependencies & Build

### Install dependencies

```bash
npm ci --only=production
```

### Generate Prisma client

```bash
npx prisma generate
```

### Run database migrations

```bash
npx prisma migrate deploy
```

### Build the application

```bash
npm run build
```

## 🔄 Step 8: Setup PM2 Process Manager

### Install PM2 globally

```bash
npm install -g pm2
```

### Create PM2 ecosystem file

```bash
nano ecosystem.config.js
```

Add this configuration:

```javascript
module.exports = {
  apps: [
    {
      name: "bus-ticket",
      script: "npm",
      args: "start",
      cwd: "/var/www/bus-ticket",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/bus-ticket/err.log",
      out_file: "/var/log/bus-ticket/out.log",
      log_file: "/var/log/bus-ticket/combined.log",
      time: true,
    },
  ],
};
```

### Create log directory

```bash
mkdir -p /var/log/bus-ticket
chown www-data:www-data /var/log/bus-ticket
```

### Start application with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🌐 Step 9: Configure Nginx

### Create Nginx configuration

```bash
nano /etc/nginx/sites-available/bus-ticket
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Static files caching
    location /_next/static {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

### Enable the site

```bash
ln -s /etc/nginx/sites-available/bus-ticket /etc/nginx/sites-enabled/
```

### Test Nginx configuration

```bash
nginx -t
```

### Restart Nginx

```bash
systemctl restart nginx
systemctl enable nginx
```

## 🔐 Step 10: Setup SSL Certificate (Optional but Recommended)

### Install SSL certificate with Let's Encrypt

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Setup auto-renewal

```bash
crontab -e
```

Add this line:

```bash
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Step 11: Setup Database Seeding (Optional)

### Create initial admin user and sample data

```bash
cd /var/www/bus-ticket
npx prisma db seed
```

## 🔍 Step 12: Monitoring & Logs

### Check application status

```bash
pm2 status
pm2 logs bus-ticket
```

### Check Nginx logs

```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Check application logs

```bash
tail -f /var/log/bus-ticket/combined.log
```

## 🚀 Step 13: Performance Optimization

### Enable PM2 monitoring

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:retain 7
```

### Optimize PostgreSQL

```bash
nano /etc/postgresql/*/main/postgresql.conf
```

Add these optimizations:

```bash
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
```

### Restart PostgreSQL

```bash
systemctl restart postgresql
```

## 🔄 Step 14: Deployment Script for Updates

### Create deployment script

```bash
nano /var/www/deploy.sh
```

```bash
#!/bin/bash
echo "🚀 Deploying Bus Ticket App..."

cd /var/www/bus-ticket

# Pull latest changes
git pull origin main

# Install dependencies
npm ci --only=production

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Build application
npm run build

# Restart PM2
pm2 restart bus-ticket

echo "✅ Deployment completed!"
```

### Make script executable

```bash
chmod +x /var/www/deploy.sh
```

## 🌍 Step 15: Domain Configuration

### Point your domain to VPS IP

1. Go to your domain registrar
2. Update A record to point to your VPS IP
3. Update www CNAME to point to your domain

### Wait for DNS propagation (up to 24 hours)

## 🔧 Troubleshooting Commands

### Check if app is running

```bash
curl http://localhost:3000
```

### Check ports

```bash
netstat -tulpn | grep :3000
netstat -tulpn | grep :80
```

### Restart services

```bash
pm2 restart bus-ticket
systemctl restart nginx
systemctl restart postgresql
```

### Check disk space

```bash
df -h
```

### Check memory usage

```bash
free -h
htop
```

## ✅ Verification Checklist

- [ ] VPS accessible via SSH
- [ ] Node.js and npm installed
- [ ] PostgreSQL running
- [ ] Application code deployed
- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] PM2 process running
- [ ] Nginx configured and running
- [ ] SSL certificate installed (if using domain)
- [ ] Firewall configured
- [ ] Domain pointing to VPS (if using domain)

## 🎉 Success!

Your animated bus booking website should now be live! Visit your domain or VPS IP to see your beautiful application with:

- ✨ Animated bus running in header
- 🫧 Floating bubbles and geometric shapes in footer
- 🚌 Full booking functionality
- 🔒 Secure authentication
- 📱 Responsive design

## 📞 Support

If you encounter any issues during deployment, check the logs and verify each step. The most common issues are:

1. **Port conflicts** - Ensure port 3000 is free
2. **Database connection** - Verify DATABASE_URL in .env
3. **Environment variables** - Check all required vars are set
4. **File permissions** - Ensure www-data owns the files
5. **Domain DNS** - Wait for DNS propagation

Happy deploying! 🚀
