/* ==================== 电商AI运营助手 - 管理后台 JS v1.0 ==================== */

var currentPage = 'dashboard';
var currentUserPage = 1;
var currentOrderPage = 1;
var currentContentPage = 1;
var currentFeedbackPage = 1;
var currentLogPage = 1;
var replyFeedbackId = '';

// 页面标题映射
var pageTitles = {
  dashboard: { title: '数据总览', subtitle: '实时监控网站运营数据' },
  users: { title: '用户管理', subtitle: '管理所有注册用户' },
  orders: { title: '订单管理', subtitle: '查看和处理所有订单' },
  content: { title: '内容审核', subtitle: '审核用户AI生成内容' },
  feedbacks: { title: '反馈管理', subtitle: '处理用户反馈和建议' },
  push: { title: '消息推送', subtitle: '向用户发送系统通知' },
  settings: { title: '系统设置', subtitle: '配置网站参数和功能开关' },
  logs: { title: '操作日志', subtitle: '查看管理员操作记录' }
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
  // 隐藏加载动画
  setTimeout(function() {
    var loader = document.getElementById('pageLoader');
    if (loader) loader.classList.add('hidden');
  }, 500);

  // 检查登录状态
  checkAdminLogin();

  // 更新时间
  updateTime();
  setInterval(updateTime, 1000);

  // 回车登录
  var pwdInput = document.getElementById('adminPassword');
  if (pwdInput) {
    pwdInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') adminLogin();
    });
  }
});

function updateTime() {
  var el = document.getElementById('currentTime');
  if (el) {
    var now = new Date();
    el.textContent = now.toLocaleString('zh-CN', { hour12: false });
  }
}

// ==================== 登录相关 ====================
function checkAdminLogin() {
  fetch('/api/admin/info')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.logged_in) {
        showMainApp(data.username);
      } else {
        showLoginPage();
      }
    })
    .catch(function() { showLoginPage(); });
}

function showLoginPage() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function showMainApp(username) {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  if (username) document.getElementById('adminNameDisplay').textContent = username;
  loadDashboard();
}

function adminLogin() {
  var username = document.getElementById('adminUsername').value.trim();
  var password = document.getElementById('adminPassword').value;

  if (!username || !password) {
    showToast('error', '请输入账号和密码');
    return;
  }

  var btn = document.getElementById('adminLoginBtn');
  btn.textContent = '登录中...';
  btn.disabled = true;

  fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.textContent = '登 录';
    btn.disabled = false;
    if (data.success) {
      showToast('success', '登录成功，欢迎回来！');
      setTimeout(function() { showMainApp(data.username); }, 500);
    } else {
      showToast('error', data.message || '登录失败');
      shakeElement('adminPassword');
    }
  })
  .catch(function() {
    btn.textContent = '登 录';
    btn.disabled = false;
    showToast('error', '网络错误，请重试');
  });
}

function adminLogout() {
  if (!confirm('确定要退出登录吗？')) return;
  fetch('/api/admin/logout', { method: 'POST' })
    .then(function() {
      showToast('success', '已退出登录');
      setTimeout(function() { showLoginPage(); }, 500);
    })
    .catch(function() { showLoginPage(); });
}

// ==================== 页面切换 ====================
function switchPage(page, el) {
  currentPage = page;
  // 更新侧边栏激活状态
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.classList.remove('active');
  });
  if (el) el.classList.add('active');

  // 更新页面标题
  var titleInfo = pageTitles[page] || { title: page, subtitle: '' };
  document.getElementById('currentPageTitle').textContent = titleInfo.title;
  document.getElementById('currentPageSubtitle').textContent = titleInfo.subtitle;

  // 切换页面内容
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });
  var targetPage = document.getElementById('page-' + page);
  if (targetPage) targetPage.classList.add('active');

  // 加载对应页面数据
  if (page === 'dashboard') loadDashboard();
  else if (page === 'users') loadUsers();
  else if (page === 'orders') loadOrders();
  else if (page === 'content') loadContent();
  else if (page === 'feedbacks') loadFeedbacks();
  else if (page === 'settings') loadSettings();
  else if (page === 'logs') loadLogs();
}

// ==================== 数据总览 ====================
function loadDashboard() {
  fetch('/api/admin/dashboard')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) return;
      var stats = data.stats;

      // 更新统计卡片
      document.getElementById('statTotalUsers').textContent = stats.total_users.toLocaleString();
      document.getElementById('statTodayNew').textContent = '今日新增 +' + stats.today_new_users;
      document.getElementById('statTotalRevenue').textContent = '¥' + stats.total_revenue.toLocaleString();
      document.getElementById('statTodayRevenue').textContent = '今日收入 ¥' + stats.today_revenue.toLocaleString();
      document.getElementById('statPaidUsers').textContent = stats.paid_users.toLocaleString();
      document.getElementById('statPaidRate').textContent = '付费率 ' + stats.paid_rate + '%';
      document.getElementById('statAiCalls').textContent = stats.total_ai_calls.toLocaleString();
      document.getElementById('statActiveUsers').textContent = '活跃用户 ' + stats.active_users.toLocaleString();

      // 更新侧边栏徽章
      document.getElementById('userCountBadge').textContent = stats.total_users > 999 ? '999+' : stats.total_users;
      document.getElementById('feedbackBadge').textContent = stats.pending_feedbacks;
      document.getElementById('feedbackBadge').style.display = stats.pending_feedbacks > 0 ? 'inline-block' : 'none';

      // 渲染用户增长图表
      renderBarChart('userGrowthChart', data.user_growth, 'count', '#6366F1');
      // 渲染收入趋势图表
      renderBarChart('revenueChart', data.revenue_trend, 'revenue', '#10B981', true);

      // 渲染会员分布
      renderPlanDistribution(data.plan_distribution);

      // 更新网站状态
      updateSiteStatus(data.site_status);
    })
    .catch(function() { showToast('error', '加载数据失败'); });
}

function renderBarChart(containerId, data, valueKey, color, isMoney) {
  var container = document.getElementById(containerId);
  if (!container || !data || data.length === 0) return;

  var maxValue = Math.max.apply(null, data.map(function(d) { return d[valueKey] || 0; }));
  if (maxValue === 0) maxValue = 1;

  var html = '';
  data.forEach(function(d) {
    var value = d[valueKey] || 0;
    var heightPercent = (value / maxValue) * 80 + 5;
    var displayValue = isMoney ? '¥' + value : value;
    html += '<div class="chart-bar-group">' +
      '<div class="chart-bar ' + (isMoney ? 'revenue-bar' : '') + '" style="height:' + heightPercent + '%;">' +
      (value > 0 ? '<span class="chart-bar-value">' + displayValue + '</span>' : '') +
      '</div>' +
      '<span class="chart-bar-label">' + d.date + '</span>' +
      '</div>';
  });
  container.innerHTML = html;
}

function renderPlanDistribution(distribution) {
  var container = document.getElementById('planDistribution');
  if (!container) return;
  var colors = { free: '#9CA3AF', pro: '#6366F1', ultimate: '#F59E0B', enterprise: '#EC4899' };
  var total = 0;
  for (var key in distribution) { total += distribution[key].count; }
  if (total === 0) total = 1;

  var html = '';
  for (var planKey in distribution) {
    var item = distribution[planKey];
    var percent = (item.count / total * 100).toFixed(1);
    html += '<div class="plan-item">' +
      '<span class="plan-name">' + item.name + '</span>' +
      '<div class="plan-bar-bg"><div class="plan-bar" style="width:' + percent + '%;background:' + colors[planKey] + ';">' + percent + '%</div></div>' +
      '<span class="plan-count">' + item.count + '人</span>' +
      '</div>';
  }
  container.innerHTML = html;
}

function updateSiteStatus(status) {
  var badge = document.getElementById('siteStatusBadge');
  if (!badge) return;
  var statusMap = {
    online: { dot: 'status-online', text: '网站正常' },
    maintenance: { dot: 'status-maintenance', text: '维护中' },
    offline: { dot: 'status-offline', text: '暂停服务' }
  };
  var info = statusMap[status] || statusMap.online;
  badge.innerHTML = '<span class="status-dot ' + info.dot + '"></span> ' + info.text;
}

// ==================== 用户管理 ====================
function loadUsers() {
  var search = document.getElementById('userSearch').value.trim();
  var plan = document.getElementById('userPlanFilter').value;
  var status = document.getElementById('userStatusFilter').value;

  var url = '/api/admin/users?page=' + currentUserPage + '&page_size=20';
  if (search) url += '&search=' + encodeURIComponent(search);
  if (plan) url += '&plan=' + plan;
  if (status) url += '&status=' + status;

  fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) return;
      renderUserTable(data.users);
      document.getElementById('userResultCount').textContent = '共 ' + data.total + ' 条';
      renderPagination('userPagination', data.total, data.page, data.total_pages, function(p) {
        currentUserPage = p;
        loadUsers();
      });
    })
    .catch(function() { showToast('error', '加载用户列表失败'); });
}

function renderUserTable(users) {
  var tbody = document.getElementById('userTableBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">暂无用户数据</td></tr>';
    return;
  }

  var planTagClass = { free: 'tag-free', pro: 'tag-pro', ultimate: 'tag-ultimate', enterprise: 'tag-enterprise' };
  var html = '';
  users.forEach(function(user) {
    var statusTag = user.disabled ?
      '<span class="tag tag-danger">已禁用</span>' :
      '<span class="tag tag-success">正常</span>';
    var created = user.created_at ? new Date(user.created_at * 1000).toLocaleDateString('zh-CN') : '-';
    var lastLogin = user.last_login ? new Date(user.last_login * 1000).toLocaleString('zh-CN', { hour12: false }) : '从未登录';

    html += '<tr>' +
      '<td><strong>' + user.phone_masked + '</strong></td>' +
      '<td>' + escapeHtml(user.nickname || '-') + '</td>' +
      '<td><span class="tag ' + (planTagClass[user.plan] || 'tag-free') + '">' + user.plan_name + '</span></td>' +
      '<td>' + user.bound_shops + '</td>' +
      '<td>' + user.ai_history_count + '</td>' +
      '<td>' + created + '</td>' +
      '<td style="font-size:12px;">' + lastLogin + '</td>' +
      '<td>' + statusTag + '</td>' +
      '<td><div class="action-btns">' +
      '<button class="btn-action" onclick="viewUserDetail(\'' + user.phone + '\')">详情</button>' +
      (user.disabled ?
        '<button class="btn-action btn-success" onclick="enableUser(\'' + user.phone + '\')">启用</button>' :
        '<button class="btn-action btn-warning" onclick="disableUser(\'' + user.phone + '\')">禁用</button>') +
      '<button class="btn-action" onclick="resetUserPassword(\'' + user.phone + '\')">重置密码</button>' +
      '<button class="btn-action btn-danger" onclick="deleteUser(\'' + user.phone + '\')">删除</button>' +
      '</div></td></tr>';
  });
  tbody.innerHTML = html;
}

function viewUserDetail(phone) {
  fetch('/api/admin/users/' + encodeURIComponent(phone))
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) { showToast('error', data.message || '加载失败'); return; }
      var user = data.user;
      var html = '<div class="user-detail-section"><h4>📋 基本信息</h4><div class="detail-grid">' +
        '<div class="detail-item"><span class="detail-label">手机号：</span><span class="detail-value">' + phone + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">昵称：</span><span class="detail-value">' + escapeHtml(user.nickname || '-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">邮箱：</span><span class="detail-value">' + escapeHtml(user.email || '-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">城市：</span><span class="detail-value">' + escapeHtml(user.city || '-') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">套餐：</span><span class="detail-value">' + (user.plan || 'free') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">注册时间：</span><span class="detail-value">' + new Date((user.created_at || 0) * 1000).toLocaleString('zh-CN') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">最后登录：</span><span class="detail-value">' + new Date((user.last_login || 0) * 1000).toLocaleString('zh-CN') + '</span></div>' +
        '<div class="detail-item"><span class="detail-label">状态：</span><span class="detail-value">' + (user.disabled ? '已禁用' : '正常') + '</span></div>' +
        '</div></div>';

      html += '<div class="user-detail-section"><h4>📊 使用数据</h4><div class="detail-grid">' +
        '<div class="detail-item"><span class="detail-label">绑定店铺：</span><span class="detail-value">' + (user.bound_shops || []).length + ' 个</span></div>' +
        '<div class="detail-item"><span class="detail-label">AI生成次数：</span><span class="detail-value">' + (user.ai_history || []).length + ' 次</span></div>' +
        '<div class="detail-item"><span class="detail-label">今日AI使用：</span><span class="detail-value">' + (user.daily_ai_usage || 0) + ' 次</span></div>' +
        '<div class="detail-item"><span class="detail-label">邀请人数：</span><span class="detail-value">' + (user.total_invited || 0) + ' 人</span></div>' +
        '</div></div>';

      if (data.orders && data.orders.length > 0) {
        html += '<div class="user-detail-section"><h4>🧾 订单记录（' + data.orders.length + '）</h4>';
        data.orders.slice(0, 5).forEach(function(o) {
          html += '<div style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;display:flex;justify-content:space-between;">' +
            '<span>' + o.id + ' · ' + (o.plan_name || o.plan) + '</span>' +
            '<span><strong>¥' + o.final_price + '</strong> <span class="tag tag-' + (o.status === 'paid' ? 'success' : o.status === 'pending' ? 'warning' : 'danger') + '" style="margin-left:8px;">' + o.status + '</span></span>' +
            '</div>';
        });
        html += '</div>';
      }

      document.getElementById('userDetailContent').innerHTML = html;
      openModal('userDetailModal');
    })
    .catch(function() { showToast('error', '加载用户详情失败'); });
}

function disableUser(phone) {
  if (!confirm('确定要禁用该用户吗？禁用后用户将无法登录。')) return;
  fetch('/api/admin/users/' + encodeURIComponent(phone) + '/disable', { method: 'POST' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) { showToast('success', '用户已禁用'); loadUsers(); }
      else showToast('error', data.message || '操作失败');
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function enableUser(phone) {
  fetch('/api/admin/users/' + encodeURIComponent(phone) + '/enable', { method: 'POST' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) { showToast('success', '用户已启用'); loadUsers(); }
      else showToast('error', data.message || '操作失败');
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function resetUserPassword(phone) {
  var newPwd = prompt('请输入新密码（默认：Reset123456）：', 'Reset123456');
  if (newPwd === null) return;
  if (!newPwd) newPwd = 'Reset123456';

  fetch('/api/admin/users/' + encodeURIComponent(phone) + '/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: newPwd })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      showToast('success', '密码已重置为：' + data.new_password);
    } else {
      showToast('error', data.message || '操作失败');
    }
  })
  .catch(function() { showToast('error', '网络错误'); });
}

function deleteUser(phone) {
  if (!confirm('⚠️ 确定要删除该用户吗？此操作不可恢复，用户所有数据将被永久删除！')) return;
  fetch('/api/admin/users/' + encodeURIComponent(phone), { method: 'DELETE' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) { showToast('success', '用户已删除'); loadUsers(); }
      else showToast('error', data.message || '操作失败');
    })
    .catch(function() { showToast('error', '网络错误'); });
}

// ==================== 订单管理 ====================
function loadOrders() {
  var search = document.getElementById('orderSearch').value.trim();
  var status = document.getElementById('orderStatusFilter').value;

  var url = '/api/admin/orders?page=' + currentOrderPage + '&page_size=20';
  if (search) url += '&search=' + encodeURIComponent(search);
  if (status) url += '&status=' + status;

  fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) return;
      renderOrderTable(data.orders);
      if (data.summary) {
        document.getElementById('orderTotalCount').textContent = data.summary.total_count;
        document.getElementById('orderTotalRevenue').textContent = '¥' + data.summary.total_revenue.toLocaleString();
        document.getElementById('orderPendingCount').textContent = data.summary.pending_count;
        document.getElementById('orderRefundedCount').textContent = data.summary.refunded_count;
      }
      renderPagination('orderPagination', data.total, data.page, data.total_pages, function(p) {
        currentOrderPage = p;
        loadOrders();
      });
    })
    .catch(function() { showToast('error', '加载订单列表失败'); });
}

function renderOrderTable(orders) {
  var tbody = document.getElementById('orderTableBody');
  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">暂无订单数据</td></tr>';
    return;
  }

  var statusTag = { pending: 'tag-warning', paid: 'tag-success', refunded: 'tag-danger' };
  var statusText = { pending: '待支付', paid: '已支付', refunded: '已退款' };
  var html = '';
  orders.forEach(function(order) {
    var created = order.created_at ? new Date(order.created_at * 1000).toLocaleString('zh-CN', { hour12: false }) : '-';
    html += '<tr>' +
      '<td style="font-family:monospace;font-size:12px;">' + order.id + '</td>' +
      '<td>' + (order.user || '-') + '</td>' +
      '<td><span class="tag tag-pro">' + (order.plan_name || order.plan) + '</span></td>' +
      '<td>' + (order.period === 'yearly' ? '年付' : '月付') + '</td>' +
      '<td><strong>¥' + order.final_price + '</strong></td>' +
      '<td><span class="tag ' + (statusTag[order.status] || 'tag-info') + '">' + (statusText[order.status] || order.status) + '</span></td>' +
      '<td style="font-size:12px;">' + created + '</td>' +
      '<td><div class="action-btns">' +
      (order.status === 'pending' ? '<button class="btn-action btn-success" onclick="markOrderPaid(\'' + order.id + '\')">标记已支付</button>' : '') +
      (order.status === 'paid' ? '<button class="btn-action btn-danger" onclick="refundOrder(\'' + order.id + '\')">退款</button>' : '') +
      '</div></td></tr>';
  });
  tbody.innerHTML = html;
}

function markOrderPaid(orderId) {
  if (!confirm('确定要将该订单标记为已支付吗？将自动为用户开通会员。')) return;
  fetch('/api/admin/orders/' + orderId + '/mark-paid', { method: 'POST' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) { showToast('success', '订单已标记为已支付，会员已开通'); loadOrders(); }
      else showToast('error', data.message || '操作失败');
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function refundOrder(orderId) {
  if (!confirm('确定要退款该订单吗？用户会员将被降级为免费版。')) return;
  fetch('/api/admin/orders/' + orderId + '/refund', { method: 'POST' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) { showToast('success', '订单已退款，用户会员已降级'); loadOrders(); }
      else showToast('error', data.message || '操作失败');
    })
    .catch(function() { showToast('error', '网络错误'); });
}

// ==================== 内容审核 ====================
function loadContent() {
  var search = document.getElementById('contentSearch').value.trim();
  var type = document.getElementById('contentTypeFilter').value;

  var url = '/api/admin/ai-content?page=' + currentContentPage + '&page_size=20';
  if (search) url += '&search=' + encodeURIComponent(search);
  if (type) url += '&type=' + type;

  fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) return;
      renderContentTable(data.contents);
      renderPagination('contentPagination', data.total, data.page, data.total_pages, function(p) {
        currentContentPage = p;
        loadContent();
      });
    })
    .catch(function() { showToast('error', '加载内容列表失败'); });
}

function renderContentTable(contents) {
  var tbody = document.getElementById('contentTableBody');
  if (!contents || contents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">暂无内容数据</td></tr>';
    return;
  }

  var typeNames = { title: '标题生成', detail: '详情页', service: '客服话术', competitor: '竞品分析', diagnosis: '运营诊断', report: '报表生成' };
  var html = '';
  contents.forEach(function(item) {
    var created = item.created_at ? new Date(item.created_at * 1000).toLocaleString('zh-CN', { hour12: false }) : '-';
    var preview = (item.result || '').substring(0, 80).replace(/\n/g, ' ');
    html += '<tr>' +
      '<td>' + item.user_masked + '</td>' +
      '<td><span class="tag tag-info">' + (typeNames[item.type] || item.type) + '</span></td>' +
      '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(item.title || '-') + '</td>' +
      '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--gray-500);">' + escapeHtml(preview) + '...</td>' +
      '<td style="font-size:12px;">' + created + '</td>' +
      '<td><button class="btn-action btn-danger" onclick="deleteContent(\'' + item.id + '\')">删除</button></td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
}

function deleteContent(contentId) {
  if (!confirm('确定要删除该内容吗？')) return;
  fetch('/api/admin/ai-content/' + contentId + '/delete', { method: 'POST' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) { showToast('success', '内容已删除'); loadContent(); }
      else showToast('error', data.message || '操作失败');
    })
    .catch(function() { showToast('error', '网络错误'); });
}

// ==================== 反馈管理 ====================
function loadFeedbacks() {
  var status = document.getElementById('feedbackStatusFilter').value;
  var type = document.getElementById('feedbackTypeFilter').value;

  var url = '/api/admin/feedbacks?page=' + currentFeedbackPage + '&page_size=20';
  if (status) url += '&status=' + status;
  if (type) url += '&type=' + type;

  fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) return;
      renderFeedbackList(data.feedbacks);
      renderPagination('feedbackPagination', data.total, data.page, data.total_pages, function(p) {
        currentFeedbackPage = p;
        loadFeedbacks();
      });
    })
    .catch(function() { showToast('error', '加载反馈列表失败'); });
}

function renderFeedbackList(feedbacks) {
  var container = document.getElementById('feedbackList');
  if (!feedbacks || feedbacks.length === 0) {
    container.innerHTML = '<div class="table-empty">暂无反馈数据</div>';
    return;
  }

  var typeNames = { bug: 'Bug反馈', feature: '功能建议', experience: '体验问题', other: '其他' };
  var typeTag = { bug: 'tag-danger', feature: 'tag-primary', experience: 'tag-warning', other: 'tag-info' };
  var html = '';
  feedbacks.forEach(function(fb) {
    var created = fb.created_at ? new Date(fb.created_at * 1000).toLocaleString('zh-CN', { hour12: false }) : '-';
    html += '<div class="feedback-item">' +
      '<div class="feedback-header">' +
      '<div class="feedback-user">' +
      '<div class="feedback-avatar">' + (fb.user || '?').charAt(0) + '</div>' +
      '<span class="feedback-phone">' + (fb.user || '匿名') + '</span>' +
      '<span class="tag ' + (typeTag[fb.type] || 'tag-info') + ' feedback-type" style="margin-left:8px;">' + (typeNames[fb.type] || fb.type) + '</span>' +
      (fb.status === 'pending' ? '<span class="tag tag-warning feedback-type" style="margin-left:6px;">待处理</span>' : '<span class="tag tag-success feedback-type" style="margin-left:6px;">已回复</span>') +
      '</div>' +
      '<span class="feedback-time">' + created + '</span>' +
      '</div>' +
      '<div class="feedback-content">' + escapeHtml(fb.content || '') + '</div>' +
      (fb.reply ? '<div class="feedback-reply"><strong>官方回复：</strong>' + escapeHtml(fb.reply) + '</div>' : '') +
      (fb.contact ? '<div style="font-size:12px;color:var(--gray-400);margin-top:6px;">联系方式：' + escapeHtml(fb.contact) + '</div>' : '') +
      (fb.status === 'pending' ? '<div class="feedback-actions"><button class="btn-action btn-success" onclick="openReplyModal(\'' + fb.id + '\')">💬 回复</button></div>' : '') +
      '</div>';
  });
  container.innerHTML = html;
}

function openReplyModal(feedbackId) {
  replyFeedbackId = feedbackId;
  document.getElementById('replyContent').value = '';
  openModal('replyModal');
}

function submitReply() {
  var reply = document.getElementById('replyContent').value.trim();
  if (!reply) { showToast('error', '请输入回复内容'); return; }

  fetch('/api/admin/feedbacks/' + replyFeedbackId + '/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply: reply })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      showToast('success', '回复已提交');
      closeModal('replyModal');
      loadFeedbacks();
    } else {
      showToast('error', data.message || '操作失败');
    }
  })
  .catch(function() { showToast('error', '网络错误'); });
}

// ==================== 消息推送 ====================
function togglePushTarget() {
  var target = document.querySelector('input[name="pushTarget"]:checked').value;
  document.getElementById('targetPhoneGroup').style.display = target === 'single' ? 'block' : 'none';
}

function sendPushNotification() {
  var target = document.querySelector('input[name="pushTarget"]:checked').value;
  var targetPhone = document.getElementById('pushTargetPhone').value.trim();
  var title = document.getElementById('pushTitle').value.trim();
  var content = document.getElementById('pushContent').value.trim();
  var type = document.getElementById('pushType').value;
  var icon = document.getElementById('pushIcon').value;

  if (target === 'single' && !targetPhone) {
    showToast('error', '请输入目标用户手机号');
    return;
  }
  if (!title || !content) {
    showToast('error', '请填写通知标题和内容');
    return;
  }

  var body = { title: title, content: content, type: type, icon: icon, target: target };
  if (target === 'single') body.target_phone = targetPhone;

  var btn = event.target;
  btn.textContent = '发送中...';
  btn.disabled = true;

  fetch('/api/admin/push-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.textContent = '📤 发送通知';
    btn.disabled = false;
    if (data.success) {
      showToast('success', '通知已发送给 ' + data.sent_count + ' 个用户');
      document.getElementById('pushTitle').value = '';
      document.getElementById('pushContent').value = '';
    } else {
      showToast('error', data.message || '发送失败');
    }
  })
  .catch(function() {
    btn.textContent = '📤 发送通知';
    btn.disabled = false;
    showToast('error', '网络错误');
  });
}

// ==================== 系统设置 ====================
function loadSettings() {
  fetch('/api/admin/settings')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) return;
      var s = data.settings;
      document.getElementById('settingSiteName').value = s.site_name || '';
      document.getElementById('settingContactEmail').value = s.contact_email || '';
      document.getElementById('settingIcpNumber').value = s.icp_number || '';
      document.getElementById('settingMaintenanceMsg').value = s.maintenance_message || '';
      document.getElementById('settingRegistration').checked = s.registration_enabled !== false;
      document.getElementById('settingAiGeneration').checked = s.ai_generation_enabled !== false;
      document.getElementById('settingPayment').checked = s.payment_enabled !== false;
      document.getElementById('settingSiteStatus').value = s.site_status || 'online';
    })
    .catch(function() { showToast('error', '加载设置失败'); });
}

function saveSettings() {
  var settings = {
    site_name: document.getElementById('settingSiteName').value.trim(),
    contact_email: document.getElementById('settingContactEmail').value.trim(),
    icp_number: document.getElementById('settingIcpNumber').value.trim(),
    maintenance_message: document.getElementById('settingMaintenanceMsg').value.trim(),
    registration_enabled: document.getElementById('settingRegistration').checked,
    ai_generation_enabled: document.getElementById('settingAiGeneration').checked,
    payment_enabled: document.getElementById('settingPayment').checked,
    site_status: document.getElementById('settingSiteStatus').value
  };

  fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      showToast('success', '设置已保存');
      updateSiteStatus(settings.site_status);
    } else {
      showToast('error', data.message || '保存失败');
    }
  })
  .catch(function() { showToast('error', '网络错误'); });
}

// ==================== 操作日志 ====================
function loadLogs() {
  fetch('/api/admin/logs?page=' + currentLogPage + '&page_size=50')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) return;
      renderLogTable(data.logs);
      renderPagination('logPagination', data.total, data.page, Math.ceil(data.total / 50), function(p) {
        currentLogPage = p;
        loadLogs();
      });
    })
    .catch(function() { showToast('error', '加载日志失败'); });
}

function renderLogTable(logs) {
  var tbody = document.getElementById('logTableBody');
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">暂无操作日志</td></tr>';
    return;
  }
  var html = '';
  logs.forEach(function(log) {
    var time = log.time ? new Date(log.time * 1000).toLocaleString('zh-CN', { hour12: false }) : '-';
    html += '<tr>' +
      '<td style="font-size:12px;">' + time + '</td>' +
      '<td><strong>' + escapeHtml(log.admin || 'unknown') + '</strong></td>' +
      '<td><span class="tag tag-info">' + escapeHtml(log.action || '') + '</span></td>' +
      '<td style="font-size:12px;color:var(--gray-600);">' + escapeHtml(log.detail || '') + '</td>' +
      '<td style="font-size:12px;font-family:monospace;">' + escapeHtml(log.ip || '') + '</td>' +
      '</tr>';
  });
  tbody.innerHTML = html;
}

// ==================== 分页 ====================
function renderPagination(containerId, total, currentPage, totalPages, callback) {
  var container = document.getElementById(containerId);
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  var html = '<button class="page-btn" ' + (currentPage <= 1 ? 'disabled' : '') + ' onclick="window._pgCb_' + containerId + '(' + (currentPage - 1) + ')">上一页</button>';

  var startPage = Math.max(1, currentPage - 2);
  var endPage = Math.min(totalPages, currentPage + 2);
  if (startPage > 1) html += '<button class="page-btn" onclick="window._pgCb_' + containerId + '(1)">1</button>' + (startPage > 2 ? '<span style="padding:0 4px;">...</span>' : '');
  for (var i = startPage; i <= endPage; i++) {
    html += '<button class="page-btn ' + (i === currentPage ? 'active' : '') + '" onclick="window._pgCb_' + containerId + '(' + i + ')">' + i + '</button>';
  }
  if (endPage < totalPages) html += (endPage < totalPages - 1 ? '<span style="padding:0 4px;">...</span>' : '') + '<button class="page-btn" onclick="window._pgCb_' + containerId + '(' + totalPages + ')">' + totalPages + '</button>';

  html += '<button class="page-btn" ' + (currentPage >= totalPages ? 'disabled' : '') + ' onclick="window._pgCb_' + containerId + '(' + (currentPage + 1) + ')">下一页</button>';
  container.innerHTML = html;
  window['_pgCb_' + containerId] = callback;
}

// ==================== 弹窗 ====================
function openModal(id) {
  var modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}
function closeModal(id) {
  var modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}
// 点击遮罩关闭弹窗
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ==================== Toast ====================
function showToast(type, message) {
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.innerHTML = '<span>' + (icons[type] || '') + '</span> ' + message;
  container.appendChild(toast);
  setTimeout(function() {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 3000);
}

// ==================== 工具函数 ====================
function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function shakeElement(id) {
  var el = document.getElementById(id);
  if (el) {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.3s ease';
  }
}
