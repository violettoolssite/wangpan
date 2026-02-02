# GitHub Releases 文件网盘服务

基于 GitHub Releases 的文件存储中转服务。**直接 Fork 或使用本仓库即可当网盘使用**：前端部署到 GitHub Pages，后端可选自建或使用公共服务。

## 数据存储说明

- **文件不会保存在你的服务器上。** 上传时：用户 → 你的服务器（仅内存中转）→ GitHub Releases。服务器使用内存临时接收文件并立即转发到 GitHub，不落盘、不持久化。
- **上传速度取决于：** (1) 用户到服务器的上行带宽；(2) 服务器到 GitHub 的上行带宽。两端任一较慢都会成为瓶颈。
- **下载可通过服务器：** 已提供 `/api/download/:owner/:repo/:tag/:filename` 接口，请求会经服务器重定向到 GitHub 的下载地址；若需下载流量完全经服务器代理，可在后端自行扩展代理逻辑。

## 版本说明

### 1. 纯前端版本（GitHub Pages）

- 纯前端应用，完全在浏览器中运行
- 无需自建服务器，直接调用 GitHub API
- 部署在 GitHub Pages 即可使用

**部署访问**: 本仓库的 GitHub Pages  
**配置位置**: `docs/` 目录

### 2. 后端服务版本

- 支持最大 2GB 单文件上传（GitHub Releases 限制）
- 提供 RESTful API，供前端或其它客户端调用
- 可作为中转服务，解决跨域与大文件上传限制

**在线地址**: https://wangpan.cfspider.com/

## 直接当网盘使用

1. Fork 或克隆本仓库，将 `docs/` 部署到 GitHub Pages（Settings → Pages → 选择分支与 `docs` 目录）。
2. 在 GitHub 创建 Personal Access Token（需 `repo` 权限）：https://github.com/settings/tokens/new?scopes=repo
3. 新建一个 GitHub 仓库，专门用于存放网盘文件（对应 Releases）。
4. 打开你的 GitHub Pages 页面，在网页中填写 Token、仓库 owner、仓库名、Release 标签（如 `latest`），保存后即可上传、下载、删除文件。

无需改代码即可当网盘使用；若需大文件（>100MB）或希望统一经过自己的域名，可自建后端并让前端指向你的 API 地址。

## 使用 GitHub Pages 版本

1. 访问本仓库的 GitHub Pages（Settings → Pages 中查看地址）
2. 按上文准备 Token 和仓库
3. 在页面中填写 Token、仓库所有者、仓库名、Release 标签
4. 上传、下载、删除文件

更多说明见 [GITHUB_PAGES_README.md](GITHUB_PAGES_README.md)。

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

详细配置见 `server.js` 内注释。

## 受保护仓库（仅仓库所有者可用）

若你提供公共服务（如 wangpan.cfspider.com），可设置「受保护仓库」：**只有该仓库的所有者能用该仓库做网盘，其他用户会得到 403，需 Fork 本项目后使用自己的仓库**。

在 `.env` 中设置：

- `RESTRICT_OWNER`：受保护仓库的 GitHub 用户名（如 `openwangpan`）
- `RESTRICT_REPO`：受保护仓库名（如 `wangpan`）

设置后，只有该用户的 Token 才能对该 `owner/repo` 做上传、列表、删除、下载；其他人用别的 Token 访问该仓库会收到 403 和提示「此仓库仅限仓库所有者使用。其他用户请 Fork 本项目后使用自己的仓库。」未在受保护列表中的其他仓库不受影响，任何人只要有自己的 Token 和仓库即可使用。

## 特性

- 大文件上传：后端版最大 2GB，前端直连 GitHub 受 100MB 左右限制
- Token 认证，支持私有仓库
- 文件实际存储在 GitHub Releases，不占服务器磁盘
- 下载可通过 `/api/download` 经服务器重定向到 GitHub

## 安全性

- 前端版：Token 仅保存在浏览器本地
- 后端版：服务器不持久化文件与 Token，仅做中转

## 开源协议

MIT License

## 致谢

- GitHub Releases API
- Express.js（后端）
- 纯 JavaScript 实现（前端）

## 联系方式

- GitHub: https://github.com/openwangpan/wangpan
- 在线服务: https://wangpan.cfspider.com/
