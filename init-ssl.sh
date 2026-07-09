# ============================================
# SSL 证书申请脚本（单独执行版）
# ============================================
# 如果 deploy.sh 申请证书失败，可单独运行此脚本
# 使用方法:
#   chmod +x init-ssl.sh
#   ./init-ssl.sh
# ============================================

set -euo pipefail

DOMAIN="040869.xyz"
EMAIL="admin@040869.xyz"

echo "为 $DOMAIN 申请 SSL 证书..."

# 启动临时服务
docker compose up -d app db nginx

# 等待服务就绪
sleep 5

# 申请证书
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# 重启 Nginx 加载证书
docker compose restart nginx

echo "SSL 证书申请完成！"
