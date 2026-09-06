// ========== 全局变量 ==========
let usageCount = 0;
const MAX_USAGE = 10;

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    checkHealth();
});

// ========== Tab切换 ==========
function initTabs() {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabContents = document.querySelectorAll('.tab-content');

    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');

            // 切换菜单激活状态
            menuItems.forEach(m => m.classList.remove('active'));
            this.classList.add('active');

            // 切换内容显示
            tabContents.forEach(c => c.classList.remove('active'));
            document.getElementById('tab-' + tab).classList.add('active');
        });
    });
}

// ========== 健康检查 ==========
function checkHealth() {
    fetch('/api/health')
        .then(res => res.json())
        .then(data => {
            const badge = document.getElementById('demoBadge');
            if (data.demo_mode) {
                badge.style.display = 'inline-block';
                badge.textContent = '演示模式';
            } else {
                badge.style.display = 'none';
            }
        })
        .catch(err => console.error('健康检查失败:', err));
}

// ========== 通用API调用 ==========
function callAPI(url, data, resultId, resultTextId) {
    // 检查使用次数
    if (usageCount >= MAX_USAGE) {
        showToast('今日使用次数已达上限，请升级专业版', 'error');
        return;
    }

    // 显示加载
    showLoading();

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
        hideLoading();

        if (result.result) {
            // 显示结果
            const resultCard = document.getElementById(resultId);
            const resultText = document.getElementById(resultTextId);
            resultText.textContent = result.result;
            resultCard.style.display = 'block';

            // 滚动到结果
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // 更新使用次数
            usageCount++;
            updateUsage();

            // 演示模式提示
            if (result.demo_mode) {
                showToast('当前为演示模式，配置API密钥后可生成真实内容', 'success');
            } else {
                showToast('生成成功！', 'success');
            }
        } else {
            showToast('生成失败，请重试', 'error');
        }
    })
    .catch(err => {
        hideLoading();
        console.error('API调用失败:', err);
        showToast('网络错误，请检查连接后重试', 'error');
    });
}

// ========== 商品标题生成 ==========
function generateTitle() {
    const productName = document.getElementById('title-product').value.trim();
    if (!productName) {
        showToast('请输入商品名称', 'error');
        return;
    }

    const data = {
        product_name: productName,
        category: document.getElementById('title-category').value,
        features: document.getElementById('title-features').value,
        platform: document.getElementById('title-platform').value
    };

    callAPI('/api/generate-title', data, 'title-result', 'title-result-text');
}

// ========== 详情页文案生成 ==========
function generateDetail() {
    const productName = document.getElementById('detail-product').value.trim();
    if (!productName) {
        showToast('请输入商品名称', 'error');
        return;
    }

    const data = {
        product_name: productName,
        category: document.getElementById('detail-category').value,
        features: document.getElementById('detail-features').value,
        price: document.getElementById('detail-price').value,
        target_audience: document.getElementById('detail-audience').value
    };

    callAPI('/api/generate-detail', data, 'detail-result', 'detail-result-text');
}

// ========== 客服话术生成 ==========
function generateService() {
    const productName = document.getElementById('service-product').value.trim();
    if (!productName) {
        showToast('请输入商品名称', 'error');
        return;
    }

    const data = {
        product_name: productName,
        category: document.getElementById('service-category').value,
        common_questions: document.getElementById('service-questions').value,
        style: document.getElementById('service-style').value
    };

    callAPI('/api/generate-customer-service', data, 'service-result', 'service-result-text');
}

// ========== 运营建议生成 ==========
function generateOperation() {
    const data = {
        shop_name: document.getElementById('op-shop').value,
        platform: document.getElementById('op-platform').value,
        daily_visitors: document.getElementById('op-visitors').value,
        conversion_rate: document.getElementById('op-conversion').value,
        avg_order_value: document.getElementById('op-order-value').value,
        monthly_sales: document.getElementById('op-sales').value,
        main_products: document.getElementById('op-products').value,
        problems: document.getElementById('op-problems').value
    };

    callAPI('/api/generate-operation-advice', data, 'operation-result', 'operation-result-text');
}

// ========== 复制结果 ==========
function copyResult(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(() => {
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制到剪贴板', 'success');
    });
}

// ========== 使用次数更新 ==========
function updateUsage() {
    document.getElementById('usageCount').textContent = usageCount;
    const percent = (usageCount / MAX_USAGE) * 100;
    document.getElementById('usageBar').style.width = percent + '%';
}

// ========== 加载状态 ==========
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// ========== Toast提示 ==========
let toastTimer = null;
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// ========== 回车键触发生成 ==========
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
        const activeTab = document.querySelector('.tab-content.active').id;
        if (activeTab === 'tab-title') generateTitle();
        else if (activeTab === 'tab-detail') generateDetail();
        else if (activeTab === 'tab-service') generateService();
        else if (activeTab === 'tab-operation') generateOperation();
    }
});
