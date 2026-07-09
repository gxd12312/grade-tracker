# 成绩记录系统

家长拍照上传考试试卷，AI 自动解析错题与成绩，帮助追踪学习进度。

## 核心功能

- **拍照上传**：手机浏览器直接拍照或从相册选择
- **AI 智能解析**：基于 GPT-4o 识别试卷题目、得分、批改痕迹
- **错题分析**：知识点归类、学习建议
- **成绩追踪**：历史记录、趋势概览

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| 样式 | Tailwind CSS |
| 数据库 | PostgreSQL + Prisma |
| AI | OpenAI GPT-4o (Vision API) |
| 部署 | Docker Compose / Vercel |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的配置
```

需要配置：
- `DATABASE_URL`：PostgreSQL 连接字符串
- `OPENAI_API_KEY`：OpenAI API Key

### 3. 初始化数据库

```bash
npx prisma migrate dev
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## Docker 部署

```bash
docker-compose up -d
```

## 项目结构

```
src/
+-- app/
|   +-- api/
|   |   +-- parse/        # AI 解析接口
|   |   +-- exams/        # 考试记录 CRUD
|   |   +-- students/     # 学生管理
|   +-- dashboard/        # 概览页
|   +-- upload/           # 上传试卷页
|   +-- exams/[id]/       # 考试详情页
+-- components/           # UI 组件
+-- lib/
    +-- prisma.ts         # 数据库客户端
    +-- openai.ts         # OpenAI 客户端
    +-- parser.ts         # AI 解析逻辑
    +-- schema.ts         # 数据校验
prisma/
+-- schema.prisma         # 数据库模型
```
