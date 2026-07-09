# 成绩记录系统 - 设计文档

**日期**: 2026-07-08
**状态**: 已批准，实施中

## 1. 项目概述

面向家长的考试成绩追踪系统。家长通过手机拍照上传考试试卷，AI 自动识别批改情况并生成结构化的成绩与错题分析报告。

## 2. 核心功能

### 2.1 试卷上传
- 手机浏览器拍照捕获 (capture="environment")
- 支持从相册选择图片
- 图片格式：JPEG/PNG/WEBP

### 2.2 AI 解析（GPT-4o Vision）
AI 返回结构化数据：
- 科目识别
- 总分 / 满分
- 每道题：题号、得分、对错、知识点归类
- 整体分析建议

### 2.3 数据展示
- 概览卡片：历史考试列表，按日期倒序
- 详情页：单场考试的逐题分析、错题本、AI 建议

## 3. 数据模型

| 模型 | 字段 |
|---|---|
| Student | id, name, grade, timestamps |
| Exam | id, studentId, subject, examDate, totalScore, maxScore, imageUrl, analysis, timestamps |
| Question | id, examId, number, content, score, maxScore, isCorrect, knowledgePoint, suggestion, timestamps |

## 4. 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 前端框架 | Next.js 14 App Router | 全栈一体化，API Routes 直接复用 |
| 数据库 | PostgreSQL + Prisma | 结构化数据，迁移便捷，类型安全 |
| AI 模型 | GPT-4o | 最强图片理解能力，支持中文 |
| 部署方案 | Docker Compose (初期) | 一键部署到 VPS |

## 5. 部署路径

1. **开发阶段**：本地 Docker + PostgreSQL
2. **上线阶段**：VPS 单节点 Docker Compose
3. **未来扩展**：Vercel + Supabase（免运维方案）

## 6. API 设计

| 路由 | 方法 | 用途 |
|---|---|---|
| /api/parse | POST | 上传图片，AI 解析并保存 |
| /api/exams | GET | 获取考试列表 |
| /api/exams | POST | 创建学生 |
| /api/exams/[id] | GET | 获取考试详情 |
| /api/exams/[id] | DELETE | 删除考试记录 |
| /api/students | GET | 获取学生列表 |

## 7. 待开发功能

- [ ] 登录认证（目前全开放）
- [ ] 成绩趋势图表
- [ ] 错题导出（PDF/Excel）
- [ ] 多学生切换
- [ ] 数据备份/恢复