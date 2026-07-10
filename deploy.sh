#!/usr/bin/env bash
# ============================================
# VPS 一键部署脚本 (Ubuntu 22.04)
# ============================================
# 使用方法:
#   chmod +x deploy.sh
#   sudo ./deploy.sh
# ============================================

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo "========================================"
echo "  成绩记录系统 - 一键部署脚本"
echo "========================================"
echo ""

# ---------- 检查 root 权限 ----------
if [ "$EUID" -ne 0 ]; then
    error "请使用 sudo 运行此脚本"
fi

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

# ---------- 域名配置 ----------
DOMAIN="040869.xyz"
EMAIL="admin@040869.xyz"

# ---------- 读取 .env ----------
if [ ! -f ".env" ]; then
    error "找不到 .env 文件，请先复制 .env.example 为 .env 并填写配置"
fi

# shellcheck disable=SC1091
source .env

DB_PASSWORD="${DB_PASSWORD:-}"
if [ -z "$DB_PASSWORD" ]; then
    error ".env 中 DB_PASSWORD 未设置"
fi

# ---------- 1. 更新系统 ----------
info "更新系统包..."
apt-get update -y > /dev/null
apt-get upgrade -y > /dev/null
success "系统更新完成"

# ---------- 2. 安装基础依赖 ----------
info "安装基础依赖..."
apt-get install -y \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    > /dev/null 2>&1 || true
success "基础依赖已安装"

# ---------- 3. 安装 Docker ----------
if command -v docker &> /dev/null; then
    warn "Docker 已安装，跳过"
else
    info "安装 Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh > /dev/null 2>&1
    rm get-docker.sh
    success "Docker 安装完成"
fi

systemctl enable docker > /dev/null 2>&1
systemctl start docker > /dev/null 2>&1

if ! docker compose version &> /dev/null; then
    info "安装 Docker Compose 插件..."
    apt-get install -y docker-compose-plugin > /dev/null 2>&1
fi

docker compose version
success "Docker 环境就绪"

# ---------- 4. 配置防火墙 ----------
info "配置防火墙..."
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
success "防火墙已配置 (开放 SSH/80/443)"

# ---------- 5. 创建必要目录 ----------
mkdir -p nginx
success "目录结构已创建"

# ---------- 6. 构建镜像 ----------
info "构建 Docker 镜像..."
docker compose build --no-cache app
success "镜像构建完成"

# ---------- 7. 启动数据库和应用 ----------
info "启动数据库和应用..."
docker compose up -d db app

# 等待数据库就绪
info "等待数据库就绪（最多 30 秒）..."
for i in {1..30}; do
    if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
        success "数据库已就绪"
        break
    fi
    sleep 1
done

# ---------- 8. 数据库迁移 ----------
info "执行数据库迁移..."
if docker compose exec -T app npx prisma migrate deploy; then
    success "数据库迁移完成"
else
    warn "migrate deploy 失败，尝试 db push..."
    docker compose exec -T app npx prisma db push --accept-data-loss
    success "数据库初始化完成"
fi

# ---------- 9. 获取 SSL 证书 ----------
echo ""
warn "SSL 证书获取前请确认:"
warn "  1. 域名 ${DOMAIN} 已解析到本服务器 IP"
warn "  2. 80 端口可从外网访问"
info "当前公网 IP: $(curl -s ifconfig.me 2>/dev/null || echo '未知')"
echo ""

# 先启动 nginx
info "启动 Nginx..."
docker compose up -d nginx

sleep 3

info "申请 SSL 证书..."
if docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" 2>&1; then

    success "SSL 证书获取成功"
    # 重启 nginx 加载证书
    docker compose restart nginx
else
    warn "SSL 证书获取失败"
    warn "请确认域名解析正确后手动运行:"
    warn "  docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
fi

# ---------- 10. 最终启动 ----------
info "启动所有服务..."
docker compose up -d

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
success "应用地址: https://${DOMAIN}"
echo ""
info "常用命令:"
echo "  查看日志:     docker compose logs -f"
echo "  查看状态:     docker compose ps"
echo "  重启服务:     docker compose restart"
echo "  更新代码:     git pull && docker compose up -d --build"
echo "  备份数据库:   docker compose exec db pg_dump -U postgres grade_tracker > backup.sql"
echo "  进入数据库:   docker compose exec db psql -U postgres grade_tracker"
echo ""
