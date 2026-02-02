// GitHub Pages 版本 - 直接使用 GitHub API

const GITHUB_API_BASE = 'https://api.github.com';

// 获取配置
function getConfig() {
    return {
        token: localStorage.getItem('githubToken') || '',
        owner: localStorage.getItem('repoOwner') || '',
        repo: localStorage.getItem('repoName') || '',
        tag: localStorage.getItem('releaseTag') || 'latest'
    };
}

// 保存配置
function saveConfig() {
    const token = document.getElementById('githubToken')?.value.trim() || '';
    const owner = document.getElementById('repoOwner')?.value.trim() || '';
    const repo = document.getElementById('repoName')?.value.trim() || '';
    const tag = document.getElementById('releaseTag')?.value.trim() || 'latest';

    if (!token || !owner || !repo) {
        showStatus('请填写完整的配置信息', 'error');
        return;
    }

    localStorage.setItem('githubToken', token);
    localStorage.setItem('repoOwner', owner);
    localStorage.setItem('repoName', repo);
    localStorage.setItem('releaseTag', tag);

    showStatus('配置已保存，正在验证...', 'success');

    // 验证配置
    verifyConfig(token, owner, repo);
}

// 验证配置
async function verifyConfig(token, owner, repo) {
    try {
        const response = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
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

        showStatus('✅ 连接成功！', 'success');
        loadFiles();
    } catch (error) {
        showStatus('❌ 配置验证失败：' + error.message, 'error');
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
    if (!config.token || !config.owner || !config.repo) {
        showStatus('请先配置 GitHub 信息', 'error');
        return;
    }

    showStatus('📂 加载中...', 'info');
    try {
        const response = await fetch(
            `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/releases`,
            {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('权限不足，请检查 Token 权限');
            } else if (response.status === 404) {
                throw new Error('仓库未找到');
            } else if (response.status === 401) {
                throw new Error('Token 无效');
            } else {
                throw new Error(`加载失败 (${response.status})`);
            }
        }

        const releases = await response.json();
        displayFiles(releases);
        showStatus('✅ 加载完成', 'success');
    } catch (error) {
        showStatus('❌ 加载失败：' + error.message, 'error');
    }
}

// 显示文件列表
function displayFiles(releases) {
    const container = document.getElementById('filesList');
    if (!container) return;

    if (!releases || releases.length === 0) {
        container.innerHTML = '<p class="empty-state">📁 暂无文件，上传一个文件试试吧！</p>';
        return;
    }

    const config = getConfig();
    let html = '';

    releases.forEach(release => {
        if (release.assets && release.assets.length > 0) {
            html += `<div class="release-section"><h3>${release.tag_name}</h3>`;
            release.assets.forEach(asset => {
                html += `
                    <div class="file-item">
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(asset.name)}</div>
                            <div class="file-meta">
                                <span class="file-size">${formatFileSize(asset.size)}</span>
                                <span class="file-downloads">${asset.download_count} 次下载</span>
                            </div>
                        </div>
                        <div class="file-actions">
                            <button class="btn-download" onclick="downloadFile('${escapeHtml(asset.browser_download_url)}')">
                                📥 下载
                            </button>
                            <button class="btn-delete" onclick="deleteFile('${escapeHtml(config.owner)}', '${escapeHtml(config.repo)}', ${asset.id}, '${escapeHtml(asset.name)}')">
                                🗑️ 删除
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
    });

    container.innerHTML = html || '<p class="empty-state">📁 暂无文件，上传一个文件试试吧！</p>';
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 下载文件
function downloadFile(url) {
    window.open(url, '_blank');
}

// 删除文件
async function deleteFile(owner, repo, assetId, assetName) {
    if (!confirm(`确定要删除 "${assetName}" 吗？`)) {
        return;
    }

    const config = getConfig();
    showStatus('🗑️ 删除中...', 'info');

    try {
        const response = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/assets/${assetId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('权限不足，无法删除文件');
            } else if (response.status === 404) {
                throw new Error('文件不存在');
            } else {
                throw new Error('删除失败');
            }
        }

        showStatus('✅ 删除成功', 'success');
        loadFiles();
    } catch (error) {
        showStatus('❌ 删除失败：' + error.message, 'error');
    }
}

// 上传文件
async function uploadFile(file) {
    const config = getConfig();
    if (!config.token || !config.owner || !config.repo) {
        showStatus('请先配置 GitHub 信息', 'error');
        return;
    }

    const progressEl = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (progressEl) progressEl.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '检查 Release...';

    try {
        // 检查或创建 Release
        let release;
        let isNewRelease = false;

        try {
            if (progressText) progressText.textContent = '🔍 查找 Release...';
            const releaseResponse = await fetch(
                `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/releases/tags/${config.tag}`,
                {
                    headers: {
                        'Authorization': `token ${config.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (releaseResponse.ok) {
                release = await releaseResponse.json();
                if (progressText) progressText.textContent = '✅ 找到 Release';
            } else if (releaseResponse.status === 404) {
                isNewRelease = true;
            } else {
                throw new Error('检查 Release 失败');
            }
        } catch (error) {
            isNewRelease = true;
        }

        if (isNewRelease) {
            if (progressText) progressText.textContent = '🏷️ 创建 Release...';
            if (progressFill) progressFill.style.width = '20%';

            try {
                const createResponse = await fetch(
                    `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/releases`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `token ${config.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            tag_name: config.tag,
                            name: config.tag,
                            body: 'Created by GitHub Pages 网盘',
                            draft: false,
                            prerelease: false
                        })
                    }
                );

                if (!createResponse.ok) {
                    const errorData = await createResponse.json().catch(() => ({}));
                    if (createResponse.status === 403) {
                        throw new Error('权限不足：Token 需要 repo 权限才能创建 Release');
                    } else if (createResponse.status === 422) {
                        throw new Error('创建失败：TAG 可能已存在或仓库验证失败，请在 GitHub 仓库页面添加一个 Release');
                    } else if (createResponse.status === 404) {
                        throw new Error('仓库未找到或无权访问');
                    } else {
                        throw new Error(errorData.message || '创建 Release 失败，请检查仓库设置');
                    }
                }

                release = await createResponse.json();
            } catch (error) {
                throw new Error(error.message);
            }
        }

        if (progressText) progressText.textContent = '📤 准备上传...';
        if (progressFill) progressFill.style.width = '30%';

        // 上传文件到 Release
        const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(file.name)}`);

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && progressFill && progressText) {
                const percent = Math.round((e.loaded / e.total) * 70) + 30;
                progressFill.style.width = percent + '%';
                progressText.textContent = percent + '%';
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200 || xhr.status === 201 || xhr.status === 202) {
                if (progressFill) progressFill.style.width = '100%';
                if (progressText) progressText.textContent = '✅ 上传完成';
                showStatus('✅ 上传成功！', 'success');
                loadFiles();
                setTimeout(() => { 
                    if (progressEl) progressEl.style.display = 'none'; 
                }, 2000);
            } else {
                let errorMsg = '上传失败';
                if (xhr.status === 413) {
                    errorMsg = '文件太大，超过 GitHub 限制（100MB）';
                } else if (xhr.status === 422) {
                    errorMsg = '文件名冲突或格式不支持';
                }
                showStatus('❌ ' + errorMsg + ` (${xhr.status})`, 'error');
                if (progressEl) progressEl.style.display = 'none';
            }
        });

        xhr.addEventListener('error', () => {
            showStatus('❌ 网络错误，请检查连接', 'error');
            if (progressEl) progressEl.style.display = 'none';
        });

        xhr.addEventListener('timeout', () => {
            showStatus('❌ 上传超时，请重试', 'error');
            if (progressEl) progressEl.style.display = 'none';
        });

        xhr.open('POST', uploadUrl, true);
        xhr.timeout = 300000; // 5分钟超时
        xhr.setRequestHeader('Authorization', `token ${config.token}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.send(file);

    } catch (error) {
        showStatus('❌ 上传失败：' + error.message, 'error');
        if (progressEl) progressEl.style.display = 'none';
    }
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
            if (file.size > 100 * 1024 * 1024) { // 100MB
                showStatus('❌ 文件大小超过 100MB 限制', 'error');
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
            if (file.size > 100 * 1024 * 1024) { // 100MB
                showStatus('❌ 文件大小超过 100MB 限制', 'error');
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
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    initDragUpload();

    const config = getConfig();
    if (config.token && config.owner && config.repo) {
        // 自动验证配置
        verifyConfig(config.token, config.owner, config.repo);
    } else {
        // 第一次使用时显示配置面板
        const panel = document.getElementById('configPanel');
        if (panel) panel.style.display = 'block';
    }

    // 绑定按钮事件（备用）
    const connectButton = document.getElementById('connectButton');
    if (connectButton) {
        connectButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            saveConfig();
        });
    }
});
