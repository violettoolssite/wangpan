# GitHub Pages 网盘 - 纯前端版本

一款完全基于 GitHub Pages 托管的网盘应用，无需任何后端服务器，文件直接存储在 GitHub Releases。

## ✨ 特点

- 🌟 **纯前端应用** - 完全运行在浏览器中
- 🔧 **无需服务器** - 直接调用 GitHub API
- 💾 **GitHub 托管** - 免费部署在 GitHub Pages
- 🔒 **数据安全** - Token 仅保存在浏览器本地
- ⚡ **即开即用** - 无需配置，打开即用
- 📱 **响应式设计** - 支持移动端
- 🎨 **美观界面** - 现代化 UI 设计

## 🚀 在线使用

直接访问：[https://openwangpan.github.io/wangpan/](https://openwangpan.github.io/wangpan/)（部署后）

或自己部署到 GitHub Pages：

## 📦 部署到 GitHub Pages

### 方法 1: 使用本仓库的 Pages

1. Fork 本仓库到你的账号
2. 访问仓库的 Settings → Pages
3. Source 选择 `Deploy from a branch`
4. Branch 选择 `main` (或 `github-pages`)，目录选择 `/ (root)`
5. 保存后等待几分钟，即可通过 `https://你的用户名.github.io/wangpan/` 访问

### 方法 2: 使用 gh-pages 分支

```bash
git clone https://github.com/openwangpan/wangpan.git
cd wangpan
git checkout -b gh-pages

# 复制 github-pages 目录的内容到根目录
cp -r github-pages/* .
rm -rf github-pages

git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages

# 然后在 Settings → Pages 选择 gh-pages 分支
```

### 方法 3: 使用 GitHub Actions 自动部署

在仓库根目录创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./github-pages
```

## 📖 使用说明

### 1. 准备工作

**创建 GitHub 仓库：**
- 访问 https://github.com/new
- 创建一个新仓库（public 或 private 都可以）

**生成 Personal Access Token：**
- 访问 https://github.com/settings/tokens/new?scopes=repo
- 勾选 `repo` 权限
- 复制生成的 Token

### 2. 配置网盘

打开网页后：
1. 点击右上角的 ⚙️ 设置按钮
2. 填写：
   - GitHub Token
   - 仓库所有者
   - 仓库名
   - Release 标签（默认 latest）
3. 点击"连接仓库"

### 3. 上传文件

- 拖拽文件到上传区域，或点击选择文件
- 等待上传完成
- 文件将保存到你的 GitHub Releases

### 4. 下载/删除文件

- 在文件列表中点击"下载"按钮下载文件
- 点击"删除"按钮删除文件

## 🔧 技术栈

- **前端框架**: 纯 JavaScript (Vanilla JS)
- **API 调用**: GitHub REST API v3
- **样式**: 现代化 CSS3
- **部署**: GitHub Pages
- **存储**: GitHub Releases

## 📋 API 端点

本应用直接使用以下 GitHub API：

- `GET /repos/{owner}/{repo}/releases` - 列出所有 releases
- `GET /repos/{owner}/{repo}/releases/tags/{tag}` - 获取指定 tag 的 release
- `POST /repos/{owner}/{repo}/releases` - 创建新的 release
- `POST /repos/{owner}/{repo}/releases/{release_id}/assets` - 上传文件到 release
- `DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}` - 删除文件

## 🔒 安全性

- ✅ Token 仅保存在浏览器 localStorage
- ✅ 不经过任何中间服务器
- ✅ 直接调用 GitHub API
- ✅ 支持私有仓库
- ✅ HTTPS 传输

## ⚠️ 限制

- **单文件大小**: GitHub API 限制最大约 100MB
- **仓库大小**: 建议不超过 1GB
- **上传速度**: 取决于网络和 GitHub 限制
- **浏览器兼容**: 建议使用现代浏览器

## 🌐 自定义部署

如果你想部署到自己的域名：

1. 在仓库根目录添加 `CNAME` 文件
2. 写入你的域名
3. 配置 DNS 指向 GitHub Pages

**CNAME 文件示例：**
```
wangpan.yourdomain.com
```

## 📚 相关项目

- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

MIT License

## 💡 FAQ

**Q: 文件存储在哪里？**
A: 文件存储在 GitHub Releases，这是 GitHub 官方的文件分发功能。

**Q: 有流量限制吗？**
A: GitHub Pages 有每月 100GB 的带宽限制，但 Releases 下载不受此限制。

**Q: 可以使用私有仓库吗？**
A: 可以，你的 Token 需要有访问该私有仓库的权限。

**Q: 数据会丢失吗？**
A: 文件存储在 GitHub，只要 GitHub 不关闭服务，你的文件就是安全的。

**Q: 可以下载其他人的文件吗？**
A: 只有你有仓库访问权限的 Releases 才能查看和下载。

## 📞 联系方式

- GitHub: https://github.com/openwangpan/wangpan
- Issues: https://github.com/openwangpan/wangpan/issues

---

**享受免费的 GitHub 网盘吧！** 🎉
