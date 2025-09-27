#!/bin/bash

# 🔧 VPS Initial Setup Script for Bus Ticket App
# Run this script on a fresh Hostinger VPS

set -e

echo "🚀 Setting up VPS for Bus Ticket App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root (use sudo)"
    exit 1
fi

print_status "Starting VPS setup for Bus Ticket App..."

# Update system packages
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw htop

# Install Node.js 20 (LTS)
print_status "Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_status "Node.js installed: $NODE_VERSION"
print_status "npm installed: $NPM_VERSION"

# Install PostgreSQL
print_status "Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Install PM2 globally
print_status "Installing PM2 process manager..."
npm install -g pm2

# Setup firewall
print_status "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Create application directory
print_status "Creating application directory..."
mkdir -p /var/www/bus-ticket
mkdir -p /var/log/bus-ticket
mkdir -p /var/backups/bus-ticket

# Set proper ownership
chown -R www-data:www-data /var/www/bus-ticket
chown -R www-data:www-data /var/log/bus-ticket

# Create database and user
print_status "Setting up database..."
DB_PASSWORD=$(openssl rand -base64 12)
sudo -u postgres psql << EOF
CREATE DATABASE bus_ticket_db;
CREATE USER busticket_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE bus_ticket_db TO busticket_user;
\q
EOF

# Configure PostgreSQL for better performance
print_status "Optimizing PostgreSQL configuration..."
PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -n1)
PG_CONFIG="/etc/postgresql/$PG_VERSION/main/postgresql.conf"

# Backup original config
cp "$PG_CONFIG" "$PG_CONFIG.backup"

# Add optimizations
cat >> "$PG_CONFIG" << EOF

# Performance optimizations for Bus Ticket App
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
EOF

# Restart PostgreSQL
systemctl restart postgresql

# Configure Nginx
print_status "Setting up Nginx..."
# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Create optimized Nginx config
cat > /etc/nginx/nginx.conf << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
    use epoll;
    multi_accept on;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# Test Nginx configuration
nginx -t

# Enable and start Nginx
systemctl enable nginx
systemctl start nginx

# Setup log rotation for application logs
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/bus-ticket << EOF
/var/log/bus-ticket/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Create deployment user (optional)
print_status "Creating deployment user..."
if ! id "deploy" &>/dev/null; then
    useradd -m -s /bin/bash deploy
    usermod -aG sudo deploy
    usermod -aG www-data deploy
fi

# Generate SSH key for deploy user
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy ssh-keygen -t rsa -b 4096 -f /home/deploy/.ssh/id_rsa -N ""
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/*

# Setup automatic security updates
print_status "Setting up automatic security updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Create system monitoring script
print_status "Creating monitoring script..."
cat > /usr/local/bin/system-status.sh << 'EOF'
#!/bin/bash
echo "=== System Status ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo "Memory: $(free -h | grep Mem)"
echo "Disk: $(df -h / | tail -1)"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)% usage"
echo "=== PM2 Status ==="
pm2 status
echo "=== Nginx Status ==="
systemctl status nginx --no-pager -l
echo "=== PostgreSQL Status ==="
systemctl status postgresql --no-pager -l
EOF

chmod +x /usr/local/bin/system-status.sh

# Create maintenance script
cat > /usr/local/bin/maintenance.sh << 'EOF'
#!/bin/bash
echo "🔧 Running maintenance tasks..."
apt update && apt upgrade -y
npm update -g
pm2 update
certbot renew --quiet
systemctl reload nginx
echo "✅ Maintenance completed"
EOF

chmod +x /usr/local/bin/maintenance.sh

# Setup cron jobs
print_status "Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 2 * * 0 /usr/local/bin/maintenance.sh >> /var/log/maintenance.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# Create environment file template
print_status "Creating environment template..."
cat > /var/www/bus-ticket/.env.production << EOF
# Database Configuration
DATABASE_URL="postgresql://busticket_user:$DB_PASSWORD@localhost:5432/bus_ticket_db"

# NextAuth Configuration (CHANGE THESE!)
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://$(curl -s ifconfig.me)"

# Application Settings
NODE_ENV="production"
PORT=3000

# Socket.IO Configuration
SOCKET_IO_SECRET="$(openssl rand -hex 16)"
EOF

chown www-data:www-data /var/www/bus-ticket/.env.production

# Display completion message
print_status "🎉 VPS Setup completed!"
echo ""
echo "📋 Setup Summary:"
echo "=================="
echo "✅ System packages updated"
echo "✅ Node.js $(node --version) installed"
echo "✅ PostgreSQL installed and configured"
echo "✅ PM2 process manager installed"
echo "✅ Nginx web server configured"
echo "✅ Firewall configured (SSH and HTTP/HTTPS allowed)"
echo "✅ Log rotation configured"
echo "✅ Monitoring scripts created"
echo "✅ Database created with user 'busticket_user'"
echo ""
echo "🔐 Database Credentials:"
echo "========================"
echo "Database: bus_ticket_db"
echo "Username: busticket_user" 
echo "Password: $DB_PASSWORD"
echo "Host: localhost"
echo "Port: 5432"
echo ""
echo "📁 Important Directories:"
echo "========================="
echo "App Directory: /var/www/bus-ticket"
echo "Log Directory: /var/log/bus-ticket"
echo "Backup Directory: /var/backups/bus-ticket"
echo ""
echo "🔧 Next Steps:"
echo "=============="
echo "1. Upload your application code to /var/www/bus-ticket"
echo "2. Configure your domain DNS to point to this server"
echo "3. Update environment variables in /var/www/bus-ticket/.env.production"
echo "4. Run the deployment script"
echo ""
echo "🌐 Server IP: $(curl -s ifconfig.me)"
echo "📊 System Status: /usr/local/bin/system-status.sh"
echo "🔧 Maintenance: /usr/local/bin/maintenance.sh"
echo ""
print_status "Your VPS is now ready for Bus Ticket App deployment!"