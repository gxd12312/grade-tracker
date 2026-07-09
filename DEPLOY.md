# ============================================
# 项目部署说明
# ============================================

## 文件变更清单

为 PostgreSQL + Docker + HTTPS 部署，已做以下修改/新增：

| 文件 | 说明 |
|---|---|
| `prisma/schema.prisma` | 数据源改为 PostgreSQL |
| `docker-compose.yml` | 新增 nginx + certbot 服务 |
| `.env.example` | 生产环境变量模板 |
| `nginx/nginx.conf` | Nginx 反向代理 + SSL 配置 |
| `deploy.sh` | VPS 一键部署脚本 |
| `init-ssl.sh` | 单独的 SSL 证书申请脚本 |

## 架构图

```
用户浏览器
    │
    ▼
┌─────────────────────────────────┐
│  Nginx (80/443)                 │
│  - 反向代理                     │
│  - SSL 终止                     │
│  - 静态资源缓存                 │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Next.js App (3000)             │
│  - API Routes                   │
│  - AI 解析                      │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  PostgreSQL 16                  │
│  - 数据持久化卷 pgdata          │
└─────────────────────────────────┘
```

## 部署步骤（在 VPS 上执行）

### 前提条件

- Ubuntu 22.04
- 域名 040869.xyz 的 DNS A 记录指向 VPS IP
- 能 SSH 登录

### 第一步：上传项目代码

**方式 A - 通过 Git（推荐）**

```bash
# 先把代码推送到 GitHub/Gitee
git init
git add .
git commit -m "deploy setup"
git remote add origin YOUR_GIT_URL
git push -u origin main

# 在 VPS 上：
git clone YOUR_GIT_URL ~/grade-tracker
cd ~/grade-tracker
```

**方式 B - 直接上传**

```bash
# 在你本机上执行：
scp -r "E:\vibecoding\成绩记录系统" user@your-vps-ip:~/grade-tracker
```

### 第二步：配置环境变量

```bash
cd ~/grade-tracker
cp .env.example .env
nano .env
```

必须修改的项：
```
DB_PASSWORD=设置一个强密码
OPENAI_API_KEY=你的API Key
```

可选修改：
```
OPENAI_BASE_URL=如果用DeepSeek等留空则OpenAI官方
AI_MODEL=gpt-4o
```

### 第三步：执行部署

```bash
chmod +x deploy.sh init-ssl.sh
./deploy.sh
```

脚本会自动完成：
1. 安装 Docker
2. 配置防火墙
3. 构建镜像
4. 启动服务
5. 执行数据库迁移
6. 申请 SSL 证书

### 第四步：验证

访问 https://040869.xyz 应该能看到应用。

---

## 常用运维命令

```bash
# 查看日志
docker compose logs -f

# 查看应用日志
docker compose logs -f app

# 重启服务
docker compose restart

# 更新代码后重新部署
git pull
docker compose up -d --build
docker compose exec app npx prisma migrate deploy

# 备份数据库
docker compose exec db pg_dump -U postgres grade_tracker > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup.sql | docker compose exec -T db psql -U postgres grade_tracker

# 查看容器状态
docker compose ps
```

---

## 注意事项

1. **数据备份策略**：建议加定时任务自动备份数据库

```bash
# 编辑 crontab
crontab -e

# 加入每天凌晨 3 点备份
0 3 * * * cd ~/grade-tracker && docker compose exec db pg_dump -U postgres grade_tracker > backups/backup_$(date +\%Y\%m\%d).sql
```

2. **SSL 自动续期**：certbot 容器已配置自动续期，无需手动操作

3. **API Key 安全**：不要将 .env 文件提交到 Git

---

## 故障排查

### 应用无法访问

```bash
# 检查容器状态
docker compose ps

# 查看 app 日志
docker compose logs app

# 查看 nginx 日志
docker compose logs nginx
```

### 数据库连接失败

```bash
# 检查 db 容器
docker compose logs db

# 进入数据库排查
docker compose exec db psql -U postgres -d grade_tracker
```

### SSL 证书问题

```bash
# 查看证书状态
docker compose run --rm certbot certificates

# 手动续期测试
docker compose run --rm certbot renew --dry-run
```
