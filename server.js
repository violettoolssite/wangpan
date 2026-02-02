// GitHub Releases 文件网盘中转服务
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// CORS配置 - 允许所有来源（公共服务）；暴露 Location 以便前端读取 302 重定向地址
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
    exposedHeaders: ['Location'],
    credentials: false
}));

app.use(express.json());

// 内存存储multer配置 - 不保存到磁盘
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024 // 2GB限制
    }
});

// 错误处理中间件
const handleError = (res, error, statusCode = 500) => {
    console.error('Error:', error);
    res.status(statusCode).json({
        success: false,
        error: error.message || 'Internal server error'
    });
};

// 验证GitHub Token中间件
const validateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Missing or invalid Authorization header. Expected: Bearer <token>'
        });
    }
    req.token = authHeader.substring(7);
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

// 上传文件到GitHub Releases
app.post('/api/upload', validateToken, upload.single('file'), async (req, res) => {
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
app.get('/api/delete-asset', validateToken, async (req, res) => {
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

// 下载文件
app.get('/api/download/:owner/:repo/:tag/:filename', async (req, res) => {
    try {
        const { owner, repo, tag, filename } = req.params;
        const token = req.headers.authorization?.substring(7);

        // 如果没有token，直接重定向到GitHub
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

        // 重定向到下载地址
        res.redirect(asset.browser_download_url);

    } catch (error) {
        if (error.status === 404) {
            return handleError(res, new Error('Release or file not found'), 404);
        }
        handleError(res, error);
    }
});

// 列出所有releases
app.get('/api/list/:owner/:repo', validateToken, async (req, res) => {
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
            upload: 'POST /api/upload',
            deleteAsset: 'GET /api/delete-asset?owner=&repo=&assetId=',
            download: 'GET /api/download/:owner/:repo/:tag/:filename',
            list: 'GET /api/list/:owner/:repo',
            health: 'GET /api/health'
        },
        usage: {
            note: '所有用户可以使用此公共服务',
            requirements: [
                '需要GitHub Personal Access Token',
                '需要GitHub仓库用于存储文件',
                'Token需要在Authorization头中提供'
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
