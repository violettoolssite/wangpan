// GitHub Pages 版本 - 直接上传到 Git 仓库

const GITHUB_API_BASE = 'https://api.github.com';
const STORAGE_PATH = 'cloud-disk'; // 文件存储路径

// 获取配置
function getConfig() {
    return {
        token: localStorage.getItem('githubToken') || '',
        owner: localStorage.getItem('repoOwner') || '',
        repo: localStorage.getItem('repoName') || ''
    };
}

// 保存配置
function saveConfig() {
    const token = document.getElementById('githubToken')?.value.trim() || '';
    const owner = document.getElementById('repoOwner')?.value.trim() || '';
    const repo = document.getElementById('repoName')?.value.trim() || '';

    if (!token || !owner || !repo) {
        showStatus('请填写完整的配置信息', 'error');
        return;
    }

    localStorage.setItem('githubToken', token);
    localStorage.setItem('repoOwner', owner);
    localStorage.setItem('repoName', repo);

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

    if (tokenInput) tokenInput.value = config.token;
    if (ownerInput) ownerInput.value = config.owner;
    if (repoInput) repoInput.value = config.repo;
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
        const response = await fetch(
            `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${STORAGE_PATH}`,
            {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) {
            if (response.status === 404) {
                // 目录不存在，表示没有文件
                displayFiles([]);
                showStatus('加载完成（空仓库）', 'success');
                return;
            } else if (response.status === 403) {
                throw new Error('权限不足，请检查 Token 权限');
            } else if (response.status === 401) {
                throw new Error('Token 无效');
            } else {
                throw new Error(`加载失败 (${response.status})`);
            }
        }

        const files = await response.json();
        
        if (!Array.isArray(files)) {
            throw new Error('无法解析文件列表');
        }

        displayFiles(files);
        showStatus('加载完成', 'success');
    } catch (error) {
        showStatus('加载失败：' + error.message, 'error');
    }
}

// 显示文件列表
function displayFiles(files) {
    const container = document.getElementById('filesList');
    if (!container) return;

    if (!files || files.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无文件，上传一个文件试试吧！</p>';
        return;
    }

    const config = getConfig();
    let html = '';

    files.forEach(file => {
        const size = file.size || 0;
        html += `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-meta">
                        <span class="file-size">${formatFileSize(size)}</span>
                        <span class="file-date">${new Date(file.updated_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-download" onclick="downloadFile('${escapeHtml(file.name)}')">
                        下载
                    </button>
                    <button class="btn-delete" onclick="deleteFile('${escapeHtml(file.name)}')">
                        删除
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 下载文件
function downloadFile(filename) {
    const config = getConfig();
    const downloadUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/main/${STORAGE_PATH}/${encodeURIComponent(filename)}`;
    window.open(downloadUrl, '_blank');
}

// 删除文件
async function deleteFile(filename) {
    if (!confirm(`确定要删除 "${filename}" 吗？`)) {
        return;
    }

    const config = getConfig();
    showStatus('删除中...', 'info');

    try {
        // 首先获取文件的 SHA
        const response = await fetch(
            `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${STORAGE_PATH}/${encodeURIComponent(filename)}`,
            {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('文件不存在或无法访问');
        }

        const fileData = await response.json();
        const sha = fileData.sha;

        // 删除文件
        const deleteResponse = await fetch(
            `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${STORAGE_PATH}/${encodeURIComponent(filename)}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `删除文件: ${filename}`,
                    sha: sha
                })
            }
        );

        if (!deleteResponse.ok) {
            if (deleteResponse.status === 403) {
                throw new Error('权限不足，无法删除文件');
            } else if (deleteResponse.status === 404) {
                throw new Error('文件不存在');
            } else {
                throw new Error('删除失败');
            }
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

    if (progressEl) progressEl.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '准备上传...';

    try {
        console.log('开始上传文件:', file.name);

        // 将文件转为 Base64
        if (progressText) progressText.textContent = '读取文件...';
        const fileData = await readFileAsBase64(file);
        if (progressFill) progressFill.style.width = '30%';

        if (progressText) progressText.textContent = '上传到仓库...';
        if (progressFill) progressFill.style.width = '50%';

        // 检查文件是否已存在
        let sha = null;
        try {
            const checkResponse = await fetch(
                `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${STORAGE_PATH}/${encodeURIComponent(file.name)}`,
                {
                    headers: {
                        'Authorization': `token ${config.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (checkResponse.ok) {
                const existingFile = await checkResponse.json();
                sha = existingFile.sha;
            }
        } catch (error) {
            // 文件不存在，创建新文件
        }

        // 上传或更新文件
        const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${STORAGE_PATH}/${encodeURIComponent(file.name)}`;
        
        const bodyData = {
            message: `上传文件: ${file.name}`,
            content: fileData
        };

        if (sha) {
            bodyData.sha = sha;
        }

        const uploadResponse = await fetch(url, {
            method: sha ? 'PUT' : 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        });

        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '上传完成';

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            console.error('上传失败:', errorData);
            
            if (uploadResponse.status === 403) {
                throw new Error('权限不足，请检查 Token 权限');
            } else if (uploadResponse.status === 413) {
                throw new Error('文件太大，GitHub 限制为 100MB');
            } else if (uploadResponse.status === 422) {
                throw new Error(errorData.message || '上传失败，文件名冲突或格式不支持');
            } else {
                throw new Error(errorData.message || `上传失败 (${uploadResponse.status})`);
            }
        }

        const result = await uploadResponse.json();
        console.log('上传成功:', result.content.name);

        showStatus('上传成功！', 'success');
        loadFiles();
        setTimeout(() => { 
            if (progressEl) progressEl.style.display = 'none'; 
        }, 2000);
    } catch (error) {
        console.error('上传过程出错:', error);
        showStatus('上传失败：' + error.message, 'error');
        if (progressEl) progressEl.style.display = 'none';
    }
}

// 读取文件为 Base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
            const result = reader.result.split(',')[1]; // 移除 data URL 前缀
            resolve(result);
        };
        
        reader.onerror = (error) => {
            reject(new Error('读取文件失败'));
        };
        
        reader.readAsDataURL(file);
    });
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
                showStatus('文件大小超过 100MB 限制', 'error');
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
                showStatus('文件大小超过 100MB 限制', 'error');
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
    console.log('初始化 GitHub 网盘...');
    
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
