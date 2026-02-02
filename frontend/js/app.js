const API_BASE_URL = 'https://wangpan.cfspider.com';

function getConfig() {
    return {
        token: localStorage.getItem('githubToken') || '',
        owner: localStorage.getItem('repoOwner') || '',
        repo: localStorage.getItem('repoName') || '',
        tag: localStorage.getItem('releaseTag') || 'latest'
    };
}

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

function loadConfig() {
    const config = getConfig();
    document.getElementById('githubToken').value = config.token;
    document.getElementById('repoOwner').value = config.owner;
    document.getElementById('repoName').value = config.repo;
    document.getElementById('releaseTag').value = config.tag;
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusText');
    statusEl.textContent = message;
    statusEl.className = type;
    setTimeout(() => { statusEl.textContent = ''; }, 5000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function loadFiles() {
    const config = getConfig();
    if (!config.token || !config.owner || !config.repo) {
        showStatus('请先配置 GitHub 信息', 'error');
        return;
    }
    showStatus('加载中...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/api/list/${config.owner}/${config.repo}`, {
            headers: { 'Authorization': `Bearer ${config.token}` }
        });
        if (!response.ok) throw new Error('加载失败');
        const data = await response.json();
        displayFiles(data.releases);
        showStatus('加载完成', 'success');
    } catch (error) {
        showStatus('加载失败：' + error.message, 'error');
    }
}

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
            release.assets.forEach(asset => {
                html += '<div class="file-item"><div class="file-info"><div class="file-name">' + asset.name + '</div><div class="file-size">' + formatFileSize(asset.size) + ' · ' + release.tag + '</div></div><div class="file-actions"><button class="btn-download" onclick="downloadFile(\'' + config.owner + '\', \'' + config.repo + '\', \'' + release.tag + '\', \'' + asset.name + '\')">下载</button></div></div>';
            });
        }
    });
    container.innerHTML = html || '<p class="empty-state">暂无文件</p>';
}

function downloadFile(owner, repo, tag, filename) {
    const config = getConfig();
    const url = `${API_BASE_URL}/api/download/${owner}/${repo}/${tag}/${filename}`;
    window.open(url, '_blank');
}

function uploadFile(file) {
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
    progressText.textContent = '准备上传...';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('owner', config.owner);
    formData.append('repo', config.repo);
    formData.append('tag', config.tag);
    
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            progressFill.style.width = percent + '%';
            progressText.textContent = Math.round(percent) + '%';
        }
    });
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            showStatus('上传成功', 'success');
            loadFiles();
            setTimeout(() => { progressEl.style.display = 'none'; }, 2000);
        } else {
            showStatus('上传失败', 'error');
            progressEl.style.display = 'none';
        }
    });
    xhr.addEventListener('error', () => {
        showStatus('网络错误', 'error');
        progressEl.style.display = 'none';
    });
    xhr.open('POST', `${API_BASE_URL}/api/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${config.token}`);
    xhr.send(formData);
}

function initDragUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) uploadFile(e.target.files[0]);
    });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) uploadFile(e.dataTransfer.files[0]);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    initDragUpload();
    const config = getConfig();
    if (config.token && config.owner && config.repo) loadFiles();
});
