# 部署前检查清单

执行部署前，请确认以下事项：

- [ ] VPS 是 Ubuntu 22.04 系统
- [ ] 域名 040869.xyz 的 DNS A 记录已指向 VPS IP
- [ ] VPS 的 80/443 端口可从外网访问（云服务商安全组已放行）
- [ ] 已准备好 OpenAI API Key 或兼容 API Key
- [ ] 能 SSH 登录 VPS

## DNS 检查方法

在你的电脑上执行：
```bash
nslookup 040869.xyz
```

应返回你的 VPS IP 地址。

## 端口检查方法

在 VPS 上执行：
```bash
sudo ufw status
```

应看到 80/tcp 和 443/tcp 是 ALLOW 状态。
