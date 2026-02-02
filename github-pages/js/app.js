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
    const token = document.getElementById('githubToken').value.trim();
    const owner = document.getElementById('repoOwner').value.trim();
    const repo = document.getElementById('repoName').value.trim();
    const tag = document.getElementById('releaseTag').value.trim() || 'latest';

    if (!token || !owner || !repo) {
        showStatus('请填写完整的配置信息', 'error');
        return;
    }

    localStorage.setItem('githubToken', token);
    localStorage.setItem('repoOwner', owner);
    localStorage.setItem('repoName', repo);
    localStorage.setItem('releaseTag', tag);

    showStatus('配置已保存', 'success');
    loadFiles();
}

// 加载配置
function loadConfig() {
    const config = getConfig();
    document.getElementById('githubToken').value = config.token;
    document.getElementById('repoOwner').value = config.owner;
    document.getElementById('repoName').value = config.repo;
    document.getElementById('releaseTag').value = config.tag;
}

// 显示状态消息
function showStatus(message, type) {
    const statusEl = document.getElementById('statusText');
    statusEl.textContent = message;
    statusEl.className = type;
    setTimeout(() => { statusEl.textContent = ''; }, 5000);
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

    showStatus('加载中...', 'info');
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
            throw new Error('加载失败，请检查 Token 和仓库权限');
        }

        const releases = await response.json();
        displayFiles(releases);
        showStatus('加载完成', 'success');
    } catch (error) {
        showStatus('加载失败：' + error.message, 'error');
    }
}

// 显示文件列表
function displayFiles(releases) {
    const container = document.getElementById('filesList');
    if (!releases || releases.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无文件</p>';
        return;
    }

    const config = getConfig();
    let html = '';

    releases.forEach(release => {
        if (release.assets && release.assets.length > 0) {
            const tag = release.tag || release.tag_name || '';
            html += `<div class="release-section"><h3>${tag}</h3>`;
            release.assets.forEach(asset => {
                const downloadUrl = asset.downloadUrl || asset.browser_download_url || '#';
                const downloadCount = asset.downloadCount ?? asset.download_count ?? 0;
                html += `
                    <div class="file-item">
                        <div class="file-info">
                            <div class="file-name">${asset.name}</div>
                            <div class="file-meta">
                                <span class="file-size">${formatFileSize(asset.size)}</span>
                                <span class="file-downloads">${downloadCount} 次下载</span>
                            </div>
                        </div>
                        <div class="file-actions">
                            <button class="btn-download" onclick="downloadFile('${downloadUrl}')">
                                下载
                            </button>
                            <button class="btn-delete" onclick="deleteFile('${config.owner}', '${config.repo}', ${asset.id}, '${asset.name}')">
                                删除
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
    });

    container.innerHTML = html || '<p class="empty-state">暂无文件</p>';
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
    showStatus('删除中...', 'info');

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
            throw new Error('删除失败');
        }

        showStatus('删除成功', 'success');
        loadFiles();
    } catch (error) {
        showStatus('删除失败：' + error.message, 'error');
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

    progressEl.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '检查 Release...';

    try {
        // 检查或创建 Release
        let release;
        try {
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
            } else {
                // 创建新 Release
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
                    const error = await createResponse.json();
                    throw new Error(error.message || '创建 Release 失败');
                }

                release = await createResponse.json();
            }
        } catch (error) {
            throw new Error('创建 Release 失败：' + error.message);
        }

        progressText.textContent = '准备上传...';
        progressFill.style.width = '10%';

        // 上传文件到 Release
        const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(file.name)}`);

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 90) + 10;
                progressFill.style.width = percent + '%';
                progressText.textContent = percent + '%';
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200 || xhr.status === 201 || xhr.status === 202) {
                progressFill.style.width = '100%';
                progressText.textContent = '上传完成';
                showStatus('上传成功', 'success');
                loadFiles();
                setTimeout(() => { progressEl.style.display = 'none'; }, 2000);
            } else {
                showStatus('上传失败：' + xhr.statusText, 'error');
                progressEl.style.display = 'none';
            }
        });

        xhr.addEventListener('error', () => {
            showStatus('网络错误', 'error');
            progressEl.style.display = 'none';
        });

        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('Authorization', `token ${config.token}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.send(file);

    } catch (error) {
        showStatus('上传失败：' + error.message, 'error');
        progressEl.style.display = 'none';
    }
}

// 初始化拖拽上传
function initDragUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
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
            uploadFile(e.dataTransfer.files[0]);
        }
    });
}

// 切换配置面板
function toggleConfig() {
    const panel = document.getElementById('configPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    initDragUpload();

    const config = getConfig();
    if (config.token && config.owner && config.repo) {
        loadFiles();
    } else {
        // 第一次使用时显示配置面板
        document.getElementById('configPanel').style.display = 'block';
    }
});
