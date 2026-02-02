// GitHub Releases 文件网盘中转服务
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const https = require('https');
const { Octokit } = require('@octokit/rest');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// CORS：支持带 Cookie 的请求（登录态）；暴露 Location
app.use(cors({
    origin: true, // 反射请求的 origin，便于同源/指定源带 cookie
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
    exposedHeaders: ['Location'],
    credentials: true
}));

app.use(express.json());

// Session：仅内存，不落盘；OAuth 登录后存 accessToken
const SESSION_SECRET = (process.env.SESSION_SECRET || 'wangpan-session-secret-change-in-production').trim();
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'wangpan.sid',
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 天
    }
}));

// 请求日志：每个请求记录 method path IP，响应完成后记录 status 与耗时
app.use((req, res, next) => {
    const start = Date.now();
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${ms}ms ${ip}`);
    });
    next();
});

// 内存存储multer配置 - 不保存到磁盘
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024 // 2GB限制
    }
});

// 错误处理中间件
const handleError = (res, error, statusCode = 500) => {
    const msg = error.message || 'Internal server error';
    console.error(`[${new Date().toISOString()}] ERROR ${statusCode} ${msg}`, error.stack || '');
    res.status(statusCode).json({
        success: false,
        error: msg
    });
};

// 解析 Token：优先 Authorization Bearer，否则使用 Session 中的 OAuth token（登录态）
const resolveToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        req.token = authHeader.substring(7);
        return next();
    }
    if (req.session && req.session.accessToken) {
        req.token = req.session.accessToken;
        return next();
    }
    req.token = null;
    next();
};

// 要求必须已有 token（Bearer 或 Session）
const validateToken = (req, res, next) => {
    if (!req.token) {
        return res.status(401).json({
            success: false,
            error: '未登录或缺少 Token。请使用 GitHub 登录，或在请求头提供 Authorization: Bearer <token>'
        });
    }
    next();
};

// 创建Octokit客户端
const createOctokit = (token) => {
    return new Octokit({
        auth: token,
        userAgent: 'github-releases-file-storage/1.0.0'
    });
};

// 受保护仓库：仅允许仓库所有者使用，其他用户需 Fork 后使用自己的仓库
const RESTRICT_OWNER = (process.env.RESTRICT_OWNER || '').trim();
const RESTRICT_REPO = (process.env.RESTRICT_REPO || '').trim();
const tokenLoginCache = new Map(); // token 前几位 -> { login, expires }
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getTokenLogin(token) {
    const key = token ? token.slice(0, 12) : '';
    const cached = tokenLoginCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.login;
    const octokit = createOctokit(token);
    const { data } = await octokit.rest.users.getAuthenticated();
    const login = (data && data.login) || '';
    tokenLoginCache.set(key, { login, expires: Date.now() + CACHE_TTL_MS });
    return login;
}

// 禁止直接使用“公共 Pages”访问 API；若请求来自 BLOCKED_ORIGIN 且 Token 不是 RESTRICT_OWNER，则 403
const BLOCKED_ORIGIN = (process.env.BLOCKED_ORIGIN || '').trim().replace(/\/$/, '');
app.use(async (req, res, next) => {
    if (!BLOCKED_ORIGIN || !req.path.startsWith('/api/')) return next();
    const origin = (req.headers.origin || '').trim();
    const referer = (req.headers.referer || '').trim();
    const fromBlocked = (origin && origin === BLOCKED_ORIGIN) || (referer && referer.startsWith(BLOCKED_ORIGIN));
    if (!fromBlocked) return next();
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || (req.query && req.query.token && String(req.query.token).trim());
    if (!token) {
        return res.status(403).json({
            success: false,
            error: '请自行 Fork 本项目并部署到自己的 GitHub Pages 后使用，不可直接使用本仓库的 Pages 地址。'
        });
    }
    try {
        const login = await getTokenLogin(token);
        if (RESTRICT_OWNER && login === RESTRICT_OWNER) return next();
    } catch (e) { /* 忽略 token 无效等 */ }
    return res.status(403).json({
        success: false,
        error: '请自行 Fork 本项目并部署到自己的 GitHub Pages 后使用，不可直接使用本仓库的 Pages 地址。'
    });
});

async function checkRestrictedRepo(owner, repo, token) {
    if (!RESTRICT_OWNER || !RESTRICT_REPO) return { forbidden: false };
    if (owner !== RESTRICT_OWNER || repo !== RESTRICT_REPO) return { forbidden: false };
    const login = await getTokenLogin(token);
    if (login === RESTRICT_OWNER) return { forbidden: false };
    return {
        forbidden: true,
        message: '此仓库仅限仓库所有者使用。其他用户请 Fork 本项目后使用自己的仓库。'
    };
}

// ---------- OAuth 与用户配置（数据不落服务器：Session 仅内存，配置存用户 Gist） ----------
const GITHUB_CLIENT_ID = (process.env.GITHUB_OAUTH_CLIENT_ID || '').trim();
const GITHUB_CLIENT_SECRET = (process.env.GITHUB_OAUTH_CLIENT_SECRET || '').trim();
const OAUTH_CALLBACK_URL = (process.env.OAUTH_CALLBACK_URL || '').trim();
const OAUTH_FRONTEND_REDIRECT = (process.env.OAUTH_FRONTEND_REDIRECT || '/').trim();
const GIST_CONFIG_FILENAME = 'wangpan-config.json';
const GIST_DESCRIPTION = 'wangpan';

function requireSession(req, res, next) {
    if (!req.session || !req.session.accessToken) {
        return res.status(401).json({ success: false, error: '请先使用 GitHub 登录' });
    }
    next();
}

// GET /api/auth/github — 重定向到 GitHub OAuth 授权
app.get('/api/auth/github', (req, res) => {
    if (!GITHUB_CLIENT_ID || !OAUTH_CALLBACK_URL) {
        return res.status(503).json({
            success: false,
            error: '未配置 GitHub OAuth（GITHUB_OAUTH_CLIENT_ID / OAUTH_CALLBACK_URL）'
        });
    }
    const scope = 'repo gist';
    const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(OAUTH_CALLBACK_URL)}&scope=${encodeURIComponent(scope)}`;
    res.redirect(url);
});

// GET /api/auth/github/callback — 用 code 换 token，写 Session，重定向回前端
app.get('/api/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    if (!code || !GITHUB_CLIENT_SECRET) {
        return res.redirect(OAUTH_FRONTEND_REDIRECT + '?login=error');
    }
    try {
        const { data: tokenData } = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: OAUTH_CALLBACK_URL
            },
            { headers: { Accept: 'application/json' } }
        );
        const accessToken = tokenData && tokenData.access_token;
        if (!accessToken) {
            return res.redirect(OAUTH_FRONTEND_REDIRECT + '?login=error');
        }
        const octokit = createOctokit(accessToken);
        const { data: user } = await octokit.rest.users.getAuthenticated();
        req.session.accessToken = accessToken;
        req.session.userLogin = user.login;
        req.session.userId = user.id;
        return res.redirect(OAUTH_FRONTEND_REDIRECT + '?logged_in=1');
    } catch (e) {
        console.error('[oauth callback]', e.message || e);
        return res.redirect(OAUTH_FRONTEND_REDIRECT + '?login=error');
    }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// GET /api/me — 当前登录用户（不含 token）
app.get('/api/me', (req, res) => {
    if (!req.session || !req.session.accessToken) {
        return res.status(401).json({ success: false, error: '未登录' });
    }
    res.json({
        success: true,
        login: req.session.userLogin,
        id: req.session.userId
    });
});

// 从用户 Gist 读取网盘配置（约定 description 或文件名）
async function getConfigFromGist(octokit) {
    const { data: gists } = await octokit.rest.gists.list();
    const gist = gists.find(g => g.description === GIST_DESCRIPTION || (g.files && g.files[GIST_CONFIG_FILENAME]));
    if (!gist || !gist.files || !gist.files[GIST_CONFIG_FILENAME]) return null;
    const raw = gist.files[GIST_CONFIG_FILENAME].content;
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

// GET /api/user/config — 从 Gist 拉取配置（不落服务器）
app.get('/api/user/config', requireSession, async (req, res) => {
    try {
        const octokit = createOctokit(req.session.accessToken);
        const config = await getConfigFromGist(octokit);
        res.json({
            success: true,
            config: config || { owner: '', repo: '', tag: 'latest' }
        });
    } catch (e) {
        handleError(res, e);
    }
});

// PUT /api/user/config — 保存配置到用户 Gist（不落服务器）
app.put('/api/user/config', requireSession, async (req, res) => {
    try {
        const { owner, repo, tag } = req.body || {};
        const payload = {
            owner: String(owner || '').trim(),
            repo: String(repo || '').trim(),
            tag: String(tag || 'latest').trim() || 'latest'
        };
        const octokit = createOctokit(req.session.accessToken);
        const content = JSON.stringify(payload, null, 2);
        const { data: gists } = await octokit.rest.gists.list();
        const existing = gists.find(g => g.description === GIST_DESCRIPTION || (g.files && g.files[GIST_CONFIG_FILENAME]));

        if (existing) {
            await octokit.rest.gists.update({
                gist_id: existing.id,
                files: { [GIST_CONFIG_FILENAME]: { content } }
            });
        } else {
            await octokit.rest.gists.create({
                description: GIST_DESCRIPTION,
                public: false,
                files: { [GIST_CONFIG_FILENAME]: { content } }
            });
        }
        res.json({ success: true, config: payload });
    } catch (e) {
        handleError(res, e);
    }
});

// ---------- 上传/列表/删除：支持 Bearer 或 Session Token ----------

// 上传文件到GitHub Releases
app.post('/api/upload', resolveToken, validateToken, upload.single('file'), async (req, res) => {
    try {
        const body = req.body || {};
        const owner = body.owner;
        const repo = body.repo;
        let tag = body.tag;
        if (!tag || String(tag).trim() === '' || String(tag) === 'undefined') tag = 'latest';
        const file = req.file;
        const token = req.token;

        if (!file) {
            return handleError(res, new Error('No file provided'), 400);
        }

        if (!owner || !repo) {
            return handleError(res, new Error('Missing owner or repo'), 400);
        }

        const restricted = await checkRestrictedRepo(owner, repo, token);
        if (restricted.forbidden) {
            return handleError(res, new Error(restricted.message), 403);
        }

        const octokit = createOctokit(token);

        // 检查release是否存在
        let release;
        try {
            const { data: existingRelease } = await octokit.rest.repos.getReleaseByTag({
                owner,
                repo,
                tag
            });
            release = existingRelease;
        } catch (error) {
            if (error.status === 404) {
                // 创建新release
                const { data: newRelease } = await octokit.rest.repos.createRelease({
                    owner,
                    repo,
                    tag_name: tag,
                    name: tag,
                    body: 'Created by file storage service'
                });
                release = newRelease;
            } else {
                throw error;
            }
        }

        // 上传文件到release
        const { data: asset } = await octokit.rest.repos.uploadReleaseAsset({
            owner,
            repo,
            release_id: release.id,
            name: file.originalname,
            data: file.buffer,
            headers: {
                'content-type': file.mimetype || 'application/octet-stream',
                'content-length': file.size
            }
        });

        res.json({
            success: true,
            downloadUrl: asset.browser_download_url,
            releaseUrl: release.html_url,
            assetId: asset.id,
            size: file.size,
            filename: file.originalname
        });

    } catch (error) {
        // 透传 GitHub API 状态码和错误信息，便于前端显示
        const statusCode = error.status || error.response?.status || 500;
        const message = (error.response?.data?.message) || error.message || 'Internal server error';
        console.error('[upload]', statusCode, message, error.response?.data || '');
        handleError(res, new Error(message), statusCode);
    }
});

// 删除资产
app.get('/api/delete-asset', resolveToken, validateToken, async (req, res) => {
    try {
        const { owner, repo, assetId } = req.query;
        const token = req.token;

        if (!owner || !repo || !assetId) {
            return handleError(res, new Error('Missing required parameters: owner, repo, assetId'), 400);
        }

        const restricted = await checkRestrictedRepo(owner, repo, token);
        if (restricted.forbidden) {
            return handleError(res, new Error(restricted.message), 403);
        }

        const octokit = createOctokit(token);

        // 删除资产
        await octokit.rest.repos.deleteReleaseAsset({
            owner,
            repo,
            asset_id: parseInt(assetId)
        });

        res.json({
            success: true,
            message: 'Asset deleted successfully'
        });

    } catch (error) {
        handleError(res, error);
    }
});

// 下载文件（支持 Authorization 头或 query 参数 token，便于前端直接打开链接避免 CORS）
app.get('/api/download/:owner/:repo/:tag/:filename', async (req, res) => {
    try {
        const { owner, repo, tag, filename } = req.params;
        let token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
        if (!token && req.query.token) token = String(req.query.token).trim();

        // 如果没有token，直接重定向到GitHub（公开仓库可用）
        if (!token) {
            const downloadUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${filename}`;
            return res.redirect(downloadUrl);
        }

        const restricted = await checkRestrictedRepo(owner, repo, token);
        if (restricted.forbidden) {
            return handleError(res, new Error(restricted.message), 403);
        }

        const octokit = createOctokit(token);

        // 获取release
        const { data: release } = await octokit.rest.repos.getReleaseByTag({
            owner,
            repo,
            tag
        });

        // 查找文件
        const asset = release.assets.find(a => a.name === filename);
        if (!asset) {
            return handleError(res, new Error('File not found'), 404);
        }

        // 可选：经服务器流式代理下载（?stream=1），适合直连 GitHub 慢时使用
        if (req.query.stream === '1' || req.query.stream === 'true') {
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.id}`;
            const headers = {
                'Accept': 'application/octet-stream',
                'Authorization': 'Bearer ' + token,
                'User-Agent': 'github-releases-file-storage/1.0.0'
            };
            const followRedirect = (url, cb) => {
                https.get(url, { headers }, (ghRes) => {
                    if (ghRes.statusCode === 302 || ghRes.statusCode === 301) {
                        const loc = ghRes.headers.location;
                        if (loc) return followRedirect(loc, cb);
                    }
                    cb(null, ghRes);
                }).on('error', (e) => cb(e));
            };
            followRedirect(apiUrl, (err, ghRes) => {
                if (err) return handleError(res, err);
                if (!ghRes || ghRes.statusCode !== 200) {
                    return handleError(res, new Error('GitHub 返回异常 ' + (ghRes && ghRes.statusCode)), ghRes && ghRes.statusCode);
                }
                res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(filename));
                if (ghRes.headers['content-length']) res.setHeader('Content-Length', ghRes.headers['content-length']);
                ghRes.pipe(res);
            });
            return;
        }

        // 默认：重定向到下载地址
        res.redirect(asset.browser_download_url);

    } catch (error) {
        if (error.status === 404) {
            return handleError(res, new Error('Release or file not found'), 404);
        }
        handleError(res, error);
    }
});

// 列出所有releases
app.get('/api/list/:owner/:repo', resolveToken, validateToken, async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const token = req.token;

        const restricted = await checkRestrictedRepo(owner, repo, token);
        if (restricted.forbidden) {
            return handleError(res, new Error(restricted.message), 403);
        }

        const octokit = createOctokit(token);

        const { data: releases } = await octokit.rest.repos.listReleases({
            owner,
            repo
        });

        const formattedReleases = releases.map(release => ({
            tag: release.tag_name,
            name: release.name,
            createdAt: release.created_at,
            publishedAt: release.published_at,
            assets: release.assets.map(asset => ({
                id: asset.id,
                name: asset.name,
                size: asset.size,
                downloadCount: asset.download_count,
                downloadUrl: asset.browser_download_url,
                createdAt: asset.created_at
            }))
        }));

        res.json({
            success: true,
            releases: formattedReleases
        });

    } catch (error) {
        handleError(res, error);
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'github-releases-file-storage'
    });
});

// 根路由
app.get('/', (req, res) => {
    res.json({
        message: 'GitHub Releases 文件网盘中转服务',
        endpoints: {
            auth: {
                login: 'GET /api/auth/github',
                logout: 'POST /api/auth/logout',
                me: 'GET /api/me',
                userConfig: 'GET /api/user/config',
                saveUserConfig: 'PUT /api/user/config'
            },
            upload: 'POST /api/upload',
            deleteAsset: 'GET /api/delete-asset?owner=&repo=&assetId=',
            download: 'GET /api/download/:owner/:repo/:tag/:filename',
            list: 'GET /api/list/:owner/:repo',
            health: 'GET /api/health'
        },
        usage: {
            note: '支持 GitHub 登录（配置存 Gist，数据不落服务器）或 Bearer Token',
            requirements: [
                '登录：GET /api/auth/github，或请求头 Authorization: Bearer <token>',
                '配置：GET/PUT /api/user/config（登录后）'
            ]
        }
    });
});

// 启动服务器
app.listen(PORT, '127.0.0.1', () => {
    console.log(`[${new Date().toISOString()}] GitHub Releases 文件网盘中转服务启动成功`);
    console.log(`监听地址: http://127.0.0.1:${PORT}`);
    console.log(`公共服务: 所有用户都可以使用此服务`);
});

module.exports = app;
