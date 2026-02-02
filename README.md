# GitHub Releases 文件网盘服务

基于 GitHub Releases 的文件存储中转服务，支持大文件上传和下载加速。

## ✨ 特性

- 🚀 支持 2GB 大文件上传
- 🔐 使用 GitHub Personal Access Token 认证
- 💾 文件存储在 GitHub Releases，服务器不保存任何文件
- ⚡ 中转加速上传和下载
- 🔌 提供 RESTful API 和 Web 界面
- 🌍 公共服务，所有用户都可以使用
- 📱 响应式 Web 界面，支持文件拖拽上传

## 🚀 快速开始

### 使用公共服务

访问：https://wangpan.cfspider.com/

1. 准备 GitHub Token：访问 https://github.com/settings/tokens 生成 `repo` 权限的 Token
2. 在 GitHub 创建一个仓库用于存储文件
3. 在网页界面输入 Token 和仓库信息，开始上传文件

### 部署自己的服务

#### 前置要求

- Node.js >= 14.0.0
- npm >= 6.0.0
- GitHub 账号和 Personal Access Token

#### 安装

```bash
# 克隆仓库
git clone https://github.com/openwangpan/wangpan.git
cd wangpan

# 安装依赖
npm install

# 复制配置文件
cp .env.example .env

# 编辑配置文件（可选）
# vim .env
```

#### 配置

创建 `.env` 文件：

```env
PORT=3002
# GITHUB_TOKEN=your_github_token_here (可选)
# ALLOWED_ORIGINS=*
```

#### 启动服务

```bash
# 开发模式
npm start

# 使用 PM2 管理进程（推荐）
pm2 start server.js --name wangpan
pm2 save
pm2 startup
```

## 📖 API 文档

### 1. 上传文件

**请求**
```
POST /api/upload

Headers:
  Authorization: Bearer <your_github_token>

Form Data:
  file: <文件数据>
  owner: <github_username>
  repo: <repository_name>
  tag: <release_tag> (可选，默认 "latest")
```

**响应**
```json
{
  "success": true,
  "downloadUrl": "https://github.com/owner/repo/releases/tag/latest",
  "releaseUrl": "https://github.com/owner/repo/releases/tag/latest",
  "assetId": 123456,
  "size": 1024000,
  "filename": "example.zip"
}
```

### 2. 下载文件

**请求**
```
GET /api/download/:owner/:repo/:tag/:filename

Headers:
  Authorization: Bearer <your_github_token> (可选)
```

**示例**
```bash
# 无 Token（直接下载）
curl -L -O https://wangpan.cfspider.com/api/download/username/repo/latest/file.zip

# 使用 Token
curl -L -H "Authorization: Bearer ghp_xxxx" -O https://wangpan.cfspider.com/api/download/username/repo/latest/file.zip
```

### 3. 列出文件

**请求**
```
GET /api/list/:owner/:repo

Headers:
  Authorization: Bearer <your_github_token>
```

**响应**
```json
{
  "success": true,
  "releases": [
    {
      "tag": "v1.0.0",
      "name": "v1.0.0",
      "createdAt": "2026-02-02T00:00:00.000Z",
      "publishedAt": "2026-02-02T00:00:00.000Z",
      "assets": [
        {
          "id": 123456,
          "name": "app.zip",
          "size": 1024000,
          "downloadCount": 42,
          "downloadUrl": "https://github.com/...",
          "createdAt": "2026-02-02T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

### 4. 健康检查

**请求**
```
GET /api/health
```

**响应**
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T05:00:00.000Z",
  "service": "github-releases-file-storage"
}
```

## 💻 使用示例

### Python 示例

```python
import requests

# 上传文件
url = "https://wangpan.cfspider.com/api/upload"
headers = {"Authorization": "Bearer ghp_your_token"}
files = {"file": open("example.zip", "rb")}
data = {
    "owner": "username",
    "repo": "my-repo",
    "tag": "v1.0.0"
}
response = requests.post(url, headers=headers, files=files, data=data)
print(response.json())
```

### Node.js 示例

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('example.zip'));
form.append('owner', 'username');
form.append('repo', 'my-repo');
form.append('tag', 'v1.0.0');

axios.post('https://wangpan.cfspider.com/api/upload', form, {
  headers: {
    ...form.getHeaders(),
    'Authorization': 'Bearer ghp_your_token'
  }
}).then(response => console.log(response.data));
```

### cURL 示例

```bash
curl -X POST https://wangpan.cfspider.com/api/upload \
  -H "Authorization: Bearer ghp_your_token" \
  -F "file=@example.zip" \
  -F "owner=username" \
  -F "repo=my-repo" \
  -F "tag=v1.0.0"
```

## 🔧 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3002 |
| GITHUB_TOKEN | 默认 GitHub Token（可选） | - |
| ALLOWED_ORIGINS | 允许的 CORS 来源 | * |

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name wangpan.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wangpan.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 2G;
    client_body_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_buffering off;
    }
}
```

## 📝 使用说明

### 1. 创建 GitHub 仓库

在 GitHub 创建一个新仓库（public 或 private 都可以）用于存储文件。

### 2. 生成 GitHub Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 选择 `repo` 权限
4. 复制生成的 Token

### 3. 使用服务

**Web 界面：**
1. 访问 wangpan.cfspider.com
2. 输入 GitHub Token 和仓库信息
3. 拖拽文件上传

**API 调用：**
按照上述 API 文档进行调用

## 🔒 安全说明

- 服务器不存储任何文件或 Token
- Token 仅用于与 GitHub API 通信
- 支持 GitHub 私有仓库
- 建议使用 HTTPS 传输

## 📄 开源协议

MIT License

## 🙏 致谢

- 基于 GitHub Releases API
- 使用 Express.js 框架
- 图标来自 Material Design

## 📞 联系方式

- 服务地址：https://wangpan.cfspider.com
- GitHub：https://github.com/openwangpan/wangpan

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📌 注意事项

1. 单个文件最大支持 2GB
2. GitHub 仓库有大小限制（通常 1GB）
3. Token 需要有 `repo` 权限
4. 文件实际存储在 GitHub Releases
5. 服务器仅做中转，不保存任何数据
