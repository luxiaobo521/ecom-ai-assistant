// ==================== 全局状态 ====================
let currentPage = 'landing';
let currentAdminPage = 'overview';
let userInfo = null;

// ==================== 安全工具函数 ====================
// HTML转义，防止XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// 安全设置元素文本内容
function setText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
}

// ==================== 前台页面切换 ====================
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    currentPage = page;
    window.scrollTo(0, 0);
    
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

function goToFunction(func) {
    // 检查登录状态
    fetch('/api/user-info').then(r => r.json()).then(data => {
        if (data.logged_in) {
            showPage('dashboard');
            setTimeout(() => switchAdminPage(func), 100);
        } else {
            showPage('login');
            showToast('请先登录后使用', 'warning');
        }
    });
}

// ==================== 登录/注册Tab切换 ====================
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    if (tab === 'login') {
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.getElementById('tab-register').classList.add('active');
        document.getElementById('register-form').classList.add('active');
    }
}

// ==================== 后台页面切换 ====================
function switchAdminPage(page) {
    document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById('admin-' + page);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) item.classList.add('active');
    });
    
    currentAdminPage = page;
    
    // 页面特定初始化
    if (page === 'overview') loadOverviewData();
    if (page === 'shop-data') loadShopData();
    if (page === 'shop-bind') loadBoundShops();
}

// ==================== 用户系统 ====================
async function handleLogin(event) {
    event.preventDefault();
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!phone || !password) { showToast('请填写手机号和密码', 'warning'); return; }
    
    showLoading('登录中...');
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({phone, password})
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            showToast('登录成功！', 'success');
            showPage('dashboard');
        } else {
            showToast(data.message || '登录失败', 'error');
        }
    } catch (e) { hideLoading(); showToast('网络错误', 'error'); }
}

async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    const phoneInput = form.querySelector('input[type="text"]');
    const passwordInputs = form.querySelectorAll('input[type="password"]');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const password = passwordInputs[0] ? passwordInputs[0].value : '';
    const confirm = passwordInputs[1] ? passwordInputs[1].value : '';
    
    if (!phone || !password) { showToast('请填写完整信息', 'warning'); return; }
    if (phone.length !== 11) { showToast('请输入正确的手机号', 'warning'); return; }
    if (password.length < 6) { showToast('密码至少6位', 'warning'); return; }
    if (password !== confirm) { showToast('两次密码不一致', 'warning'); return; }
    
    showLoading('注册中...');
    try {
        const res = await fetch('/api/register', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({phone, password, confirm_password: confirm})
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            showToast('注册成功！', 'success');
            showPage('dashboard');
        } else {
            showToast(data.message || '注册失败', 'error');
        }
    } catch (e) { hideLoading(); showToast('网络错误', 'error'); }
}

async function handleLogout() {
    try {
        await fetch('/logout');
        showToast('已退出登录', 'success');
        showPage('landing');
    } catch (e) { showToast('退出失败', 'error'); }
}

async function loadUserInfo() {
    try {
        const res = await fetch('/api/user-info');
        const data = await res.json();
        if (data.logged_in) {
            userInfo = data;
            // 更新顶部栏
            document.getElementById('user-plan-badge').textContent = data.plan_name;
            document.getElementById('remaining-count').textContent = Math.max(0, data.daily_ai_limit - data.daily_ai_usage);
            document.getElementById('user-name-display').textContent = data.phone;
            document.getElementById('ai-used').textContent = data.daily_ai_usage;
            document.getElementById('ai-limit').textContent = data.daily_ai_limit >= 9999 ? '不限' : data.daily_ai_limit;
            // 更新个人中心
            document.getElementById('profile-username').textContent = data.phone;
            document.getElementById('profile-phone').textContent = data.phone;
            document.getElementById('profile-plan').textContent = data.plan_name;
            document.getElementById('profile-avatar').textContent = data.phone.charAt(0);
        }
    } catch (e) { /* 静默处理 */ }
}

// ==================== 数据看板 ====================
async function loadOverviewData() {
    try {
        const res = await fetch('/api/shop-data');
        const data = await res.json();
        if (data.success && data.data) {
            const ov = data.data.overview;
            document.getElementById('today-orders').textContent = ov.today_orders;
            document.getElementById('today-sales').textContent = '¥' + ov.today_sales.toLocaleString();
            document.getElementById('today-visitors').textContent = ov.visitors.toLocaleString();
            document.getElementById('order-change').textContent = (ov.order_change >= 0 ? '+' : '') + ov.order_change + '% 环比昨日';
            document.getElementById('sales-change').textContent = (ov.sales_change >= 0 ? '+' : '') + ov.sales_change + '% 环比昨日';
            document.getElementById('order-change').className = 'overview-card-change ' + (ov.order_change >= 0 ? 'up' : 'down');
            document.getElementById('sales-change').className = 'overview-card-change ' + (ov.sales_change >= 0 ? 'up' : 'down');
        }
    } catch (e) { /* 静默处理 */ }
}

// ==================== AI功能通用调用 ====================
async function callAIAPI(url, data, loadingText = 'AI正在生成中...') {
    showLoading(loadingText);
    try {
        const res = await fetch(url, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();
        hideLoading();
        return result;
    } catch (e) {
        hideLoading();
        showToast('网络错误，请稍后重试', 'error');
        return null;
    }
}

function handleAPIResult(result, resultId, successMsg = '生成成功！') {
    if (!result) return false;
    if (!result.success) {
        if (result.need_login) { showPage('login'); showToast('请先登录', 'warning'); }
        else if (result.need_upgrade) { showUpgradeModal(result.message); }
        else showToast(result.message || '生成失败', 'error');
        return false;
    }
    const el = document.getElementById(resultId);
    if (el) {
        // 使用textContent防止XSS，保留换行格式
        el.innerHTML = '';
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.wordBreak = 'break-word';
        pre.style.margin = '0';
        pre.style.fontFamily = 'inherit';
        pre.textContent = result.result;
        el.appendChild(pre);
    }
    showToast(successMsg + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo(); // 更新使用次数
    return true;
}

// ==================== 标题生成 ====================
async function generateTitle() {
    const product = document.getElementById('title-product').value.trim();
    if (!product) { showToast('请输入商品名称', 'warning'); return; }
    
    const data = {
        product_name: product,
        features: document.getElementById('title-features').value,
        platform: document.getElementById('title-platform').value,
        style: document.getElementById('title-style').value,
        word_count: document.getElementById('title-wordcount').value,
        audience: document.getElementById('title-audience').value
    };
    const result = await callAIAPI('/api/generate-title', data, '正在生成10组优质标题...');
    handleAPIResult(result, 'title-result', '标题生成成功！');
}

// ==================== 详情页生成 ====================
async function generateDetail() {
    const product = document.getElementById('detail-product').value.trim();
    const features = document.getElementById('detail-features').value.trim();
    if (!product || !features) { showToast('请填写商品名称和核心卖点', 'warning'); return; }
    
    const data = {
        product_name: product,
        features: features,
        params: document.getElementById('detail-params').value,
        platform: document.getElementById('detail-platform').value,
        style: document.getElementById('detail-style').value
    };
    const result = await callAIAPI('/api/generate-detail', data, '正在生成详情页全套文案...');
    handleAPIResult(result, 'detail-result', '详情文案生成成功！');
}

// ==================== 客服话术生成 ====================
async function generateService() {
    const question = document.getElementById('service-question').value.trim();
    if (!question) { showToast('请输入具体问题场景', 'warning'); return; }
    
    const data = {
        scenario: document.getElementById('service-scenario').value,
        question: question,
        style: document.getElementById('service-style').value
    };
    const result = await callAIAPI('/api/generate-service', data, '正在生成5套客服话术...');
    handleAPIResult(result, 'service-result', '话术生成成功！');
}

// ==================== 竞品分析 ====================
async function analyzeCompetitor() {
    const url = document.getElementById('competitor-url').value.trim();
    if (!url) { showToast('请输入竞品商品链接', 'warning'); return; }
    
    showLoading('正在智能爬取分析竞品数据...');
    try {
        const res = await fetch('/api/competitor-analysis', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({url})
        });
        const result = await res.json();
        hideLoading();
        
        if (!result.success) {
            if (result.need_upgrade) showUpgradeModal(result.message);
            else showToast(result.message || '分析失败', 'error');
            return;
        }
        
        renderCompetitorResult(result.data);
        showToast('竞品分析完成！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
        loadUserInfo();
    } catch (e) {
        hideLoading();
        showToast('网络错误', 'error');
    }
}

function renderCompetitorResult(data) {
    const container = document.getElementById('competitor-result');
    container.style.display = 'block';
    container.innerHTML = '';
    
    // 商品基本信息卡片
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
    
    // 评价关键词卡片
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
    
    // 促销活动卡片
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
    
    // AI总结卡片
    const card4 = document.createElement('div');
    card4.className = 'competitor-data-card';
    const summaryBox = document.createElement('div');
    summaryBox.className = 'ai-summary-box';
    const h4_summary = document.createElement('h4');
    h4_summary.textContent = '💡 AI竞品分析总结';
    summaryBox.appendChild(h4_summary);
    const summaryText = document.createElement('div');
    summaryText.className = 'result-text';
    summaryText.style.whiteSpace = 'pre-wrap';
    summaryText.textContent = data.ai_summary || '';
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
    btnCopy.onclick = copyCompetitorResult;
    btnDiv.appendChild(btnCopy);
    const btnExport = document.createElement('button');
    btnExport.className = 'btn btn-primary';
    btnExport.style.marginLeft = '12px';
    btnExport.textContent = '导出Excel';
    btnDiv.appendChild(btnExport);
    container.appendChild(btnDiv);
}

function copyCompetitorResult() {
    const text = document.getElementById('competitor-result').innerText;
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success'));
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
        }
    } catch (e) {
        hideLoading();
        showToast('加载失败', 'error');
    }
}

function renderShopData(data) {
    const container = document.getElementById('shop-data-content');
    container.innerHTML = '';
    const ov = data.overview || {};
    
    // 概览卡片
    const overviewCards = document.createElement('div');
    overviewCards.className = 'overview-cards';
    const cardData = [
        {icon: '👥', label: '访客数', value: (ov.visitors || 0).toLocaleString()},
        {icon: '📦', label: '订单量', value: ov.today_orders || 0},
        {icon: '💰', label: '销售额', value: '¥' + (ov.today_sales || 0).toLocaleString()},
        {icon: '📈', label: '转化率', value: (ov.conversion_rate || 0) + '%'}
    ];
    cardData.forEach(cd => {
        const card = document.createElement('div');
        card.className = 'overview-card';
        const icon = document.createElement('div');
        icon.className = 'overview-card-icon';
        icon.textContent = cd.icon;
        const info = document.createElement('div');
        info.className = 'overview-card-info';
        const label = document.createElement('div');
        label.className = 'overview-card-label';
        label.textContent = cd.label;
        const value = document.createElement('div');
        value.className = 'overview-card-value';
        value.textContent = cd.value;
        info.appendChild(label);
        info.appendChild(value);
        card.appendChild(icon);
        card.appendChild(info);
        overviewCards.appendChild(card);
    });
    container.appendChild(overviewCards);
    
    // 热销商品排行
    const card1 = document.createElement('div');
    card1.className = 'admin-card';
    const header1 = document.createElement('div');
    header1.className = 'card-header';
    const h3_1 = document.createElement('h3');
    h3_1.textContent = '热销商品排行';
    header1.appendChild(h3_1);
    card1.appendChild(header1);
    const productList = document.createElement('div');
    productList.style.padding = '16px 20px';
    (data.top_products || []).forEach((p, i) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.padding = '12px 0';
        row.style.borderBottom = '1px solid var(--border-light)';
        const rank = document.createElement('span');
        rank.style.width = '24px';
        rank.style.height = '24px';
        rank.style.borderRadius = '50%';
        rank.style.background = i < 3 ? 'var(--primary)' : 'var(--bg-tertiary)';
        rank.style.color = i < 3 ? '#fff' : 'var(--text-secondary)';
        rank.style.display = 'flex';
        rank.style.alignItems = 'center';
        rank.style.justifyContent = 'center';
        rank.style.fontSize = '12px';
        rank.style.fontWeight = '600';
        rank.style.marginRight = '12px';
        rank.textContent = i + 1;
        const name = document.createElement('span');
        name.style.flex = '1';
        name.style.fontSize = '14px';
        name.style.fontWeight = '500';
        name.textContent = p.name || '';
        const sales = document.createElement('span');
        sales.style.marginRight = '24px';
        sales.style.fontSize = '13px';
        sales.style.color = 'var(--text-secondary)';
        sales.textContent = '销量 ' + (p.sales || 0);
        const revenue = document.createElement('span');
        revenue.style.fontSize = '14px';
        revenue.style.fontWeight = '600';
        revenue.style.color = 'var(--primary)';
        revenue.textContent = '¥' + (p.revenue || 0).toLocaleString();
        const trend = document.createElement('span');
        trend.style.marginLeft = '12px';
        trend.style.fontSize = '16px';
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
    
    // 流量来源分析
    const card2 = document.createElement('div');
    card2.className = 'admin-card';
    const header2 = document.createElement('div');
    header2.className = 'card-header';
    const h3_2 = document.createElement('h3');
    h3_2.textContent = '流量来源分析';
    header2.appendChild(h3_2);
    card2.appendChild(header2);
    const trafficList = document.createElement('div');
    trafficList.style.padding = '16px 20px';
    (data.traffic_sources || []).forEach(s => {
        const item = document.createElement('div');
        item.style.marginBottom = '16px';
        const infoRow = document.createElement('div');
        infoRow.style.display = 'flex';
        infoRow.style.justifyContent = 'space-between';
        infoRow.style.marginBottom = '6px';
        infoRow.style.fontSize = '13px';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = s.name || '';
        const percentSpan = document.createElement('span');
        percentSpan.textContent = (s.percent || 0) + '% (' + (s.visitors || 0) + '人)';
        infoRow.appendChild(nameSpan);
        infoRow.appendChild(percentSpan);
        const barBg = document.createElement('div');
        barBg.style.height = '8px';
        barBg.style.background = 'var(--bg-tertiary)';
        barBg.style.borderRadius = '4px';
        barBg.style.overflow = 'hidden';
        const barFill = document.createElement('div');
        barFill.style.height = '100%';
        barFill.style.width = (s.percent || 0) + '%';
        barFill.style.background = 'var(--primary)';
        barFill.style.borderRadius = '4px';
        barBg.appendChild(barFill);
        item.appendChild(infoRow);
        item.appendChild(barBg);
        trafficList.appendChild(item);
    });
    card2.appendChild(trafficList);
    container.appendChild(card2);
    
    // 数据异常预警
    const card3 = document.createElement('div');
    card3.className = 'admin-card';
    const header3 = document.createElement('div');
    header3.className = 'card-header';
    const h3_3 = document.createElement('h3');
    h3_3.textContent = '⚠️ 数据异常预警';
    header3.appendChild(h3_3);
    card3.appendChild(header3);
    const alertList = document.createElement('div');
    alertList.className = 'alert-list';
    (data.alerts || []).forEach(a => {
        const alertItem = document.createElement('div');
        alertItem.className = 'alert-item ' + (a.type || 'info');
        const icon = document.createElement('span');
        icon.className = 'alert-icon';
        icon.textContent = a.type === 'warning' ? '⚠️' : a.type === 'danger' ? '🔴' : 'ℹ️';
        const text = document.createElement('span');
        text.className = 'alert-text';
        text.textContent = a.message || '';
        const time = document.createElement('span');
        time.className = 'alert-time';
        time.textContent = a.time || '';
        alertItem.appendChild(icon);
        alertItem.appendChild(text);
        alertItem.appendChild(time);
        alertList.appendChild(alertItem);
    });
    card3.appendChild(alertList);
    container.appendChild(card3);
}

// ==================== AI运营诊断 ====================
async function runDiagnosis() {
    const result = await callAIAPI('/api/operation-diagnosis', {}, 'AI正在深度诊断店铺运营...');
    if (!result) return;
    if (!result.success) {
        if (result.need_upgrade) showUpgradeModal(result.message);
        else showToast(result.message || '诊断失败', 'error');
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
    resultText.style.whiteSpace = 'pre-wrap';
    resultText.textContent = result.result || '';
    summaryBox.appendChild(h4);
    summaryBox.appendChild(resultText);
    card.appendChild(summaryBox);
    container.appendChild(card);
    const btnDiv = document.createElement('div');
    btnDiv.style.textAlign = 'center';
    btnDiv.style.marginBottom = '20px';
    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn btn-outline';
    btnCopy.textContent = '复制诊断报告';
    btnCopy.onclick = () => copyResult('diagnosis-result');
    const btnExport = document.createElement('button');
    btnExport.className = 'btn btn-primary';
    btnExport.style.marginLeft = '12px';
    btnExport.textContent = '导出PDF';
    btnDiv.appendChild(btnCopy);
    btnDiv.appendChild(btnExport);
    container.appendChild(btnDiv);
    showToast('诊断完成！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo();
}

// ==================== 报表生成 ====================
async function generateReport() {
    const reportType = document.getElementById('report-type').value;
    const result = await callAIAPI('/api/generate-report', {report_type: reportType}, '正在生成专业运营报表...');
    if (!result) return;
    if (!result.success) {
        if (result.need_upgrade) showUpgradeModal(result.message);
        else showToast(result.message || '生成失败', 'error');
        return;
    }
    const container = document.getElementById('report-result');
    container.style.display = 'block';
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'competitor-data-card';
    const summaryBox = document.createElement('div');
    summaryBox.className = 'ai-summary-box';
    const h4 = document.createElement('h4');
    h4.textContent = '📋 ' + (reportType === 'weekly' ? '运营周报' : '运营月报');
    const resultText = document.createElement('div');
    resultText.className = 'result-text';
    resultText.style.whiteSpace = 'pre-wrap';
    resultText.textContent = result.result || '';
    summaryBox.appendChild(h4);
    summaryBox.appendChild(resultText);
    card.appendChild(summaryBox);
    container.appendChild(card);
    const btnDiv = document.createElement('div');
    btnDiv.style.textAlign = 'center';
    btnDiv.style.marginBottom = '20px';
    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn btn-outline';
    btnCopy.textContent = '复制报表';
    btnCopy.onclick = () => copyResult('report-result');
    const btnWord = document.createElement('button');
    btnWord.className = 'btn btn-primary';
    btnWord.style.marginLeft = '12px';
    btnWord.textContent = '导出Word';
    const btnPdf = document.createElement('button');
    btnPdf.className = 'btn btn-outline';
    btnPdf.style.marginLeft = '12px';
    btnPdf.textContent = '导出PDF';
    btnDiv.appendChild(btnCopy);
    btnDiv.appendChild(btnWord);
    btnDiv.appendChild(btnPdf);
    container.appendChild(btnDiv);
    showToast('报表生成成功！' + (result.demo_mode ? '（演示模式）' : ''), 'success');
    loadUserInfo();
}

// ==================== 店铺绑定 ====================
async function bindShop() {
    const platform = document.getElementById('bind-platform').value;
    const shopName = document.getElementById('bind-shop-name').value.trim();
    const authCode = document.getElementById('bind-auth-code').value.trim();
    
    if (!shopName || !authCode) { showToast('请填写完整信息', 'warning'); return; }
    
    showLoading('正在绑定店铺...');
    try {
        const res = await fetch('/api/bind-shop', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({platform, shop_name: shopName, auth_code: authCode})
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            showToast('店铺绑定成功！', 'success');
            document.getElementById('bind-shop-name').value = '';
            document.getElementById('bind-auth-code').value = '';
            await loadBoundShops();
        } else {
            if (data.need_upgrade) showUpgradeModal(data.message);
            else showToast(data.message || '绑定失败', 'error');
        }
    } catch (e) { hideLoading(); showToast('网络错误', 'error'); }
}

async function loadBoundShops() {
    const container = document.getElementById('bound-shops-list');
    container.innerHTML = '';
    try {
        const res = await fetch('/api/shop-list');
        const data = await res.json();
        if (data.success && data.shops && data.shops.length > 0) {
            data.shops.forEach(s => {
                const shopItem = document.createElement('div');
                shopItem.className = 'shop-item';
                const info = document.createElement('div');
                info.className = 'shop-item-info';
                const platform = document.createElement('div');
                platform.className = 'shop-platform';
                platform.textContent = '🏪';
                const detail = document.createElement('div');
                const name = document.createElement('div');
                name.className = 'shop-name';
                name.textContent = s.shop_name || '';
                const status = document.createElement('div');
                status.className = 'shop-status';
                status.textContent = '● ' + (s.platform || '') + ' | 已绑定 | 数据同步中';
                detail.appendChild(name);
                detail.appendChild(status);
                info.appendChild(platform);
                info.appendChild(detail);
                const unbindBtn = document.createElement('button');
                unbindBtn.className = 'btn btn-outline btn-sm';
                unbindBtn.textContent = '解绑';
                unbindBtn.onclick = () => unbindShop(s.id);
                shopItem.appendChild(info);
                shopItem.appendChild(unbindBtn);
                container.appendChild(shopItem);
            });
        } else {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = '暂无绑定店铺，请先绑定店铺';
            container.appendChild(empty);
        }
    } catch (e) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = '加载店铺列表失败';
        container.appendChild(empty);
    }
}

async function unbindShop(shopId) {
    if (!confirm('确定要解绑该店铺吗？')) return;
    try {
        const res = await fetch('/api/unbind-shop', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
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
async function upgradePlan(plan) {
    showLoading('正在处理升级...');
    try {
        const res = await fetch('/api/upgrade-plan', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({plan})
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            showToast('已升级为' + data.message.replace('已升级为', ''), 'success');
            loadUserInfo();
        } else {
            showToast(data.message || '升级失败', 'error');
        }
    } catch (e) { hideLoading(); showToast('网络错误', 'error'); }
}

// ==================== 弹窗控制 ====================
function showUpgradeModal(message) {
    document.getElementById('modal-title').textContent = '升级会员';
    document.getElementById('modal-message').innerHTML = message + '<br><br>升级后可解锁全部高级功能，不限次数使用！';
    document.getElementById('modal-confirm-btn').textContent = '立即升级';
    document.getElementById('modal-confirm-btn').onclick = () => { closeModal(); switchAdminPage('pricing-admin'); };
    document.getElementById('modal-overlay').classList.add('active');
}

function showModal(title, message) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm-btn').textContent = '确定';
    document.getElementById('modal-confirm-btn').onclick = closeModal;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// ==================== 工具函数 ====================
function showLoading(text = 'AI正在生成中...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function copyResult(elementId) {
    const el = document.getElementById(elementId);
    const text = el.innerText || el.textContent;
    if (!text || text.includes('填写左侧') || text.includes('点击生成')) {
        showToast('暂无内容可复制', 'warning');
        return;
    }
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success'))
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('已复制到剪贴板', 'success');
        });
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 检查登录状态
    fetch('/api/user-info').then(r => r.json()).then(data => {
        if (data.logged_in && currentPage === 'landing') {
            // 已登录停留在首页也可以，不强制跳转
        }
    });
});
