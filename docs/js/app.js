// GitHub Pages 版本 - 使用后端代理上传到 Releases

const API_BASE_URL = 'https://wangpan.cfspider.com'; // 后端代理服务地址

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

    // 验证配置（通过检查仓库）
    verifyConfig(token, owner, repo);
}

// 验证配置
async function verifyConfig(token, owner, repo) {
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
    if (!config.token || !config.owner || !config.repo) {
        showStatus('请先配置 GitHub 信息', 'error');
        return;
    }

    showStatus('加载中...', 'info');
    try {
        // 通过后端代理获取 Releases 列表
        const response = await fetch(
            `${API_BASE_URL}/api/list/${config.owner}/${config.repo}`,
            {
                headers: { 'Authorization': `Bearer ${config.token}` }
            }
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

// 经服务器下载（先请求 /api/download，再跳转到返回的地址）
async function downloadFileThroughServer(btn) {
    const owner = btn.getAttribute('data-owner');
    const repo = btn.getAttribute('data-repo');
    const tag = btn.getAttribute('data-tag');
    const filename = btn.getAttribute('data-filename');
    if (!owner || !repo || !tag || !filename) {
        showStatus('下载参数缺失', 'error');
        return;
    }
    const config = getConfig();
    if (!config.token) {
        showStatus('请先配置 Token', 'error');
        return;
    }
    const url = `${API_BASE_URL}/api/download/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(tag)}/${encodeURIComponent(filename)}`;
    try {
        const res = await fetch(url, { redirect: 'manual', headers: { 'Authorization': `Bearer ${config.token}` } });
        if (res.status === 302) {
            const loc = res.headers.get('Location');
            if (loc) window.open(loc, '_blank');
            else showStatus('获取下载链接失败', 'error');
        } else if (res.status === 200) {
            window.open(url, '_blank');
        } else {
            const err = await res.json().catch(() => ({}));
            showStatus(err.error || '下载失败', 'error');
        }
    } catch (e) {
        showStatus('下载失败：' + (e.message || '网络错误'), 'error');
    }
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
        // 通过后端代理删除文件
        const response = await fetch(
            `${API_BASE_URL}/api/delete-asset?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&assetId=${assetId}`,
            {
                headers: { 'Authorization': `Bearer ${config.token}` }
            }
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
    if (!config.token || !config.owner || !config.repo) {
        showStatus('请先配置 GitHub 信息', 'error');
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
    
    // 添加进度监听
    xhr.addEventListener('progress', (e) => {
        if (progressText && e.loaded && e.lengthComputable) {
            console.log(`上传进度: ${Math.round((e.loaded / e.total) * 100)}%`);
        }
    });

    xhr.setRequestHeader('Authorization', `Bearer ${config.token}`);

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
document.addEventListener('DOMContentLoaded', () => {
    console.log('初始化 GitHub 网盘（使用后端代理）...');
    console.log('后端 API 地址:', API_BASE_URL);
    
    loadConfig();
    initDragUpload();

    const config = getConfig();
    if (config.token && config.owner && config.repo) {
        console.log('找到已保存配置，自动验证...');
        verifyConfig(config.token, config.owner, config.repo);
    } else {
        console.log('首次使用，显示配置面板');
        const panel = document.getElementById('configPanel');
        if (panel) panel.style.display = 'block';
    }

    // 绑定按钮事件
    const connectButton = document.getElementById('connectButton');
    console.log('连接按钮元素:', connectButton);
    
    if (connectButton) {
        connectButton.addEventListener('click', function(e) {
            console.log('点击连接按钮');
            e.preventDefault();
            e.stopPropagation();
            saveConfig();
        });
        console.log('已绑定连接按钮事件');
    } else {
        console.error('未找到连接按钮');
    }
    
    // 绑定配置切换按钮
    const toggleButton = document.getElementById('toggleConfig');
    if (toggleButton) {
        toggleButton.addEventListener('click', function(e) {
            e.preventDefault();
            toggleConfig();
        });
    }
});

console.log('JavaScript 文件加载完成');
