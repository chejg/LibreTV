// watch.js - 获取视频详情并重定向到播放器

// 在全局范围内定义 getCustomApiInfo 函数，以便在需要时使用
function getCustomApiInfo(customApiIndex) {
    try {
        const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
        const index = parseInt(customApiIndex);
        if (isNaN(index) || index < 0 || index >= customAPIs.length) {
            return null;
        }
        return customAPIs[index];
    } catch (e) {
        console.error("获取自定义API信息失败:", e);
        return null;
    }
}

window.onload = function() {
    const currentParams = new URLSearchParams(window.location.search);
    const statusElement = document.getElementById('redirect-status');
    const manualRedirect = document.getElementById('manual-redirect');

    // 如果URL中已经有视频url，则直接跳转
    if (currentParams.has('url')) {
        proceedToPlayer(currentParams);
        return;
    }

    // 如果没有视频url，则从id和source获取详情
    const videoId = currentParams.get('id');
    const sourceCode = currentParams.get('source');
    const videoName = currentParams.get('name') || '视频';

    if (!videoId || !sourceCode) {
        updateStatus('错误：缺少视频ID或来源信息。', true);
        return;
    }

    updateStatus(`正在获取“${videoName}”的播放列表...`);

    fetchVideoDetails(videoId, sourceCode)
        .then(data => {
            if (data.episodes && data.episodes.length > 0) {
                updateStatus('成功获取播放列表，即将跳转...');
                
                const firstEpisodeUrl = data.episodes[0];
                
                // 添加必要的参数到URL
                currentParams.set('url', firstEpisodeUrl);
                currentParams.set('title', data.videoInfo.name || videoName);
                currentParams.set('index', '0');
                
                // 将整个剧集列表添加到参数中
                currentParams.set('episodes', JSON.stringify(data.episodes));

                // 跳转到播放器
                proceedToPlayer(currentParams);

            } else {
                throw new Error('未找到可播放的资源');
            }
        })
        .catch(error => {
            console.error('获取视频详情失败:', error);
            updateStatus(`获取视频详情失败: ${error.message}`, true);
        });
};

// 获取视频详情
async function fetchVideoDetails(id, sourceCode) {
    let apiParams = '';

    // 处理自定义API
    if (sourceCode.startsWith('custom_')) {
        const customIndex = sourceCode.replace('custom_', '');
        const customApi = getCustomApiInfo(customIndex);
        if (customApi) {
            if (customApi.detail) {
                apiParams = `&customApi=${encodeURIComponent(customApi.url)}&customDetail=${encodeURIComponent(customApi.detail)}&source=custom`;
            } else {
                apiParams = `&customApi=${encodeURIComponent(customApi.url)}&source=custom`;
            }
        } else {
            throw new Error('找不到自定义API配置');
        }
    } else {
        apiParams = `&source=${sourceCode}`;
    }

    const timestamp = new Date().getTime();
    const cacheBuster = `&_t=${timestamp}`;
    
    // 注意：这里的 PROXY_URL 需要是可访问的。在 watch.html 的上下文中，我们可能需要硬编码或从配置中获取
    // 假设代理是相对于根目录的 /api/proxy/
    const PROXY_PREFIX = '/api/detail'; 
    const response = await fetch(`${PROXY_PREFIX}?id=${encodeURIComponent(id)}${apiParams}${cacheBuster}`);
    
    if (!response.ok) {
        throw new Error(`网络响应错误: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
}


// 跳转到播放器页面
function proceedToPlayer(params) {
    const playerUrlObj = new URL("player.html", window.location.origin);

    // 复制所有参数到新URL
    params.forEach((value, key) => {
        playerUrlObj.searchParams.set(key, value);
    });

    // --- 返回URL逻辑 ---
    const backUrl = params.get('back');
    let returnUrl = '';
    if (backUrl) {
        returnUrl = decodeURIComponent(backUrl);
    } else if (document.referrer && document.referrer.trim() !== '') {
        returnUrl = document.referrer;
    } else {
        returnUrl = '/'; // 默认返回首页
    }
    
    if (!playerUrlObj.searchParams.has('returnUrl')) {
        playerUrlObj.searchParams.set('returnUrl', encodeURIComponent(returnUrl));
    }
    localStorage.setItem('lastPageUrl', returnUrl);
    // --- 返回URL逻辑结束 ---

    const finalPlayerUrl = playerUrlObj.toString();

    // 更新手动重定向链接
    const manualRedirect = document.getElementById('manual-redirect');
    if (manualRedirect) {
        manualRedirect.href = finalPlayerUrl;
    }

    // 更新meta refresh标签
    const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
    if (metaRefresh) {
        metaRefresh.content = `3; url=${finalPlayerUrl}`;
    }

    // 立即开始重定向
    setTimeout(() => {
        window.location.href = finalPlayerUrl;
    }, 2800);
}

// 更新状态显示
function updateStatus(message, isError = false) {
    const statusElement = document.getElementById('redirect-status');
    if (statusElement) {
        statusElement.textContent = message;
        if (isError) {
            statusElement.style.color = '#f87171'; // red-400
        }
    }
}
