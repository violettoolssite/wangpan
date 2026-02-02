# GitHub Releases 文件网盘服务

基于 GitHub Releases 的文件存储中转服务：前端（`docs/`）部署到 GitHub Pages，后端自建或使用公共服务。**直接 Fork 或使用本仓库即可当网盘使用。**

## 数据存储说明

- **文件不会保存在你的服务器上。** 上传时：用户 → 你的服务器（仅内存中转）→ GitHub Releases。服务器使用内存临时接收文件并立即转发到 GitHub，不落盘、不持久化。
- **上传速度取决于：** (1) 用户到服务器的上行带宽；(2) 服务器到 GitHub 的上行带宽。两端任一较慢都会成为瓶颈。
- **下载：** 支持 302 重定向到 GitHub，或经服务器流式代理（`?stream=1`），适合直连 GitHub 慢时使用。

## 直接当网盘使用

1. Fork 或克隆本仓库，将 **`docs/`** 部署到 GitHub Pages（Settings → Pages → 选择分支与 `docs` 目录）。
2. 在 GitHub 创建 Personal Access Token（需 `repo` 权限）：https://github.com/settings/tokens/new?scopes=repo
3. 新建一个 GitHub 仓库，专门用于存放网盘文件（对应 Releases）。
4. 打开你的 GitHub Pages 页面，在网页中填写 Token、仓库 owner、仓库名、Release 标签（如 `latest`），保存后即可上传、下载、删除文件。

前端默认请求公共服务 `https://wangpan.cfspider.com`；若需大文件或希望统一经过自己的域名，可自建后端并修改 `docs/js/app.js` 中的 `API_BASE_URL`。

**Fork 后能否正常用？** 可以。Fork 后把 `docs/` 部署到你自己仓库的 GitHub Pages，在页面里填写**你自己的** Token 和**你自己的**仓库（不要填本仓库的 owner/repo），即可正常使用；公共服务会接受非受保护仓库的请求。

## 部署后端服务

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

详细配置见 `server.js` 内注释。前端 `docs/js/app.js` 中的 `API_BASE_URL` 指向你的后端地址即可。

## 受保护仓库（仅仓库所有者可用）

若你提供公共服务，可设置「受保护仓库」：**只有该仓库的所有者能用该仓库做网盘，其他用户会得到 403，需 Fork 本项目后使用自己的仓库。**

在 `.env` 中设置：

- `RESTRICT_OWNER`：受保护仓库的 GitHub 用户名（如 `openwangpan`）
- `RESTRICT_REPO`：受保护仓库名（如 `wangpan`）

设置后，只有该用户的 Token 才能对该 `owner/repo` 做上传、列表、删除、下载；其他人用别的 Token 访问该仓库会收到 403。未在受保护列表中的其他仓库不受影响。

## 特性

- 大文件上传：单文件最大 2GB（GitHub Releases 限制）
- Token 认证，支持私有仓库
- 文件实际存储在 GitHub Releases，不占服务器磁盘
- 下载可经服务器代理（`?stream=1`），改善直连 GitHub 慢时的速度

## 安全性

- Token 仅保存在浏览器本地
- 服务器不持久化文件与 Token，仅做中转

## 开源协议

MIT License

## 联系方式

- GitHub: https://github.com/openwangpan/wangpan
- 在线服务: https://wangpan.cfspider.com/
