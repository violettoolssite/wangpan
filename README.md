# GitHub 网盘

把 GitHub 仓库当网盘用：上传 / 下载 / 删除，单文件最大 2GB，文件存在 GitHub Releases。用户只部署前端（Pages），后端用我的服务器，无需自建。

---

## 用户怎么用

1. **Fork 本仓库**，在 Settings → Pages 里选分支、目录选 **`docs`**，保存。
2. **准备**：去 GitHub 新建一个 [Token](https://github.com/settings/tokens/new?scopes=repo)（勾选 repo）+ 一个空仓库（当网盘）。
3. **打开你的 Pages 地址**，在页面里填 Token、仓库所有者、仓库名、Release 标签（如 `latest`），保存。
4. 拖拽上传、点下载、点删除即可。

说明：别人不能打开「本仓库的 Pages」链接就用（会 403），必须先 Fork 本仓库、部署出自己的 Pages，用自己那个页面才能用。后端由我提供，用户不用自己搭服务器。

**举例：** 小明想用网盘，不能直接打开 `https://openwangpan.github.io/wangpan` 就用（会 403）。小明要先 Fork 本仓库，在 Settings → Pages 里把 `docs` 部署好，得到自己的页面（例如 `https://xiaoming.github.io/wangpan`），在那个页面填自己的 Token 和**网盘仓库**（例如 `xiaoming/my-files`），才能上传、下载。后端还是 `wangpan.cfspider.com`，小明不用搭服务器。

**Pages 和网盘仓库要一样吗？** 不用。Pages 是你 Fork 的本仓库部署出来的「网盘网页」地址；网盘仓库是你在网页里填的、用来存文件的那个仓库（任意一个你的 repo 都行）。可以一个是 `xiaoming.github.io/wangpan`（Pages），一个是 `xiaoming/my-files`（网盘仓库）。

**仓库所有者和部署 Pages 的账号要一样吗？** 不用。部署 Pages 的是你 Fork 用的那个 GitHub 账号；仓库所有者是你在网页里填的、存文件的仓库属于谁。只要你的 Token 能访问那个仓库就行，可以是同一个账号，也可以是你有权限的组织（org）或其他账号。

---

## 自建后端（可选）

只给打算自己跑一套后端的人看。

```bash
git clone https://github.com/openwangpan/wangpan.git && cd wangpan
npm install && cp .env.example .env && npm start
```

改 `docs/js/app.js` 里的 `API_BASE_URL` 为你的后端地址，再把 `docs/` 部署出去即可。

**.env 可选：**

| 变量 | 作用 |
|------|------|
| `BLOCKED_ORIGIN` | 填你本仓库的 Pages 来源（如 `https://用户名.github.io`），来自该地址的请求 403，强制对方 Fork 后自建 Pages |
| `RESTRICT_OWNER` / `RESTRICT_REPO` | 只允许该仓库所有者用该仓库当网盘，其他人 403 |

---

## 常见问题

- **文件存在哪？** GitHub Releases，服务器不落盘，只做中转。
- **为什么慢？** 上传看「你→服务器」和「服务器→GitHub」两段网速；下载默认经服务器代理（`?stream=1`），适合直连 GitHub 慢的情况。
- **Token 安全吗？** 只存在浏览器本地，后端不存。

---

[仓库](https://github.com/openwangpan/wangpan) · [网盘入口](https://wangpan.cfspider.com) · MIT License
