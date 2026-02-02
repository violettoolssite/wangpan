# GitHub Releases 文件网盘服务

基于 GitHub Releases 的文件存储中转服务，提供纯前端和后端两种版本。

## 🌟 版本说明

### 1. 纯前端版本（GitHub Pages）
- 🌐 **纯前端应用** - 完全运行在浏览器中
- 🔧 **无需服务器** - 直接调用 GitHub API
- 💾 **GitHub 托管** - 免费部署在 GitHub Pages

**部署访问**: 本仓库的 GitHub Pages
**配置位置**: `docs/` 目录

### 2. 后端服务版本
- 🚀 支持 2GB 大文件上传
- 📡 提供 RESTful API
- 🌍 中转服务

**在线地址**: https://wangpan.cfspider.com/

## 📖 使用 GitHub Pages 版本

### 快速开始

1. 访问本仓库的 GitHub Pages（从 Settings → Pages 查看）
2. 准备 GitHub Token:
   - 访问 https://github.com/settings/tokens/new?scopes=repo
   - 生成 `repo` 权限的 Token
3. 创建一个 GitHub 仓库用于存储文件
4. 在网页界面输入 Token 和仓库信息，开始上传文件

### 详细文档

查看: [GITHUB_PAGES_README.md](GITHUB_PAGES_README.md)

## 📦 部署后端服务

```bash
# 克隆仓库
git clone https://github.com/openwangpan/wangpan.git
cd wangpan

# 安装依赖
npm install

# 复制配置文件
cp .env.example .env

# 启动服务
npm start
```

详细配置请查看 `server.js` 中的注释。

## ✨ 特性

- 🚀 支持大文件上传（后端版 2GB，前端版 100MB）
- 🔐 Token 认证
- 💾 文件存储在 GitHub Releases
- ⚡ 中转加速
- 🌍 公共服务
- 📱 响应式界面

## 🔒 安全性

- Token 仅保存在浏览器本地（前端版）
- 服务器不存储文件或凭证（后端版）
- 支持私有仓库

## 📄 开源协议

MIT License

## 🙏 致谢

- 基于 GitHub Releases API
- 使用 Express.js 框架（后端版）
- 纯 JavaScript 实现（前端版）

## 📞 联系方式

- GitHub: https://github.com/openwangpan/wangpan
- 在线服务: https://wangpan.cfspider.com/
