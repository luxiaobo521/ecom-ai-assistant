// ==================== 全局状态 ====================
let currentPage = 'landing';
let currentAdminPage = 'overview';
let userInfo = null;

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
            setTimeout(() => showPage('dashboard'), 500);
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
            setTimeout(() => showPage('dashboard'), 500);
        } else {
            showToast(data.message || '注册失败', 'error');
        }
    } catch (e) { hideLoading(); showToast('网络错误', 'error'); }
}

async function handleLogout() {
    try {
        await fetch('/logout');
        showToast('已退出登录', 'success');
        setTimeout(() => showPage('landing'), 300);
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
    } catch (e) { console.error('加载用户信息失败', e); }
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
    } catch (e) { console.error('加载看板数据失败', e); }
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
    if (el) el.innerHTML = '<div class="result-text">' + result.result + '</div>';
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
    container.innerHTML = `
        <div class="competitor-data-card">
            <h3>📦 ${data.product_name}</h3>
            <div class="data-grid">
                <div class="data-item"><div class="data-item-label">当前售价</div><div class="data-item-value">¥${data.current_price}</div></div>
                <div class="data-item"><div class="data-item-label">原价</div><div class="data-item-value">¥${data.original_price}</div></div>
                <div class="data-item"><div class="data-item-label">月销量</div><div class="data-item-value">${data.monthly_sales}+</div></div>
                <div class="data-item"><div class="data-item-label">好评率</div><div class="data-item-value">${data.reviews.good_rate}%</div></div>
            </div>
        </div>
        <div class="competitor-data-card">
            <h3>👍 好评关键词</h3>
            <div class="tag-list">${data.reviews.good_keywords.map(k => '<span class="tag-item">' + k + '</span>').join('')}</div>
            <h3 style="margin-top:20px">👎 差评痛点</h3>
            <div class="tag-list">${data.reviews.bad_keywords.map(k => '<span class="tag-item bad">' + k + '</span>').join('')}</div>
        </div>
        <div class="competitor-data-card">
            <h3>🎯 当前促销活动</h3>
            <div class="tag-list">${data.promotions.current.map(p => '<span class="tag-item">' + p + '</span>').join('')}</div>
            <p style="margin-top:12px;font-size:13px;color:var(--text-secondary)">优惠券：${data.promotions.coupon} | 策略：${data.promotions.strategy}</p>
        </div>
        <div class="competitor-data-card">
            <div class="ai-summary-box">
                <h4>💡 AI竞品分析总结</h4>
                <div class="result-text">${data.ai_summary}</div>
            </div>
        </div>
        <div style="text-align:center;margin-bottom:20px">
            <button class="btn btn-outline" onclick="copyCompetitorResult()">复制分析报告</button>
            <button class="btn btn-primary" style="margin-left:12px">导出Excel</button>
        </div>
    `;
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
    const ov = data.overview;
    container.innerHTML = `
        <div class="overview-cards">
            <div class="overview-card"><div class="overview-card-icon">👥</div><div class="overview-card-info"><div class="overview-card-label">访客数</div><div class="overview-card-value">${ov.visitors.toLocaleString()}</div></div></div>
            <div class="overview-card"><div class="overview-card-icon">📦</div><div class="overview-card-info"><div class="overview-card-label">订单量</div><div class="overview-card-value">${ov.today_orders}</div></div></div>
            <div class="overview-card"><div class="overview-card-icon">💰</div><div class="overview-card-info"><div class="overview-card-label">销售额</div><div class="overview-card-value">¥${ov.today_sales.toLocaleString()}</div></div></div>
            <div class="overview-card"><div class="overview-card-icon">📈</div><div class="overview-card-info"><div class="overview-card-label">转化率</div><div class="overview-card-value">${ov.conversion_rate}%</div></div></div>
        </div>
        <div class="admin-card">
            <div class="card-header"><h3>热销商品排行</h3></div>
            <div style="padding:16px 20px">
                ${data.top_products.map((p, i) => `
                    <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-light)">
                        <span style="width:24px;height:24px;border-radius:50%;background:${i<3?'var(--primary)':'var(--bg-tertiary)'};color:${i<3?'#fff':'var(--text-secondary)'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;margin-right:12px">${i+1}</span>
                        <span style="flex:1;font-size:14px;font-weight:500">${p.name}</span>
                        <span style="margin-right:24px;font-size:13px;color:var(--text-secondary)">销量 ${p.sales}</span>
                        <span style="font-size:14px;font-weight:600;color:var(--primary)">¥${p.revenue.toLocaleString()}</span>
                        <span style="margin-left:12px;font-size:16px">${p.trend === 'up' ? '📈' : '📉'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="admin-card">
            <div class="card-header"><h3>流量来源分析</h3></div>
            <div style="padding:16px 20px">
                ${data.traffic_sources.map(s => `
                    <div style="margin-bottom:16px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
                            <span>${s.name}</span><span>${s.percent}% (${s.visitors}人)</span>
                        </div>
                        <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
                            <div style="height:100%;width:${s.percent}%;background:var(--primary);border-radius:4px"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="admin-card">
            <div class="card-header"><h3>⚠️ 数据异常预警</h3></div>
            <div class="alert-list">
                ${data.alerts.map(a => `<div class="alert-item ${a.type}"><span class="alert-icon">${a.type === 'warning' ? '⚠️' : a.type === 'danger' ? '🔴' : 'ℹ️'}</span><span class="alert-text">${a.message}</span><span class="alert-time">${a.time}</span></div>`).join('')}
            </div>
        </div>
    `;
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
    container.innerHTML = `
        <div class="competitor-data-card">
            <div class="ai-summary-box">
                <h4>💡 AI智能运营诊断报告</h4>
                <div class="result-text">${result.result}</div>
            </div>
        </div>
        <div style="text-align:center;margin-bottom:20px">
            <button class="btn btn-outline" onclick="copyResult('diagnosis-result')">复制诊断报告</button>
            <button class="btn btn-primary" style="margin-left:12px">导出PDF</button>
        </div>
    `;
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
    container.innerHTML = `
        <div class="competitor-data-card">
            <div class="ai-summary-box">
                <h4>📋 ${reportType === 'weekly' ? '运营周报' : '运营月报'}</h4>
                <div class="result-text">${result.result}</div>
            </div>
        </div>
        <div style="text-align:center;margin-bottom:20px">
            <button class="btn btn-outline" onclick="copyResult('report-result')">复制报表</button>
            <button class="btn btn-primary" style="margin-left:12px">导出Word</button>
            <button class="btn btn-outline" style="margin-left:12px">导出PDF</button>
        </div>
    `;
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
            loadBoundShops();
        } else {
            if (data.need_upgrade) showUpgradeModal(data.message);
            else showToast(data.message || '绑定失败', 'error');
        }
    } catch (e) { hideLoading(); showToast('网络错误', 'error'); }
}

async function loadBoundShops() {
    // 简化：从用户信息获取
    const res = await fetch('/api/user-info');
    const data = await res.json();
    const container = document.getElementById('bound-shops-list');
    if (data.bound_shops && data.bound_shops.length > 0) {
        container.innerHTML = data.bound_shops.map(s => `
            <div class="shop-item">
                <div class="shop-item-info">
                    <div class="shop-platform">🏪</div>
                    <div>
                        <div class="shop-name">${s.shop_name}</div>
                        <div class="shop-status">● ${s.platform} | 已绑定 | 数据同步中</div>
                    </div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="unbindShop('${s.id}')">解绑</button>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<div class="empty-state">暂无绑定店铺，请先绑定店铺</div>';
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
    console.log('电商AI运营助手 v3.0 已加载');
});
