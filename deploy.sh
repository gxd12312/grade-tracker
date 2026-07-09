# ============================================
# VPS 一键部署脚本
# ============================================
# 在 Ubuntu 22.04 上执行此脚本完成全部部署
# 使用方法:
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo "========================================"
echo "  成绩记录系统 - 一键部署脚本"
echo "========================================"
echo ""

# ---------- 检查是否为 root 或 sudo ----------
if [ "$EUID" -ne 0 ]; then
    error "请使用 sudo 运行此脚本"
fi

# 确定实际用户（sudo 用户）
ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)

info "部署用户: $ACTUAL_USER (home: $ACTUAL_HOME)"

# ---------- 1. 更新系统 ----------
info "更新系统包..."
apt-get update -y && apt-get upgrade -y
success "系统更新完成"

# ---------- 2. 安装依赖 ----------
info "安装必要依赖..."
apt-get install -y \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw
success "依赖安装完成"

# ---------- 3. 安装 Docker ----------
if command -v docker &> /dev/null; then
    warn "Docker 已安装，跳过"
else
    info "安装 Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    usermod -aG docker $ACTUAL_USER 2>/dev/null || true
    success "Docker 安装完成"
fi

# 启动 Docker
systemctl enable docker
systemctl start docker

# 安装 Docker Compose
if ! docker compose version &> /dev/null; then
    info "安装 Docker Compose..."
    apt-get install -y docker-compose-plugin
    success "Docker Compose 安装完成"
fi

docker compose version
success "Docker 环境就绪"

# ---------- 4. 配置防火墙 ----------
info "配置 UFW 防火墙..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
success "防火墙配置完成 (开放 SSH/80/443)"

# ---------- 5. 准备项目目录 ----------
DEPLOY_DIR="$ACTUAL_HOME/grade-tracker"
info "项目目录: $DEPLOY_DIR"

if [ -d "$DEPLOY_DIR" ]; then
    warn "目录已存在，执行 git pull 更新..."
    cd "$DEPLOY_DIR"
    sudo -u $ACTUAL_USER git pull
else
    info "克隆项目..."
    sudo -u $ACTUAL_USER git clone https://github.com/YOUR_REPO/grade-tracker.git "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

# ---------- 6. 配置环境变量 ----------
if [ ! -f ".env" ]; then
    info "创建 .env 文件..."
    sudo -u $ACTUAL_USER cp .env.example .env
    echo ""
    warn "请编辑 .env 文件配置你的 API Key:"
    warn "  nano .env"
    warn ""
    warn "必须修改的项:"
    warn "  - DB_PASSWORD: 数据库密码"
    warn "  - OPENAI_API_KEY: 你的 API Key"
    echo ""
    read -p "是否现在编辑 .env 文件？(y/n): " edit_now
    if [ "$edit_now" = "y" ] || [ "$edit_now" = "Y" ]; then
        nano .env
    else
        error "请先配置 .env 文件后再运行此脚本"
    fi
else
    success ".env 文件已存在"
fi

# ---------- 7. 创建必要目录 ----------
mkdir -p certbot/conf certbot/www nginx data
chown -R $ACTUAL_USER:$ACTUAL_USER .

# ---------- 8. 构建并启动应用 ----------
info "构建 Docker 镜像..."
sudo -u $ACTUAL_USER docker compose build --no-cache

info "启动应用（不含 Nginx 先获取证书）..."
sudo -u $ACTUAL_USER docker compose up -d app db

# 等待数据库就绪
info "等待数据库就绪..."
sleep 10

# ---------- 9. 执行数据库迁移 ----------
info "执行数据库迁移..."
sudo -u $ACTUAL_USER docker compose exec -T app npx prisma migrate deploy
success "数据库迁移完成"

# ---------- 10. 获取 SSL 证书 ----------
echo ""
warn "获取 SSL 证书前请确认:"
warn "  1. 域名 040869.xyz 已解析到本服务器 IP: $(curl -s ifconfig.me)"
warn "  2. 80 端口可从外网访问"
echo ""
read -p "是否获取 SSL 证书？(y/n): " get_ssl

if [ "$get_ssl" = "y" ] || [ "$get_ssl" = "Y" ]; then
    info "获取 SSL 证书..."

    # 先启动一个临时 Nginx 处理 certbot 验证
    sudo -u $ACTUAL_USER docker compose up -d nginx

    # 获取证书
    sudo -u $ACTUAL_USER docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@040869.xyz \
        --agree-tos \
        --no-eff-email \
        -d 040869.xyz \
        -d www.040869.xyz || warn "证书获取失败，请检查域名解析"

    if [ -d "certbot/conf/live/040869.xyz" ]; then
        success "SSL 证书获取成功"
        # 重启 Nginx 加载新证书
        sudo -u $ACTUAL_USER docker compose restart nginx
    else
        warn "证书文件未生成，使用 HTTP 模式"
    fi
fi

# ---------- 11. 重启所有服务 ----------
info "重启所有服务..."
sudo -u $ACTUAL_USER docker compose restart

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
success "应用地址: https://040869.xyz"
echo ""
info "常用命令:"
echo "  查看日志:   docker compose logs -f"
echo "  重启服务:   docker compose restart"
echo "  更新代码:   git pull && docker compose up -d --build"
echo "  备份数据:   docker compose exec db pg_dump -U postgres grade_tracker > backup.sql"
echo ""
