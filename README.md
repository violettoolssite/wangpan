# GitHub 网盘

把 GitHub 仓库当网盘用：上传 / 下载 / 删除，单文件最大 2GB，文件存在 GitHub Releases。**用户无需自建服务器**：只部署前端（GitHub Pages），后端用公共服务；用 GitHub 登录后配置存你的 Gist，换设备登录即同步。

---

## 用户怎么用（推荐：GitHub 登录）

1. **Fork 本仓库**，在 Settings → Pages 里选分支、目录选 **`docs`**，保存。
2. **打开你的 Pages 地址**，点击 **「用 GitHub 登录」**，授权后自动拉取/保存配置。
3. 首次使用在「配置」里填**网盘仓库**（所有者、仓库名、Release 标签如 `latest`），点 **「保存配置到账号」**，之后换设备只需登录即可用。
4. 拖拽上传、点下载、点删除即可。

**无需服务器、无需自己填 Token**：登录用 GitHub OAuth，配置存在你自己的 GitHub Gist，后端不存你的数据。

---

## 不用登录的用法（本地 Token）

若不想用 GitHub 登录，也可以在本机填 Token 和仓库信息（仅存浏览器本地，换设备需重填）：

1. Fork 并部署 Pages 同上。
2. 去 GitHub 新建 [Token](https://github.com/settings/tokens/new?scopes=repo)（勾选 repo）+ 一个空仓库当网盘。
3. 打开你的 Pages，在「配置」里填 Token、仓库所有者、仓库名、Release 标签，保存后即可上传/下载。

说明：直接打开「本仓库的 Pages」链接会 403，须 Fork 后部署自己的 Pages 才能用。后端由我提供，用户不用搭服务器。

**举例：** 小明 Fork 本仓库并部署 `docs` 到 Pages，得到 `https://xiaoming.github.io/wangpan`。小明点「用 GitHub 登录」→ 填网盘仓库（如 `xiaoming/my-files`）→「保存配置到账号」。换手机/电脑时，打开同一页面再登录一次即可，无需导配置。

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

- **用户需要自己的服务器吗？** 不需要。Fork 后把 `docs` 部署到 GitHub Pages 即可，后端用公共服务（wangpan.cfspider.com），用 GitHub 登录、配置存你的 Gist，换设备登录即同步。
- **文件存在哪？** GitHub Releases，服务器不落盘，只做中转。
- **为什么慢？** 上传看「你→服务器」和「服务器→GitHub」两段网速；下载默认经服务器代理（`?stream=1`），适合直连 GitHub 慢的情况。
- **Token 安全吗？** 用 GitHub 登录时 Token 只在会话内存里，后端不落盘；本地填 Token 时只存浏览器，后端不存。

---

[仓库](https://github.com/openwangpan/wangpan) · [网盘入口](https://wangpan.cfspider.com) · MIT License
