// GitHub 网盘 - 支持 GitHub 登录 + Gist 配置同步（换设备只需登录）

function getApiBaseUrl() {
    if (typeof window === 'undefined') return '';
    if (window.WANGPAN_API_BASE) return String(window.WANGPAN_API_BASE).replace(/\/$/, '');
    // 前端在 GitHub Pages 时使用公共后端，避免 /api 指向 github.io 导致 404
    if (window.location.hostname === 'openwangpan.github.io' || window.location.hostname.endsWith('.github.io')) {
        return 'https://wangpan.cfspider.com';
    }
    return window.location.origin;
}
const API_BASE_URL = getApiBaseUrl();

let isLoggedIn = false;

// 获取配置：已登录时从表单取值（Token 由 Session 提供）；未登录时从 localStorage 取
function getConfig() {
    const owner = document.getElementById('repoOwner')?.value?.trim() || localStorage.getItem('repoOwner') || '';
    const repo = document.getElementById('repoName')?.value?.trim() || localStorage.getItem('repoName') || '';
    const tag = document.getElementById('releaseTag')?.value?.trim() || localStorage.getItem('releaseTag') || 'latest';
    const token = isLoggedIn ? '' : (localStorage.getItem('githubToken') || '');
    return { token, owner, repo, tag };
}

// 带凭证的 fetch 选项（登录态用 Cookie，未登录用 Bearer Token）
function apiOptions() {
    const opts = { credentials: 'include' };
    if (!isLoggedIn) {
        const token = localStorage.getItem('githubToken') || '';
        if (token) opts.headers = { ...(opts.headers || {}), 'Authorization': 'Bearer ' + token };
    }
    return opts;
}

// 检查登录态并更新 UI
async function checkAuth() {
    try {
        const res = await fetch(API_BASE_URL + '/api/me', apiOptions());
        if (res.ok) {
            const data = await res.json();
            setLoggedIn(data.login, data.id);
            await fetchConfigFromAccount();
            return true;
        }
    } catch (e) {
        console.warn('checkAuth', e);
    }
    setLoggedOut();
    return false;
}

function setLoggedIn(login, id) {
    isLoggedIn = true;
    document.getElementById('loginLink').style.display = 'none';
    const info = document.getElementById('loggedInInfo');
    if (info) {
        info.style.display = 'inline-flex';
        const el = document.getElementById('userLogin');
        if (el) el.textContent = login || '';
    }
    const tokenRow = document.getElementById('localTokenRow');
    if (tokenRow) tokenRow.style.display = 'none';
}

function setLoggedOut() {
    isLoggedIn = false;
    document.getElementById('loginLink').style.display = '';
    const info = document.getElementById('loggedInInfo');
    if (info) info.style.display = 'none';
    const tokenRow = document.getElementById('localTokenRow');
    if (tokenRow) tokenRow.style.display = 'block';
}

// 从账号（Gist）拉取配置并填入表单
async function fetchConfigFromAccount() {
    try {
        const res = await fetch(API_BASE_URL + '/api/user/config', apiOptions());
        if (!res.ok) return;
        const data = await res.json();
        const c = data.config || {};
        const ownerEl = document.getElementById('repoOwner');
        const repoEl = document.getElementById('repoName');
        const tagEl = document.getElementById('releaseTag');
        if (ownerEl) ownerEl.value = c.owner || '';
        if (repoEl) repoEl.value = c.repo || '';
        if (tagEl) tagEl.value = c.tag || 'latest';
        if (c.owner && c.repo) loadFiles();
    } catch (e) {
        console.warn('fetchConfigFromAccount', e);
    }
}

// 保存当前表单配置到账号（Gist）
async function saveConfigToAccount() {
    const owner = document.getElementById('repoOwner')?.value?.trim() || '';
    const repo = document.getElementById('repoName')?.value?.trim() || '';
    const tag = document.getElementById('releaseTag')?.value?.trim() || 'latest';
    if (!owner || !repo) {
        showStatus('请填写仓库所有者与仓库名', 'error');
        return;
    }
    showStatus('保存中...', 'info');
    try {
        const res = await fetch(API_BASE_URL + '/api/user/config', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner, repo, tag })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || '保存失败');
        }
        showStatus('配置已保存到账号，换设备登录即可使用', 'success');
    } catch (e) {
        showStatus('保存失败：' + (e.message || e), 'error');
    }
}

// 登出
async function logout() {
    try {
        await fetch(API_BASE_URL + '/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    setLoggedOut();
    loadConfig();
    document.getElementById('filesList').innerHTML = '<p class="empty-state">请用 GitHub 登录或配置本地信息</p>';
    showStatus('已登出', 'success');
}

// 保存配置（本地模式：写入 localStorage，并验证）
function saveConfig() {
    const token = document.getElementById('githubToken')?.value?.trim() || '';
    const owner = document.getElementById('repoOwner')?.value?.trim() || '';
    const repo = document.getElementById('repoName')?.value?.trim() || '';
    const tag = document.getElementById('releaseTag')?.value?.trim() || 'latest';

    if (!owner || !repo) {
        showStatus('请填写仓库所有者与仓库名', 'error');
        return;
    }
    if (!isLoggedIn && !token) {
        showStatus('未登录时请填写 GitHub Token', 'error');
        return;
    }

    localStorage.setItem('repoOwner', owner);
    localStorage.setItem('repoName', repo);
    localStorage.setItem('releaseTag', tag);
    if (!isLoggedIn) localStorage.setItem('githubToken', token);

    showStatus('配置已保存，正在验证...', 'success');
    verifyConfig(isLoggedIn ? null : token, owner, repo);
}

// 验证配置（登录态不直接调 GitHub，直接拉列表）
async function verifyConfig(token, owner, repo) {
    if (isLoggedIn) {
        showStatus('连接成功！', 'success');
        loadFiles();
        return;
    }
    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('仓库未找到，请检查仓库所有者和仓库名是否正确');
            } else if (response.status === 403) {
                throw new Error('Token 权限不足，请确保 Token 有 repo 权限');
            } else if (response.status === 401) {
                throw new Error('Token 无效，请重新生成');
            } else {
                throw new Error(`验证失败 (${response.status})`);
            }
        }

        showStatus('连接成功！', 'success');
        loadFiles();
    } catch (error) {
        showStatus('配置验证失败：' + error.message, 'error');
    }
}

// 加载配置
function loadConfig() {
    const config = getConfig();
    const tokenInput = document.getElementById('githubToken');
    const ownerInput = document.getElementById('repoOwner');
    const repoInput = document.getElementById('repoName');
    const tagInput = document.getElementById('releaseTag');

    if (tokenInput) tokenInput.value = config.token;
    if (ownerInput) ownerInput.value = config.owner;
    if (repoInput) repoInput.value = config.repo;
    if (tagInput) tagInput.value = config.tag;
}

// 显示状态消息
function showStatus(message, type) {
    const statusEl = document.getElementById('statusText');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = type;
    setTimeout(() => { 
        statusEl.textContent = ''; 
        statusEl.className = '';
    }, 8000);
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 加载文件列表
async function loadFiles() {
    const config = getConfig();
    if (!config.owner || !config.repo) {
        showStatus('请先配置仓库信息或登录', 'error');
        return;
    }
    if (!isLoggedIn && !config.token) {
        showStatus('请用 GitHub 登录或填写 Token', 'error');
        return;
    }

    showStatus('加载中...', 'info');
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/list/${config.owner}/${config.repo}`,
            apiOptions()
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 403) {
                throw new Error('权限不足，请检查 Token 权限');
            } else if (response.status === 404) {
                throw new Error('仓库未找到');
            } else if (response.status === 401) {
                throw new Error('Token 无效');
            } else {
                throw new Error(errorData.error || `加载失败 (${response.status})`);
            }
        }

        const data = await response.json();
        displayFiles(data.releases || []);
        showStatus('加载完成', 'success');
    } catch (error) {
        showStatus('加载失败：' + error.message, 'error');
    }
}

// 显示文件列表
function displayFiles(releases) {
    const container = document.getElementById('filesList');
    if (!container) return;

    if (!releases || releases.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无文件，上传一个文件试试吧！</p>';
        return;
    }

    const config = getConfig();
    let html = '';

    releases.forEach(release => {
        if (release.assets && release.assets.length > 0) {
            html += `<div class="release-section"><h3>${release.tag}</h3>`;
            release.assets.forEach(asset => {
                html += `
                    <div class="file-item">
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(asset.name)}</div>
                            <div class="file-meta">
                                <span class="file-size">${formatFileSize(asset.size)}</span>
                                <span class="file-downloads">${asset.downloadCount ?? asset.download_count ?? 0} 次下载</span>
                            </div>
                        </div>
                        <div class="file-actions">
                            <button class="btn-download" data-owner="${attrEsc(config.owner)}" data-repo="${attrEsc(config.repo)}" data-tag="${attrEsc(release.tag)}" data-filename="${attrEsc(asset.name)}" onclick="downloadFileThroughServer(this)">
                                下载
                            </button>
                            <button class="btn-delete" onclick="deleteFile('${escapeHtml(config.owner)}', '${escapeHtml(config.repo)}', ${asset.id}, '${escapeHtml(asset.name)}')">
                                删除
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
    });

    container.innerHTML = html || '<p class="empty-state">暂无文件，上传一个文件试试吧！</p>';
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 属性值转义（用于 data-*）
function attrEsc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// 经服务器下载：登录态用 Cookie，未登录用 query token
function downloadFileThroughServer(btn) {
    const owner = btn.getAttribute('data-owner');
    const repo = btn.getAttribute('data-repo');
    const tag = btn.getAttribute('data-tag');
    const filename = btn.getAttribute('data-filename');
    if (!owner || !repo || !tag || !filename) {
        showStatus('下载参数缺失', 'error');
        return;
    }
    const config = getConfig();
    if (!isLoggedIn && !config.token) {
        showStatus('请先登录或配置 Token', 'error');
        return;
    }
    const base = `${API_BASE_URL}/api/download/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(tag)}/${encodeURIComponent(filename)}`;
    let url = base + '?stream=1';
    if (!isLoggedIn && config.token) url += '&token=' + encodeURIComponent(config.token);
    window.open(url, '_blank');
    showStatus('已打开下载，若未弹出请检查浏览器是否拦截', 'success');
}

// 下载文件（直接打开 URL，保留用于兼容）
function downloadFile(url) {
    window.open(url, '_blank');
}

// 删除文件
async function deleteFile(owner, repo, assetId, assetName) {
    if (!confirm(`确定要删除 "${assetName}" 吗？`)) {
        return;
    }

    const config = getConfig();
    showStatus('删除中...', 'info');

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/delete-asset?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&assetId=${assetId}`,
            apiOptions()
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '删除失败');
        }

        showStatus('删除成功', 'success');
        loadFiles();
    } catch (error) {
        showStatus('删除失败：' + error.message, 'error');
        console.error('删除失败详情:', error);
    }
}

// 上传文件
function uploadFile(file) {
    const config = getConfig();
    if (!config.owner || !config.repo) {
        showStatus('请先配置仓库信息或登录', 'error');
        return;
    }
    if (!isLoggedIn && !config.token) {
        showStatus('请用 GitHub 登录或填写 Token', 'error');
        return;
    }

    const progressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (progressEl) progressEl.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '准备上传...';

    console.log('开始上传文件:', file.name, '大小:', formatFileSize(file.size));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('owner', config.owner);
    formData.append('repo', config.repo);
    formData.append('tag', config.tag);

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && progressFill && progressText) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = percent + '%';
            progressText.textContent = percent + '%';
            console.log(`上传进度: ${percent}% (${formatFileSize(e.loaded)}/${formatFileSize(e.total)})`);
        }
    });

    xhr.addEventListener('load', () => {
        console.log('上传完成，状态:', xhr.status);
        
        if (xhr.status === 200 || xhr.status === 201 || xhr.status === 204) {
            if (progressFill) progressFill.style.width = '100%';
            if (progressText) progressText.textContent = '上传完成';
            
            let response;
            try {
                response = JSON.parse(xhr.responseText);
            } catch (e) {
                response = {};
            }

            showStatus('上传成功！', 'success');
            loadFiles();
            setTimeout(() => { 
                if (progressEl) progressEl.style.display = 'none'; 
            }, 2000);
        } else {
            console.error('上传失败，状态:', xhr.status);
            
            let errorMsg = `上传失败 (${xhr.status})`;
            try {
                const errorData = JSON.parse(xhr.responseText);
                if (errorData.error) {
                    errorMsg = errorData.error;
                }
            } catch (e) {
                // 解析错误响应失败
            }
            
            if (xhr.status === 413) {
                errorMsg = '文件太大，超过服务器限制（最大 2GB）';
            } else if (xhr.status === 415) {
                errorMsg = '文件类型不支持，尝试其他格式';
            }
            
            showStatus(errorMsg, 'error');
            if (progressEl) progressEl.style.display = 'none';
        }
    });

    xhr.addEventListener('error', () => {
        console.error('上传网络错误');
        showStatus('网络错误，请检查连接后重试', 'error');
        if (progressEl) progressEl.style.display = 'none';
    });

    xhr.addEventListener('timeout', () => {
        console.error('上传超时（20分钟）');
        showStatus('上传超时（20分钟），文件可能太大，请重试', 'error');
        if (progressEl) progressEl.style.display = 'none';
    });

    xhr.open('POST', `${API_BASE_URL}/api/upload`, true);
    xhr.timeout = 1200000; // 20分钟超时，支持大文件
    xhr.withCredentials = true;
    
    xhr.addEventListener('progress', (e) => {
        if (progressText && e.loaded && e.lengthComputable) {
            console.log(`上传进度: ${Math.round((e.loaded / e.total) * 100)}%`);
        }
    });

    if (!isLoggedIn && config.token) xhr.setRequestHeader('Authorization', 'Bearer ' + config.token);

    xhr.send(formData);

    console.log('正在上传到:', `${API_BASE_URL}/api/upload`);
}

// 初始化拖拽上传
function initDragUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB
                showStatus('文件大小超过 2GB 限制', 'error');
                return;
            }
            uploadFile(file);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB
                showStatus('文件大小超过 2GB 限制', 'error');
                return;
            }
            uploadFile(file);
        }
    });
}

// 切换配置面板
function toggleConfig() {
    const panel = document.getElementById('configPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('初始化 GitHub 网盘，API:', API_BASE_URL);
    
    loadConfig();
    initDragUpload();

    const loginLink = document.getElementById('loginLink');
    if (loginLink) loginLink.href = (API_BASE_URL || window.location.origin) + '/api/auth/github';

    const loggedIn = await checkAuth();
    const params = new URLSearchParams(window.location.search);
    if (params.get('logged_in') === '1') {
        window.history.replaceState({}, '', window.location.pathname);
        showStatus('登录成功，已同步配置', 'success');
    }
    if (params.get('login') === 'error') {
        window.history.replaceState({}, '', window.location.pathname);
        showStatus('登录失败，请重试', 'error');
    }

    if (!loggedIn) {
        const config = getConfig();
        if (config.token && config.owner && config.repo) {
            verifyConfig(config.token, config.owner, config.repo);
        } else {
            const panel = document.getElementById('configPanel');
            if (panel) panel.style.display = 'block';
        }
    }

    document.getElementById('logoutBtn')?.addEventListener('click', () => logout());
    document.getElementById('saveConfigToAccount')?.addEventListener('click', () => saveConfigToAccount());

    const connectButton = document.getElementById('connectButton');
    if (connectButton) {
        connectButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveConfig();
        });
    }

    const toggleButton = document.getElementById('toggleConfig');
    if (toggleButton) {
        toggleButton.addEventListener('click', (e) => {
            e.preventDefault();
            toggleConfig();
        });
    }
});

console.log('JavaScript 文件加载完成');
