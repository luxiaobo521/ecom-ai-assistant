// ==================== 全局状态 ====================
let currentPage = 'landing';
let currentAdminPage = 'overview';
let userInfo = null;
let isYearlyPricing = false;

// ==================== 安全工具函数 ====================
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// ==================== 页面切换 ====================
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    currentPage = page;
    window.scrollTo(0, 0);
    
    // 导航栏滚动效果
    if (page === 'landing' || page === 'pricing' || page === 'help') {
        initNavScroll();
    }
    
    // 如果是后台页面，加载用户信息
    if (page === 'dashboard') {
        loadUserInfo();
        switchAdminPage('overview');
    }
}

function scrollToFeatures() {
    showPage('landing');
    setTimeout(() => {
        const el = document.getElementById('features-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

// 导航栏滚动效果
function initNavScroll() {
    const nav = document.getElementById('landing-nav');
    if (!nav) return;
    
    const handleScroll = () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll();
}

// 价格切换
function togglePricing() {
    isYearlyPricing = !isYearlyPricing;
    const switches = document.querySelectorAll('.pricing-toggle-switch');
    const labels = document.querySelectorAll('.pricing-toggle-label');
    
    switches.forEach(s => s.classList.toggle('active', isYearlyPricing));
    labels.forEach((l, i) => {
        l.classList.toggle('active', (i === 0 && !isYearlyPricing) || (i === 1 && isYearlyPricing));
    });
    
    // 更新价格显示
    const monthlyPrice = document.getElementById('monthly-price');
    const yearlyPrice = document.getElementById('yearly-price');
    if (monthlyPrice) monthlyPrice.textContent = isYearlyPricing ? '33' : '39';
}

// ==================== 功能跳转 ====================
function goToFunction(func) {
    if (!userInfo) {
        showToast('请先登录', 'warning');
        showPage('login');
        return;
    }
    showPage('dashboard');
    setTimeout(() => switchAdminPage(func), 100);
}

// ==================== 后台页面切换 ====================
function switchAdminPage(page) {
    // 隐藏所有后台页面
    document.querySelectorAll('.admin-page').forEach(p => p.style.display = 'none');
    
    // 显示目标页面
    const target = document.getElementById('admin-' + page);
    if (target) target.style.display = 'block';
    
    currentAdminPage = page;
    
    // 更新侧边栏激活状态
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // 更新面包屑
    const pageNames = {
        'overview': '数据总看板',
        'title': '标题生成',
        'detail': '详情页生成',
        'service': '客服话术',
        'competitor': '竞品分析',
        'shop-data': '店铺数据监控',
        'diagnosis': 'AI运营诊断',
        'report': '报表生成',
        'shop-bind': '店铺绑定',
        'pricing-admin': '会员升级',
        'profile': '个人中心'
    };
    const breadcrumb = document.getElementById('breadcrumb-current');
    if (breadcrumb) breadcrumb.textContent = pageNames[page] || page;
    
    // 页面特定初始化
    if (page === 'shop-bind') {
        loadBoundShops();
    }
    if (page === 'pricing-admin') {
        loadPricingAdmin();
    }
    if (page === 'profile') {
        loadProfile();
    }
}

// ==================== 用户系统 ====================
async function loadUserInfo() {
    try {
        const res = await fetch('/api/user-info');
        const data = await res.json();
        if (data.logged_in) {
            userInfo = data;
            updateUserUI();
        }
    } catch (e) { /* 静默处理 */ }
}

function updateUserUI() {
    if (!userInfo) return;
    
    const username = userInfo.username || '用户';
    const firstChar = username.charAt(0).toUpperCase();
    
    // 侧边栏
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    const sidebarUsername = document.getElementById('sidebar-username');
    const sidebarPlan = document.getElementById('sidebar-plan');
    if (sidebarAvatar) sidebarAvatar.textContent = firstChar;
    if (sidebarUsername) sidebarUsername.textContent = username;
    if (sidebarPlan) {
        const planNames = {free: '免费版', monthly: '月付版', yearly: '年付版', enterprise: '企业版'};
        sidebarPlan.textContent = planNames[userInfo.plan] || '免费版';
    }
    
    // 顶栏
    const topbarAvatar = document.getElementById('topbar-avatar');
    const topbarUsername = document.getElementById('topbar-username');
    if (topbarAvatar) topbarAvatar.textContent = firstChar;
    if (topbarUsername) topbarUsername.textContent = username;
    
    // 统计
    const statAiUsage = document.getElementById('stat-ai-usage');
    if (statAiUsage) {
        statAiUsage.textContent = `${userInfo.daily_ai_usage || 0}/${userInfo.daily_ai_limit || 10}`;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!phone || !password) {
        showToast('请填写手机号和密码', 'error');
        return;
    }
    
    showLoading('登录中...');
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({phone, password})
        });
        const result = await res.json();
        hideLoading();
        
        if (result.success) {
            showToast('登录成功', 'success');
            showPage('dashboard');
        } else {
            showToast(result.message || '登录失败', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('网络错误', 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const phone = document.getElementById('register-phone').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const agree = document.getElementById('agree-terms').checked;
    
    if (!phone || !password || !confirm) {
        showToast('请填写完整信息', 'error');
        return;
    }
    if (!agree) {
        showToast('请阅读并同意用户协议', 'error');
        return;
    }
    if (password !== confirm) {
        showToast('两次密码不一致', 'error');
        return;
    }
    
    showLoading('注册中...');
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({phone, password, confirm_password: confirm})
        });
        const result = await res.json();
        hideLoading();
        
        if (result.success) {
            showToast('注册成功', 'success');
            showPage('dashboard');
        } else {
            showToast(result.message || '注册失败', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('网络错误', 'error');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', {method: 'POST'});
    } catch (e) { /* 静默处理 */ }
    userInfo = null;
    showToast('已退出登录', 'success');
    showPage('landing');
}

// ==================== AI生成通用函数 ====================
async function callAIAPI(url, data, loadingText) {
    showLoading(loadingText || 'AI生成中...');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();
        hideLoading();
        return result;
    } catch (e) {
        hideLoading();
        showToast('网络错误', 'error');
        return null;
    }
}

function renderAIResult(containerId, result) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!result || !Array.isArray(result)) {
        // 单条结果
        const item = document.createElement('div');
        item.className = 'ai-result-item';
        const num = document.createElement('div');
        num.className = 'ai-result-num';
        num.textContent = '1';
        const text = document.createElement('div');
        text.className = 'ai-result-text';
        text.textContent = result || '';
        const actions = document.createElement('div');
        actions.className = 'ai-result-item-actions';
        const copyBtn = document.createElement('div');
        copyBtn.className = 'ai-result-copy-btn';
        copyBtn.textContent = '📋';
        copyBtn.title = '复制';
        copyBtn.onclick = () => copyText(result || '');
        actions.appendChild(copyBtn);
        item.appendChild(num);
        item.appendChild(text);
        item.appendChild(actions);
        container.appendChild(item);
        return;
    }
    
    // 多条结果
    result.forEach((text, index) => {
        const item = document.createElement('div');
        item.className = 'ai-result-item';
        const num = document.createElement('div');
        num.className = 'ai-result-num';
        num.textContent = index + 1;
        const textEl = document.createElement('div');
        textEl.className = 'ai-result-text';
        textEl.textContent = text;
        const actions = document.createElement('div');
        actions.className = 'ai-result-item-actions';
        const copyBtn = document.createElement('div');
        copyBtn.className = 'ai-result-copy-btn';
        copyBtn.textContent = '📋';
        copyBtn.title = '复制';
        copyBtn.onclick = () => copyText(text);
        actions.appendChild(copyBtn);
        item.appendChild(num);
        item.appendChild(textEl);
        item.appendChild(actions);
        container.appendChild(item);
    });
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(() => {
        showToast('复制失败', 'error');
    });
}

function copyAllResult(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const text = container.innerText;
    copyText(text);
}

// ==================== 标题生成 ====================
function fillTitleExample() {
    document.getElementById('title-product').value = '纯棉短袖T恤';
    document.getElementById('title-features').value = '100%纯棉、透气、百搭、不起球、不褪色';
}

async function generateTitle() {
    const product_name = document.getElementById('title-product').value.trim();
    const features = document.getElementById('title-features').value.trim();
    const platform = document.getElementById('title-platform').value;
    const style = document.getElementById('title-style').value;
    const word_count = document.getElementById('title-wordcount').value;
    
    if (!product_name) {
        showToast('请输入商品名称', 'error');
        return;
    }
    
    const result = await callAIAPI('/api/generate-title', {
        product_name, features, platform, style, word_count
    }, 'AI正在生成爆款标题...');
    
    if (!result) return;
    if (!result.success) {
        if (result.need_login) {
            showPage('login');
            return;
        }
        if (result.need_upgrade) {
            showUpgradeModal(result.message);
            return;
        }
        showToast(result.message || '生成失败', 'error');
        return;
    }
    
    // 解析结果为数组
    const lines = result.result.split('\n').filter(line => line.trim());
    renderAIResult('title-result', lines);
    showToast('标题生成成功！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo();
}

// ==================== 详情页生成 ====================
async function generateDetail() {
    const product_name = document.getElementById('detail-product').value.trim();
    const features = document.getElementById('detail-features').value.trim();
    const params = document.getElementById('detail-params').value.trim();
    const platform = document.getElementById('detail-platform').value;
    const style = document.getElementById('detail-style').value;
    
    if (!product_name || !features) {
        showToast('请填写商品名称和核心卖点', 'error');
        return;
    }
    
    const result = await callAIAPI('/api/generate-detail', {
        product_name, features, params, platform, style
    }, 'AI正在生成详情页文案...');
    
    if (!result) return;
    if (!result.success) {
        if (result.need_login) { showPage('login'); return; }
        if (result.need_upgrade) { showUpgradeModal(result.message); return; }
        showToast(result.message || '生成失败', 'error');
        return;
    }
    
    renderAIResult('detail-result', result.result);
    showToast('详情页生成成功！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo();
}

// ==================== 客服话术生成 ====================
async function generateService() {
    const scenario = document.getElementById('service-scenario').value;
    const question = document.getElementById('service-question').value.trim();
    const style = document.getElementById('service-style').value;
    
    if (!question) {
        showToast('请输入客户问题', 'error');
        return;
    }
    
    const result = await callAIAPI('/api/generate-service', {
        scenario, question, style
    }, 'AI正在生成客服话术...');
    
    if (!result) return;
    if (!result.success) {
        if (result.need_login) { showPage('login'); return; }
        if (result.need_upgrade) { showUpgradeModal(result.message); return; }
        showToast(result.message || '生成失败', 'error');
        return;
    }
    
    renderAIResult('service-result', result.result);
    showToast('话术生成成功！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo();
}

// ==================== 竞品分析 ====================
async function analyzeCompetitor() {
    const url = document.getElementById('competitor-url').value.trim();
    if (!url) {
        showToast('请输入竞品商品链接', 'error');
        return;
    }
    
    const result = await callAIAPI('/api/competitor-analysis', {url}, 'AI正在分析竞品数据...');
    
    if (!result) return;
    if (!result.success) {
        if (result.need_login) { showPage('login'); return; }
        if (result.need_upgrade) { showUpgradeModal(result.message); return; }
        showToast(result.message || '分析失败', 'error');
        return;
    }
    
    renderCompetitorResult(result.data);
    document.getElementById('competitor-empty').style.display = 'none';
    showToast('竞品分析完成！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo();
}

function renderCompetitorResult(data) {
    const container = document.getElementById('competitor-result');
    container.style.display = 'block';
    container.innerHTML = '';
    
    // 基本信息卡片
    const card1 = document.createElement('div');
    card1.className = 'competitor-data-card';
    const h3_1 = document.createElement('h3');
    h3_1.textContent = '📦 ' + (data.product_name || '');
    card1.appendChild(h3_1);
    
    const dataGrid = document.createElement('div');
    dataGrid.className = 'data-grid';
    const items = [
        {label: '当前售价', value: '¥' + (data.current_price || '')},
        {label: '原价', value: '¥' + (data.original_price || '')},
        {label: '月销量', value: (data.monthly_sales || 0) + '+'},
        {label: '好评率', value: (data.reviews?.good_rate || 0) + '%'}
    ];
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'data-item';
        const label = document.createElement('div');
        label.className = 'data-item-label';
        label.textContent = item.label;
        const value = document.createElement('div');
        value.className = 'data-item-value';
        value.textContent = item.value;
        div.appendChild(label);
        div.appendChild(value);
        dataGrid.appendChild(div);
    });
    card1.appendChild(dataGrid);
    container.appendChild(card1);
    
    // 评价关键词
    const card2 = document.createElement('div');
    card2.className = 'competitor-data-card';
    const h3_good = document.createElement('h3');
    h3_good.textContent = '👍 好评关键词';
    card2.appendChild(h3_good);
    const tagList1 = document.createElement('div');
    tagList1.className = 'tag-list';
    (data.reviews?.good_keywords || []).forEach(k => {
        const span = document.createElement('span');
        span.className = 'tag-item';
        span.textContent = k;
        tagList1.appendChild(span);
    });
    card2.appendChild(tagList1);
    
    const h3_bad = document.createElement('h3');
    h3_bad.style.marginTop = '20px';
    h3_bad.textContent = '👎 差评痛点';
    card2.appendChild(h3_bad);
    const tagList2 = document.createElement('div');
    tagList2.className = 'tag-list';
    (data.reviews?.bad_keywords || []).forEach(k => {
        const span = document.createElement('span');
        span.className = 'tag-item bad';
        span.textContent = k;
        tagList2.appendChild(span);
    });
    card2.appendChild(tagList2);
    container.appendChild(card2);
    
    // 促销活动
    const card3 = document.createElement('div');
    card3.className = 'competitor-data-card';
    const h3_promo = document.createElement('h3');
    h3_promo.textContent = '🎯 当前促销活动';
    card3.appendChild(h3_promo);
    const tagList3 = document.createElement('div');
    tagList3.className = 'tag-list';
    (data.promotions?.current || []).forEach(p => {
        const span = document.createElement('span');
        span.className = 'tag-item';
        span.textContent = p;
        tagList3.appendChild(span);
    });
    card3.appendChild(tagList3);
    const p_promo = document.createElement('p');
    p_promo.style.marginTop = '12px';
    p_promo.style.fontSize = '13px';
    p_promo.style.color = 'var(--text-secondary)';
    p_promo.textContent = '优惠券：' + (data.promotions?.coupon || '') + ' | 策略：' + (data.promotions?.strategy || '');
    card3.appendChild(p_promo);
    container.appendChild(card3);
    
    // AI总结
    const card4 = document.createElement('div');
    card4.className = 'competitor-data-card';
    const summaryBox = document.createElement('div');
    summaryBox.className = 'ai-summary-box';
    const h4 = document.createElement('h4');
    h4.textContent = '💡 AI竞品分析总结';
    const summaryText = document.createElement('div');
    summaryText.className = 'result-text';
    summaryText.textContent = data.ai_summary || '';
    summaryBox.appendChild(h4);
    summaryBox.appendChild(summaryText);
    card4.appendChild(summaryBox);
    container.appendChild(card4);
    
    // 操作按钮
    const btnDiv = document.createElement('div');
    btnDiv.style.textAlign = 'center';
    btnDiv.style.marginBottom = '20px';
    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn btn-outline';
    btnCopy.textContent = '复制分析报告';
    btnCopy.onclick = () => copyAllResult('competitor-result');
    btnDiv.appendChild(btnCopy);
    container.appendChild(btnDiv);
}

// ==================== 店铺数据监控 ====================
async function loadShopData() {
    showLoading('正在加载店铺数据...');
    try {
        const res = await fetch('/api/shop-data');
        const data = await res.json();
        hideLoading();
        if (data.success && data.data) {
            renderShopData(data.data);
            showToast('数据加载成功！（演示模式）', 'success');
        } else if (data.need_upgrade) {
            showUpgradeModal(data.message);
        } else {
            showToast(data.message || '加载失败', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('加载失败', 'error');
    }
}

function renderShopData(data) {
    const container = document.getElementById('shop-data-content');
    container.innerHTML = '';
    
    // 统计卡片
    const ov = data.overview || {};
    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';
    const stats = [
        {icon: '👥', label: '访客数', value: (ov.visitors || 0).toLocaleString(), change: '+12.5%', cls: 'blue'},
        {icon: '📦', label: '订单数', value: ov.today_orders || 0, change: '+8.3%', cls: 'green'},
        {icon: '💰', label: '销售额', value: '¥' + (ov.today_sales || 0).toLocaleString(), change: '+15.2%', cls: 'purple'},
        {icon: '📈', label: '转化率', value: (ov.conversion_rate || 0) + '%', change: '+2.1%', cls: 'orange'}
    ];
    stats.forEach(s => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        const icon = document.createElement('div');
        icon.className = 'stat-icon ' + s.cls;
        icon.textContent = s.icon;
        const info = document.createElement('div');
        info.className = 'stat-info';
        const label = document.createElement('div');
        label.className = 'stat-label';
        label.textContent = s.label;
        const value = document.createElement('div');
        value.className = 'stat-value';
        value.textContent = s.value;
        const change = document.createElement('div');
        change.className = 'stat-change up';
        change.textContent = '↑ ' + s.change + ' 较昨日';
        info.appendChild(label);
        info.appendChild(value);
        info.appendChild(change);
        card.appendChild(icon);
        card.appendChild(info);
        statsGrid.appendChild(card);
    });
    container.appendChild(statsGrid);
    
    // 热销商品
    const card1 = document.createElement('div');
    card1.className = 'card';
    card1.style.marginBottom = '24px';
    const header1 = document.createElement('div');
    header1.className = 'card-header';
    const h3_1 = document.createElement('h3');
    h3_1.textContent = '热销商品排行';
    header1.appendChild(h3_1);
    card1.appendChild(header1);
    const productList = document.createElement('div');
    productList.className = 'card-body';
    (data.top_products || []).forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'product-rank-item';
        const rank = document.createElement('span');
        rank.className = 'product-rank-num ' + (i < 3 ? 'top' : 'normal');
        rank.textContent = i + 1;
        const name = document.createElement('span');
        name.className = 'product-rank-name';
        name.textContent = p.name || '';
        const sales = document.createElement('span');
        sales.className = 'product-rank-sales';
        sales.textContent = '销量 ' + (p.sales || 0);
        const revenue = document.createElement('span');
        revenue.className = 'product-rank-revenue';
        revenue.textContent = '¥' + (p.revenue || 0).toLocaleString();
        const trend = document.createElement('span');
        trend.className = 'product-rank-trend';
        trend.textContent = p.trend === 'up' ? '📈' : '📉';
        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(sales);
        row.appendChild(revenue);
        row.appendChild(trend);
        productList.appendChild(row);
    });
    card1.appendChild(productList);
    container.appendChild(card1);
    
    // 预警
    const card2 = document.createElement('div');
    card2.className = 'card';
    const header2 = document.createElement('div');
    header2.className = 'card-header';
    const h3_2 = document.createElement('h3');
    h3_2.textContent = '⚠️ 数据异常预警';
    header2.appendChild(h3_2);
    card2.appendChild(header2);
    const alertList = document.createElement('div');
    alertList.className = 'card-body';
    (data.alerts || []).forEach(a => {
        const item = document.createElement('div');
        item.className = 'alert-item ' + (a.type || 'info');
        const icon = document.createElement('span');
        icon.className = 'alert-icon';
        icon.textContent = a.type === 'warning' ? '⚠️' : a.type === 'danger' ? '🔴' : 'ℹ️';
        const text = document.createElement('span');
        text.className = 'alert-text';
        text.textContent = a.message || '';
        const time = document.createElement('span');
        time.className = 'alert-time';
        time.textContent = a.time || '';
        item.appendChild(icon);
        item.appendChild(text);
        item.appendChild(time);
        alertList.appendChild(item);
    });
    card2.appendChild(alertList);
    container.appendChild(card2);
}

// ==================== AI运营诊断 ====================
async function runDiagnosis() {
    const result = await callAIAPI('/api/operation-diagnosis', {}, 'AI正在深度诊断店铺运营...');
    if (!result) return;
    if (!result.success) {
        if (result.need_login) { showPage('login'); return; }
        if (result.need_upgrade) { showUpgradeModal(result.message); return; }
        showToast(result.message || '诊断失败', 'error');
        return;
    }
    
    const container = document.getElementById('diagnosis-result');
    container.style.display = 'block';
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'competitor-data-card';
    const summaryBox = document.createElement('div');
    summaryBox.className = 'ai-summary-box';
    const h4 = document.createElement('h4');
    h4.textContent = '💡 AI智能运营诊断报告';
    const resultText = document.createElement('div');
    resultText.className = 'result-text';
    resultText.textContent = result.result || '';
    summaryBox.appendChild(h4);
    summaryBox.appendChild(resultText);
    card.appendChild(summaryBox);
    container.appendChild(card);
    
    const btnDiv = document.createElement('div');
    btnDiv.style.textAlign = 'center';
    btnDiv.style.marginTop = '20px';
    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn btn-outline';
    btnCopy.textContent = '复制诊断报告';
    btnCopy.onclick = () => copyAllResult('diagnosis-result');
    btnDiv.appendChild(btnCopy);
    container.appendChild(btnDiv);
    
    showToast('诊断完成！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo();
}

// ==================== 报表生成 ====================
async function generateReport() {
    const report_type = document.getElementById('report-type').value;
    const result = await callAIAPI('/api/generate-report', {report_type}, '正在生成专业运营报表...');
    if (!result) return;
    if (!result.success) {
        if (result.need_login) { showPage('login'); return; }
        if (result.need_upgrade) { showUpgradeModal(result.message); return; }
        showToast(result.message || '生成失败', 'error');
        return;
    }
    
    const container = document.getElementById('report-result');
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'competitor-data-card';
    const summaryBox = document.createElement('div');
    summaryBox.className = 'ai-summary-box';
    const h4 = document.createElement('h4');
    h4.textContent = '📋 ' + (report_type === 'weekly' ? '运营周报' : '运营月报');
    const resultText = document.createElement('div');
    resultText.className = 'result-text';
    resultText.textContent = result.result || '';
    summaryBox.appendChild(h4);
    summaryBox.appendChild(resultText);
    card.appendChild(summaryBox);
    container.appendChild(card);
    
    showToast('报表生成成功！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo();
}

// ==================== 店铺绑定 ====================
function showBindShopModal() {
    document.getElementById('bind-shop-modal').classList.add('active');
}

async function bindShop() {
    const platform = document.getElementById('bind-platform').value;
    const shop_name = document.getElementById('bind-shop-name').value.trim();
    const auth_code = document.getElementById('bind-auth-code').value.trim();
    
    if (!shop_name || !auth_code) {
        showToast('请填写完整信息', 'error');
        return;
    }
    
    showLoading('绑定中...');
    try {
        const res = await fetch('/api/bind-shop', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({platform, shop_name, auth_code})
        });
        const data = await res.json();
        hideLoading();
        
        if (data.success) {
            showToast('店铺绑定成功', 'success');
            closeModal('bind-shop-modal');
            document.getElementById('bind-shop-name').value = '';
            document.getElementById('bind-auth-code').value = '';
            loadBoundShops();
        } else {
            if (data.need_upgrade) {
                showUpgradeModal(data.message);
                return;
            }
            showToast(data.message || '绑定失败', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('网络错误', 'error');
    }
}

async function loadBoundShops() {
    const container = document.getElementById('bound-shops-list');
    container.innerHTML = '';
    try {
        const res = await fetch('/api/shop-list');
        const data = await res.json();
        if (data.success && data.shops && data.shops.length > 0) {
            data.shops.forEach(s => {
                const card = document.createElement('div');
                card.className = 'shop-card';
                const header = document.createElement('div');
                header.className = 'shop-card-header';
                const icon = document.createElement('div');
                icon.className = 'shop-platform-icon';
                icon.textContent = '🏪';
                const info = document.createElement('div');
                info.className = 'shop-info';
                const name = document.createElement('div');
                name.className = 'shop-name';
                name.textContent = s.shop_name || '';
                const status = document.createElement('div');
                status.className = 'shop-status';
                status.textContent = '● ' + (s.platform || '') + ' | 已绑定';
                info.appendChild(name);
                info.appendChild(status);
                header.appendChild(icon);
                header.appendChild(info);
                card.appendChild(header);
                
                const stats = document.createElement('div');
                stats.className = 'shop-card-stats';
                stats.innerHTML = '<div><div class="shop-stat-label">今日订单</div><div class="shop-stat-value">--</div></div><div><div class="shop-stat-label">今日销售额</div><div class="shop-stat-value">--</div></div>';
                card.appendChild(stats);
                
                const actions = document.createElement('div');
                actions.className = 'shop-card-actions';
                const syncBtn = document.createElement('button');
                syncBtn.className = 'btn btn-outline btn-sm';
                syncBtn.textContent = '同步数据';
                const unbindBtn = document.createElement('button');
                unbindBtn.className = 'btn btn-outline btn-sm';
                unbindBtn.textContent = '解绑';
                unbindBtn.onclick = () => unbindShop(s.id);
                actions.appendChild(syncBtn);
                actions.appendChild(unbindBtn);
                card.appendChild(actions);
                
                container.appendChild(card);
            });
        } else {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.style.gridColumn = '1/-1';
            empty.innerHTML = '<div class="empty-state-icon">🏪</div><p class="empty-state-text">暂无绑定店铺，点击上方按钮绑定</p>';
            container.appendChild(empty);
        }
    } catch (e) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.gridColumn = '1/-1';
        empty.textContent = '加载店铺列表失败';
        container.appendChild(empty);
    }
}

async function unbindShop(shopId) {
    if (!confirm('确定要解绑该店铺吗？')) return;
    try {
        const res = await fetch('/api/unbind-shop', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({shop_id: shopId})
        });
        const data = await res.json();
        if (data.success) {
            showToast('店铺已解绑', 'success');
            loadBoundShops();
        }
    } catch (e) { showToast('操作失败', 'error'); }
}

// ==================== 会员升级 ====================
function loadPricingAdmin() {
    if (userInfo) {
        const planNames = {free: '免费版', monthly: '月付版', yearly: '年付版', enterprise: '企业版'};
        document.getElementById('current-plan-name').textContent = planNames[userInfo.plan] || '免费版';
        document.getElementById('plan-ai-usage').textContent = userInfo.daily_ai_usage || 0;
        document.getElementById('plan-ai-limit').textContent = userInfo.daily_ai_limit || 10;
    }
}

function showUpgradeModal(message) {
    document.getElementById('upgrade-modal').classList.add('active');
}

async function confirmUpgrade() {
    const plan = document.querySelector('input[name="upgrade-plan"]:checked').value;
    showLoading('升级处理中...');
    try {
        const res = await fetch('/api/upgrade-plan', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({plan})
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            showToast('升级成功！', 'success');
            closeModal('upgrade-modal');
            loadUserInfo();
            loadPricingAdmin();
        } else {
            showToast(data.message || '升级失败', 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('网络错误', 'error');
    }
}

// ==================== 个人中心 ====================
function loadProfile() {
    if (!userInfo) return;
    const firstChar = (userInfo.username || '用').charAt(0).toUpperCase();
    document.getElementById('profile-avatar').textContent = firstChar;
    document.getElementById('profile-username').textContent = userInfo.username || '';
    document.getElementById('profile-phone').textContent = userInfo.phone_masked || '';
}

// ==================== 弹窗控制 ====================
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 点击遮罩关闭弹窗
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ==================== Toast提示 ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    const icons = {success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'};
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = icons[type] || 'ℹ️';
    
    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;
    
    const close = document.createElement('span');
    close.className = 'toast-close';
    close.textContent = '×';
    close.onclick = () => removeToast(toast);
    
    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(close);
    container.appendChild(toast);
    
    setTimeout(() => removeToast(toast), 3000);
}

function removeToast(toast) {
    toast.style.animation = 'toastOut 0.3s ease-out forwards';
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
}

// ==================== 加载遮罩 ====================
function showLoading(text) {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = text || '加载中...';
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 检查登录状态
    fetch('/api/user-info').then(res => res.json()).then(data => {
        if (data.logged_in) {
            userInfo = data;
        }
    }).catch(() => {});
    
    // 导航栏滚动
    initNavScroll();
});
