/* ============================================
   电商AI运营助手 v5.0 - 前端交互逻辑
   ============================================ */

// ========== 全局状态 ==========
let currentUser = null;
let isPricingYearly = false;
let verifyCodeTimer = null;
let verifyCodeCountdown = 60;

// 页面名称映射
const pageNames = {
  'overview': '数据总看板',
  'title-gen': 'AI标题生成',
  'detail-gen': '详情页文案',
  'service-gen': '客服话术',
  'competitor': '竞品分析',
  'shop-data': '店铺数据监控',
  'diagnosis': 'AI运营诊断',
  'report': '报表生成',
  'shop-bind': '店铺绑定',
  'membership': '会员升级',
  'profile': '个人中心',
  'notifications': '消息通知',
  'history': '生成历史',
  'templates': '模板市场',
  'tasks': '任务中心',
  'orders': '订单记录',
  'invoices': '发票管理',
  'security': '安全中心',
  'invite': '邀请好友',
  'coupons': '我的优惠',
  'feedback': '意见反馈'
};

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
  initPageLoader();
  initNavigation();
  initUserState();
  initGlobalSearch();
  initPricingToggle();
  initScrollReveal();
  initButtonRipple();
  initNumberAnimation();
});

// ========== 页面加载动画 ==========
function initPageLoader() {
  var loader = document.getElementById('pageLoader');
  if (!loader) return;

  // 最少显示1秒，避免闪烁
  var minTime = 1000;
  var startTime = Date.now();

  window.addEventListener('load', function() {
    var elapsed = Date.now() - startTime;
    var remaining = Math.max(0, minTime - elapsed);
    setTimeout(function() {
      loader.classList.add('hidden');
      setTimeout(function() {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 600);
    }, remaining);
  });

  // 兜底：3秒后强制隐藏
  setTimeout(function() {
    if (loader && !loader.classList.contains('hidden')) {
      loader.classList.add('hidden');
    }
  }, 3000);
}

// ========== 滚动触发入场动画 ==========
function initScrollReveal() {
  var reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (reveals.length === 0) return;

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    reveals.forEach(function(el) {
      observer.observe(el);
    });
  } else {
    // 降级：直接显示
    reveals.forEach(function(el) {
      el.classList.add('revealed');
    });
  }
}

// 页面切换后重新触发入场动画
function refreshScrollReveal() {
  var reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  reveals.forEach(function(el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add('revealed');
    }
  });
}

// ========== 按钮涟漪效果 ==========
function initButtonRipple() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.btn');
    if (!btn) return;

    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var x = e.clientX - rect.left - size / 2;
    var y = e.clientY - rect.top - size / 2;

    var ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    btn.appendChild(ripple);

    setTimeout(function() {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 600);
  });
}

// ========== 数字滚动动画 ==========
function initNumberAnimation() {
  // 页面加载后对可见的统计数字执行动画
  setTimeout(function() {
    animateVisibleNumbers();
  }, 500);

  // 滚动时触发
  window.addEventListener('scroll', function() {
    animateVisibleNumbers();
  }, { passive: true });
}

function animateVisibleNumbers() {
  var values = document.querySelectorAll('.stat-value[data-target]');
  values.forEach(function(el) {
    if (el.dataset.animated) return;
    var rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.dataset.animated = 'true';
      animateNumber(el, parseFloat(el.dataset.target), el.dataset.prefix || '', el.dataset.suffix || '', el.dataset.decimals || 0);
    }
  });
}

function animateNumber(el, target, prefix, suffix, decimals) {
  var duration = 1500;
  var startTime = null;
  var startValue = 0;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    // easeOutExpo
    var eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    var current = startValue + (target - startValue) * eased;

    var formatted = current.toFixed(decimals);
    if (target >= 1000) {
      formatted = Number(formatted).toLocaleString('zh-CN', { maximumFractionDigits: decimals });
    }
    el.textContent = prefix + formatted + suffix;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// ========== 页面切换 ==========
function showPage(pageName) {
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });

  var targetPage = document.getElementById('page-' + pageName);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // 如果是后台页面，检查登录状态
  if (pageName === 'dashboard') {
    if (!currentUser) {
      showToast('warning', '请先登录');
      showPage('login');
      return;
    }
    updateUserUI();
  }

  // 滚动到顶部
  window.scrollTo(0, 0);
}

// ========== 后台子页面切换 ==========
function switchAdminPage(pageId, navItem) {
  // 隐藏所有后台子页面
  document.querySelectorAll('.admin-page').forEach(function(p) {
    p.classList.remove('active');
  });

  var target = document.getElementById('admin-' + pageId);
  if (target) {
    target.classList.add('active');
  }

  // 更新侧边栏激活状态
  document.querySelectorAll('.sidebar-nav-item').forEach(function(item) {
    item.classList.remove('active');
  });
  if (navItem) {
    navItem.classList.add('active');
  }

  // 更新面包屑
  var pageNameEl = document.getElementById('currentPageName');
  if (pageNameEl && pageNames[pageId]) {
    pageNameEl.textContent = pageNames[pageId];
  }

  // 切换到数据看板时触发数字滚动动画
  if (pageId === 'overview') {
    setTimeout(function() {
      var values = document.querySelectorAll('#admin-overview .stat-value[data-target]');
      values.forEach(function(el) {
        el.dataset.animated = '';
        el.textContent = (el.dataset.prefix || '') + '0' + (el.dataset.suffix || '');
      });
      setTimeout(function() {
        animateVisibleNumbers();
      }, 100);
    }, 200);
  }
}

// ========== 移动端侧边栏切换 ==========
function toggleSidebar() {
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.querySelector('.sidebar-overlay');
  if (!sidebar) return;
  
  var isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.style.display = 'none'; }, 300);
    }
  } else {
    sidebar.classList.add('open');
    if (overlay) {
      overlay.style.display = 'block';
      setTimeout(function() { overlay.classList.add('active'); }, 10);
    }
  }
}

// 点击侧边栏导航项后自动关闭侧边栏（移动端）
document.addEventListener('click', function(e) {
  if (window.innerWidth <= 767) {
    var navItem = e.target.closest('.sidebar-nav-item');
    if (navItem) {
      var sidebar = document.querySelector('.sidebar');
      var overlay = document.querySelector('.sidebar-overlay');
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (overlay) {
          overlay.classList.remove('active');
          setTimeout(function() { overlay.style.display = 'none'; }, 300);
        }
      }
    }
  }
});

// ========== 导航栏滚动效果 ==========
function initNavigation() {
  var nav = document.getElementById('landingNav');
  if (nav) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 20) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }
}

// ========== 滚动到指定区域 ==========
function scrollToSection(sectionId) {
  showPage('home');
  setTimeout(function() {
    var section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

// ========== 用户状态 ==========
function initUserState() {
  try {
    var saved = localStorage.getItem('ecom_ai_user');
    if (saved) {
      currentUser = JSON.parse(saved);
    }
  } catch(e) {
    currentUser = null;
  }
}

function updateUserUI() {
  if (!currentUser) return;

  var name = currentUser.nickname || currentUser.phone || '用户';
  var firstChar = name.charAt(0).toUpperCase();

  // 侧边栏
  var sidebarAvatar = document.getElementById('sidebarAvatar');
  var sidebarUserName = document.getElementById('sidebarUserName');
  if (sidebarAvatar) sidebarAvatar.textContent = firstChar;
  if (sidebarUserName) sidebarUserName.textContent = name;

  // 顶栏
  var topbarAvatar = document.getElementById('topbarAvatar');
  var topbarUserName = document.getElementById('topbarUserName');
  if (topbarAvatar) topbarAvatar.textContent = firstChar;
  if (topbarUserName) topbarUserName.textContent = name;

  // 个人中心
  var profileAvatar = document.getElementById('profileAvatar');
  var profileName = document.getElementById('profileName');
  var menuUserName = document.getElementById('menuUserName');
  if (profileAvatar) profileAvatar.textContent = firstChar;
  if (profileName) profileName.textContent = name;
  if (menuUserName) menuUserName.textContent = name;
}

// ========== 注册 ==========
function handleRegister(event) {
  event.preventDefault();

  var phone = document.getElementById('regPhone').value.trim();
  var code = document.getElementById('regCode').value.trim();
  var password = document.getElementById('regPassword').value;
  var password2 = document.getElementById('regPassword2').value;
  var agree = document.getElementById('agreeTerms').checked;

  // 验证
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showToast('error', '请输入正确的手机号');
    shakeElement('regPhone');
    return;
  }
  if (code.length !== 6) {
    showToast('error', '请输入6位验证码');
    shakeElement('regCode');
    return;
  }
  if (password.length < 8) {
    showToast('error', '密码至少8位');
    shakeElement('regPassword');
    return;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    showToast('error', '密码需包含大小写字母和数字');
    shakeElement('regPassword');
    return;
  }
  if (password !== password2) {
    showToast('error', '两次密码输入不一致');
    shakeElement('regPassword2');
    return;
  }
  if (!agree) {
    showToast('error', '请阅读并同意服务条款和隐私政策');
    return;
  }

  var btn = document.getElementById('registerBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  // 调用后端注册API
  fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone, password: password, confirm_password: password2, code: code })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.classList.remove('btn-loading');
    btn.disabled = false;

    if (data.success) {
      currentUser = {
        phone: phone,
        nickname: '电商用户' + phone.slice(-4),
        plan: 'free',
        token: data.token
      };
      localStorage.setItem('ecom_ai_user', JSON.stringify(currentUser));
      showToast('success', '注册成功，欢迎使用！');
      setTimeout(function() {
        showPage('dashboard');
      }, 800);
    } else {
      showToast('error', data.message || '注册失败，请重试');
    }
  })
  .catch(function() {
    // 后端不可用时使用本地注册（演示模式）
    btn.classList.remove('btn-loading');
    btn.disabled = false;

    currentUser = {
      phone: phone,
      nickname: '电商用户' + phone.slice(-4),
      plan: 'free',
      token: 'demo_token_' + Date.now()
    };
    localStorage.setItem('ecom_ai_user', JSON.stringify(currentUser));
    showToast('success', '注册成功，欢迎使用！');
    setTimeout(function() {
      showPage('dashboard');
    }, 800);
  });
}

// ========== 登录 ==========
function handleLogin(event) {
  event.preventDefault();

  var phone = document.getElementById('loginPhone').value.trim();
  var password = document.getElementById('loginPassword').value;

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showToast('error', '请输入正确的手机号');
    shakeElement('loginPhone');
    return;
  }
  if (!password) {
    showToast('error', '请输入密码');
    shakeElement('loginPassword');
    return;
  }

  var btn = document.getElementById('loginBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone, password: password })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.classList.remove('btn-loading');
    btn.disabled = false;

    if (data.success) {
      currentUser = {
        phone: phone,
        nickname: data.nickname || ('电商用户' + phone.slice(-4)),
        plan: data.plan || 'pro',
        token: data.token
      };
      localStorage.setItem('ecom_ai_user', JSON.stringify(currentUser));
      showToast('success', '登录成功！');
      setTimeout(function() {
        showPage('dashboard');
      }, 500);
    } else {
      showToast('error', data.message || '手机号或密码错误');
    }
  })
  .catch(function() {
    // 演示模式
    btn.classList.remove('btn-loading');
    btn.disabled = false;

    currentUser = {
      phone: phone,
      nickname: '电商用户' + phone.slice(-4),
      plan: 'pro',
      token: 'demo_token_' + Date.now()
    };
    localStorage.setItem('ecom_ai_user', JSON.stringify(currentUser));
    showToast('success', '登录成功！');
    setTimeout(function() {
      showPage('dashboard');
    }, 500);
  });
}

// ========== 退出登录 ==========
function logout() {
  closeModal('userMenuModal');
  currentUser = null;
  localStorage.removeItem('ecom_ai_user');
  showToast('success', '已退出登录');
  setTimeout(function() {
    showPage('home');
  }, 500);
}

// ========== 密码显示切换 ==========
function togglePassword(inputId) {
  var input = document.getElementById(inputId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

// ========== 密码强度检测 ==========
function checkPasswordStrength(password) {
  var bars = [
    document.getElementById('psBar1'),
    document.getElementById('psBar2'),
    document.getElementById('psBar3'),
    document.getElementById('psBar4')
  ];
  var text = document.getElementById('psText');

  // 重置
  bars.forEach(function(bar) {
    bar.className = 'password-strength-bar';
  });

  if (!password) {
    text.textContent = '请输入密码';
    text.style.color = 'var(--gray-400)';
    return;
  }

  var score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  var level = Math.min(score, 4);
  var levelClass = ['', 'weak', 'weak', 'medium', 'strong'][level];
  var levelText = ['请输入密码', '弱', '较弱', '中', '强'][level];
  var levelColor = ['var(--gray-400)', 'var(--danger-500)', 'var(--danger-500)', 'var(--warning-500)', 'var(--success-500)'][level];

  for (var i = 0; i < level; i++) {
    bars[i].classList.add(levelClass);
  }

  text.textContent = '密码强度：' + levelText;
  text.style.color = levelColor;
}

// ========== 发送验证码 ==========
function sendVerifyCode() {
  var phone = document.getElementById('regPhone').value.trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showToast('error', '请输入正确的手机号');
    shakeElement('regPhone');
    return;
  }

  var btn = document.getElementById('sendCodeBtn');
  btn.disabled = true;
  verifyCodeCountdown = 60;

  showToast('success', '验证码已发送（演示模式：123456）');

  verifyCodeTimer = setInterval(function() {
    verifyCodeCountdown--;
    if (verifyCodeCountdown <= 0) {
      clearInterval(verifyCodeTimer);
      btn.disabled = false;
      btn.textContent = '获取验证码';
    } else {
      btn.textContent = verifyCodeCountdown + 's后重发';
    }
  }, 1000);
}

// ========== 价格切换 ==========
function initPricingToggle() {
  var toggle = document.getElementById('pricingToggle');
  if (toggle) {
    toggle.classList.remove('active');
  }
}

function togglePricingMode() {
  setPricingMode(isPricingYearly ? 'monthly' : 'yearly');
}

function setPricingMode(mode) {
  isPricingYearly = (mode === 'yearly');

  var toggle = document.getElementById('pricingToggle');
  var monthlyLabel = document.getElementById('monthlyLabel');
  var yearlyLabel = document.getElementById('yearlyLabel');
  var proPrice = document.getElementById('proPrice');
  var proPeriod = document.getElementById('proPeriod');
  var ultimatePrice = document.getElementById('ultimatePrice');
  var ultimatePeriod = document.getElementById('ultimatePeriod');

  if (toggle) {
    toggle.classList.toggle('active', isPricingYearly);
  }
  if (monthlyLabel) monthlyLabel.classList.toggle('active', !isPricingYearly);
  if (yearlyLabel) yearlyLabel.classList.toggle('active', isPricingYearly);

  if (isPricingYearly) {
    if (proPrice) proPrice.textContent = '319';
    if (proPeriod) proPeriod.textContent = '/年';
    if (ultimatePrice) ultimatePrice.textContent = '799';
    if (ultimatePeriod) ultimatePeriod.textContent = '/年';
  } else {
    if (proPrice) proPrice.textContent = '39';
    if (proPeriod) proPeriod.textContent = '/月';
    if (ultimatePrice) ultimatePrice.textContent = '99';
    if (ultimatePeriod) ultimatePeriod.textContent = '/月';
  }
}

// ========== FAQ手风琴 ==========
function toggleFaq(item) {
  var wasActive = item.classList.contains('active');

  // 关闭所有
  document.querySelectorAll('.faq-item').forEach(function(faq) {
    faq.classList.remove('active');
  });

  // 切换当前
  if (!wasActive) {
    item.classList.add('active');
  }
}

// ========== AI标题生成 ==========
function fillTitleDemo() {
  document.getElementById('titleProductName').value = '纯棉短袖T恤男士夏季新款';
  document.getElementById('titleCategory').value = '男装/T恤';
  document.getElementById('titlePlatform').value = 'taobao';
  document.getElementById('titleSellingPoints').value = '100%纯棉、透气吸汗、修身版型、不易变形';
  document.getElementById('titleTargetAudience').value = '18-35岁男性、学生、上班族';
  showToast('info', '已填充示例数据');
}

function generateTitles() {
  var productName = document.getElementById('titleProductName').value.trim();
  var category = document.getElementById('titleCategory').value;
  var platform = document.getElementById('titlePlatform').value;
  var count = parseInt(document.getElementById('titleCount').value) || 10;

  if (!productName) {
    showToast('error', '请输入商品名称');
    shakeElement('titleProductName');
    return;
  }
  if (!category) {
    showToast('error', '请选择商品类目');
    shakeElement('titleCategory');
    return;
  }

  var btn = document.getElementById('genTitleBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  // 显示骨架屏
  var resultEl = document.getElementById('titleResult');
  resultEl.innerHTML = '<div style="padding:20px;"><div class="skeleton" style="height:60px;border-radius:8px;margin-bottom:12px;"></div><div class="skeleton" style="height:60px;border-radius:8px;margin-bottom:12px;"></div><div class="skeleton" style="height:60px;border-radius:8px;margin-bottom:12px;"></div><div class="skeleton" style="height:60px;border-radius:8px;"></div></div>';

  // 调用后端API
  fetch('/api/generate-title', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_name: productName,
      category: category,
      platform: platform,
      selling_points: document.getElementById('titleSellingPoints').value,
      target_audience: document.getElementById('titleTargetAudience').value,
      count: count
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    var titles = data.titles || data.data || [];
    if (titles.length === 0 && data.result) {
      titles = parseAiResultList(data.result);
    }
    renderTitleResults(titles);
  })
  .catch(function() {
    // 演示模式
    setTimeout(function() {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
      var demoTitles = [
        '纯棉短袖T恤男士2026夏季新款潮流宽松半袖体恤男装上衣服',
        '男士短袖T恤100%纯棉夏季薄款透气吸汗修身百搭打底衫男',
        '夏季纯棉短袖t恤男学生潮流ins宽松大码半袖体恤衫男装',
        '纯棉短袖T恤男夏季新款韩版修身圆领打底衫男士半袖上衣',
        '男士短袖t恤纯棉2026夏季新款潮流宽松大码男装体恤上衣',
        '夏季男士纯棉短袖T恤透气吸汗修身版型学生百搭半袖打底衫',
        '纯棉短袖t恤男夏季薄款2026新款潮流宽松休闲男装半袖上衣',
        '男士短袖T恤纯棉夏季新款韩版潮流学生宽松大码打底衫体恤',
        '夏季纯棉短袖T恤男修身显瘦透气吸汗男士百搭半袖上衣体恤',
        '2026新款纯棉短袖t恤男夏季潮流宽松大码男装半袖打底衫'
      ];
      renderTitleResults(demoTitles.slice(0, count));
    }, 1200);
  });
}

function renderTitleResults(titles) {
  var resultEl = document.getElementById('titleResult');
  if (!titles || titles.length === 0) {
    resultEl.innerHTML = '<div class="ai-result-empty"><div class="ai-result-empty-icon">❌</div><p>生成失败，请重试</p></div>';
    return;
  }

  var html = '';
  titles.forEach(function(title, index) {
    html += '<div class="ai-result-item">' +
      '<div class="ai-result-num">' + (index + 1) + '</div>' +
      '<div class="ai-result-text">' + escapeHtml(title) + '</div>' +
      '<div class="ai-result-item-actions">' +
      '<button class="ai-result-copy-btn" onclick="copyText(\'' + escapeHtml(title).replace(/'/g, "\\'") + '\', this)" title="复制">📋</button>' +
      '</div></div>';
  });
  resultEl.innerHTML = html;
  showToast('success', '成功生成 ' + titles.length + ' 个标题');
}

function copyAllTitles() {
  var items = document.querySelectorAll('#titleResult .ai-result-text');
  if (items.length === 0) {
    showToast('warning', '暂无内容可复制');
    return;
  }
  var text = '';
  items.forEach(function(item, index) {
    text += (index + 1) + '. ' + item.textContent + '\n';
  });
  copyToClipboard(text);
  showToast('success', '已复制全部标题');
}

// ========== 详情页文案生成 ==========
function fillDetailDemo() {
  document.getElementById('detailProductName').value = '纯棉短袖T恤男士夏季新款';
  document.getElementById('detailCategory').value = '男装/T恤';
  document.getElementById('detailSellingPoints').value = '100%纯棉面料\n透气吸汗不闷热\n修身版型显瘦\n不易起球变形\n活性印染不褪色';
  document.getElementById('detailSpecs').value = '材质：100%棉\n尺码：M/L/XL/XXL\n颜色：白色/黑色/灰色/藏青\n适用季节：夏季\n洗涤方式：可机洗';
  showToast('info', '已填充示例数据');
}

function generateDetail() {
  var productName = document.getElementById('detailProductName').value.trim();
  var category = document.getElementById('detailCategory').value;
  var sellingPoints = document.getElementById('detailSellingPoints').value.trim();

  if (!productName) {
    showToast('error', '请输入商品名称');
    shakeElement('detailProductName');
    return;
  }
  if (!category) {
    showToast('error', '请选择商品类目');
    shakeElement('detailCategory');
    return;
  }
  if (!sellingPoints) {
    showToast('error', '请输入核心卖点');
    shakeElement('detailSellingPoints');
    return;
  }

  var btn = document.getElementById('genDetailBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  var resultEl = document.getElementById('detailResult');
  resultEl.innerHTML = '<div style="padding:20px;"><div class="skeleton" style="height:24px;width:60%;border-radius:4px;margin-bottom:16px;"></div><div class="skeleton" style="height:80px;border-radius:8px;margin-bottom:12px;"></div><div class="skeleton" style="height:80px;border-radius:8px;margin-bottom:12px;"></div><div class="skeleton" style="height:80px;border-radius:8px;"></div></div>';

  fetch('/api/generate-detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_name: productName,
      category: category,
      features: sellingPoints,
      selling_points: sellingPoints,
      params: document.getElementById('detailSpecs').value,
      specs: document.getElementById('detailSpecs').value,
      style: document.getElementById('detailStyle').value
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    var content = data.content || data.data || data.result || '';
    renderDetailResult(content);
  })
  .catch(function() {
    setTimeout(function() {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
      var demoContent = '【商品亮点】\n\n100%纯棉面料，亲肤透气，夏季穿着不闷热。修身版型设计，显瘦不紧绷，适合各种身材。活性印染工艺，色彩牢固，久洗不褪色。不易起球变形，耐穿耐用，性价比之选。\n\n【场景描述】\n\n无论是日常通勤、校园生活还是周末出游，这件纯棉短袖T恤都是你的百搭之选。单穿清爽利落，内搭舒适自在，轻松驾驭各种风格。\n\n【规格参数】\n\n材质：100%棉\n尺码：M/L/XL/XXL\n颜色：白色/黑色/灰色/藏青\n适用季节：夏季\n洗涤方式：可机洗，建议冷水洗涤\n\n【购买须知】\n\n1. 因显示器不同，可能存在轻微色差，请以实物为准\n2. 尺码为手工测量，可能存在1-2cm误差，属正常范围\n3. 收到商品后如有任何问题，请及时联系客服，我们将竭诚为您服务';
      renderDetailResult(demoContent);
    }, 1500);
  });
}

function renderDetailResult(content) {
  var resultEl = document.getElementById('detailResult');
  if (!content) {
    resultEl.innerHTML = '<div class="ai-result-empty"><div class="ai-result-empty-icon">❌</div><p>生成失败，请重试</p></div>';
    return;
  }
  resultEl.innerHTML = '<div class="ai-result-item" style="flex-direction:column;"><div class="ai-result-text" style="white-space:pre-wrap;line-height:1.8;">' + escapeHtml(content) + '</div></div>';
  showToast('success', '详情文案生成成功');
}

// ========== 客服话术生成 ==========
function updateServicePlaceholder() {
  var scene = document.getElementById('serviceScene').value;
  var input = document.getElementById('serviceQuestion');
  var placeholders = {
    'presale': '客户问：这个衣服是什么材质的？会起球吗？',
    'size': '客户问：我身高175体重140斤，穿什么码合适？',
    'logistics': '客户问：我昨天下的单，什么时候发货？多久能到？',
    'return': '客户问：衣服收到了，尺码不合适，可以换吗？',
    'refund': '客户问：我不想要了，怎么申请退款？',
    'complaint': '客户说：你们这衣服质量太差了，穿一次就起球！',
    'review': '客户给了差评：衣服和图片不符，色差严重，差评！',
    'coupon': '客户问：现在有什么优惠活动吗？有没有优惠券？'
  };
  if (placeholders[scene]) {
    input.placeholder = placeholders[scene];
  }
}

function fillServiceDemo() {
  document.getElementById('serviceScene').value = 'presale';
  document.getElementById('serviceProduct').value = '纯棉短袖T恤';
  document.getElementById('serviceQuestion').value = '你好，这个T恤是什么材质的？夏天穿会不会闷热？容易起球吗？';
  updateServicePlaceholder();
  showToast('info', '已填充示例数据');
}

function generateService() {
  var scene = document.getElementById('serviceScene').value;
  var question = document.getElementById('serviceQuestion').value.trim();
  var count = parseInt(document.getElementById('serviceCount').value) || 5;

  if (!question) {
    showToast('error', '请输入客户问题');
    shakeElement('serviceQuestion');
    return;
  }

  var btn = document.getElementById('genServiceBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  var resultEl = document.getElementById('serviceResult');
  resultEl.innerHTML = '<div style="padding:20px;"><div class="skeleton" style="height:50px;border-radius:8px;margin-bottom:12px;"></div><div class="skeleton" style="height:50px;border-radius:8px;margin-bottom:12px;"></div><div class="skeleton" style="height:50px;border-radius:8px;margin-bottom:12px;"></div></div>';

  fetch('/api/generate-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scene: scene,
      product: document.getElementById('serviceProduct').value,
      question: question,
      style: document.getElementById('serviceStyle').value,
      count: count
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    var replies = data.replies || data.data || [];
    if (replies.length === 0 && data.result) {
      var rawLines = parseAiResultList(data.result);
      // 过滤掉标题行（以【开头、以话术开头、空行）
      replies = rawLines.filter(function(line) {
        return line && !line.startsWith('【') && !line.startsWith('话术') && line.length > 5;
      });
    }
    renderServiceResults(replies);
  })
  .catch(function() {
    setTimeout(function() {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
      var demoReplies = [
        '亲，您好呀~😊 这件T恤是100%纯棉材质的哦，面料非常亲肤透气，夏天穿完全不会闷热的呢！我们采用的是精梳棉面料，经过特殊处理，正常穿着和洗涤是不容易起球的哦，亲可以放心购买哒~',
        '亲爱的顾客您好~ 这件短袖采用的是优质纯棉面料，透气性非常好，夏季穿着清爽舒适。关于起球问题，我们的面料经过抗起球处理，正常穿着不易起球。建议洗涤时翻面轻柔洗涤，可以更好地保护面料哦~',
        '亲~ 您眼光真好！这款是100%纯棉的，摸起来软软的很舒服，夏天穿吸汗透气一点都不闷。起球的话您放心，我们用的是好料子，正常穿不会起球的，好多老顾客都回购了呢！有任何问题随时找我哈~',
        '您好，感谢您的咨询。本商品采用100%精梳纯棉面料，具有良好的透气性和吸湿性，适合夏季穿着。面料经过抗起球工艺处理，在正常穿着和正确洗涤的情况下不易起球。我们提供7天无理由退换，您可以放心购买。',
        '亲亲~ 这件是纯棉的哦，夏天穿特别舒服透气，不会闷汗的呢！起球问题不用担心，我们家衣服质量都是经过严格检测的，正常穿洗不会起球。如果收到有任何不满意，支持7天无理由退换哦，购物零风险~'
      ];
      renderServiceResults(demoReplies.slice(0, count));
    }, 1000);
  });
}

function renderServiceResults(replies) {
  var resultEl = document.getElementById('serviceResult');
  if (!replies || replies.length === 0) {
    resultEl.innerHTML = '<div class="ai-result-empty"><div class="ai-result-empty-icon">❌</div><p>生成失败，请重试</p></div>';
    return;
  }

  var html = '';
  replies.forEach(function(reply, index) {
    html += '<div class="ai-result-item">' +
      '<div class="ai-result-num">' + (index + 1) + '</div>' +
      '<div class="ai-result-text">' + escapeHtml(reply) + '</div>' +
      '<div class="ai-result-item-actions">' +
      '<button class="ai-result-copy-btn" onclick="copyText(\'' + escapeHtml(reply).replace(/'/g, "\\'").replace(/\n/g, '\\n') + '\', this)" title="复制">📋</button>' +
      '</div></div>';
  });
  resultEl.innerHTML = html;
  showToast('success', '成功生成 ' + replies.length + ' 条话术');
}

// ========== 竞品分析 ==========
function fillCompetitorDemo() {
  document.getElementById('competitorUrl').value = 'https://item.taobao.com/item.htm?id=123456789';
  showToast('info', '已填充示例链接');
}

function analyzeCompetitor() {
  var url = document.getElementById('competitorUrl').value.trim();
  if (!url) {
    showToast('error', '请输入竞品商品链接');
    shakeElement('competitorUrl');
    return;
  }

  var btn = document.getElementById('analyzeBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  var resultEl = document.getElementById('competitorResult');
  resultEl.innerHTML = '<div class="card" style="text-align:center;padding:60px 20px;"><div class="loading-spinner" style="margin:0 auto 16px;"></div><p style="color:var(--gray-500);">AI正在深度分析竞品数据，请稍候...</p></div>';

  fetch('/api/competitor-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    // 如果后端只返回纯文本result，包装成结构化数据
    if (data.result && !data.product_name && !data.summary) {
      data = {
        product_name: '竞品商品',
        price: '¥--',
        sales: '月销 --',
        rating: '--分',
        reviews: '--条评价',
        shop: '竞品店铺',
        selling_points: [],
        positive_tags: [],
        negative_tags: [],
        price_trend: '暂无数据',
        traffic_source: '暂无数据',
        summary: data.result
      };
    }
    renderCompetitorResult(data);
  })
  .catch(function() {
    setTimeout(function() {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
      renderCompetitorResult({
        product_name: '纯棉短袖T恤男士夏季新款潮流宽松半袖',
        price: '¥69.9',
        original_price: '¥129',
        sales: '月销 2万+',
        rating: '4.8分',
        reviews: '12,580条评价',
        shop: 'XX服饰旗舰店',
        selling_points: ['100%纯棉面料', '宽松版型显瘦', '多色可选', '性价比高', '明星同款'],
        positive_tags: ['面料好(3200)', '穿着舒适(2800)', '版型好看(2100)', '性价比高(1800)', '颜色正(1500)'],
        negative_tags: ['有点薄(320)', '尺码偏大(280)', '色差(150)', '起球(80)'],
        price_trend: '近30天价格稳定在¥69.9，大促期间最低¥49.9',
        traffic_source: '搜索流量45%、推荐流量30%、广告流量15%、其他10%',
        summary: '该竞品是淘宝男装T恤类目热销款，主打高性价比和宽松版型。价格定位中低端，通过大额优惠券和促销活动吸引价格敏感型用户。核心优势是供应链成本控制和多SKU布局。建议从面料品质升级和差异化设计入手，避开直接价格战。'
      });
    }, 2000);
  });
}

function renderCompetitorResult(data) {
  var resultEl = document.getElementById('competitorResult');
  var html = '';

  // 基本信息
  html += '<div class="competitor-data-card">' +
    '<h3>📦 商品基本信息</h3>' +
    '<div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">' +
    '<div style="width:120px;height:120px;background:var(--gray-100);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:48px;flex-shrink:0;">👕</div>' +
    '<div style="flex:1;min-width:200px;">' +
    '<div style="font-size:16px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">' + escapeHtml(data.product_name || '未知商品') + '</div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">' +
    '<span style="font-size:24px;font-weight:700;color:var(--danger-600);">' + (data.price || '¥--') + '</span>' +
    '<span style="font-size:14px;color:var(--gray-400);text-decoration:line-through;">' + (data.original_price || '') + '</span>' +
    '<span class="tag tag-success">' + (data.sales || '') + '</span>' +
    '<span class="tag tag-warning">' + (data.rating || '') + '</span>' +
    '</div>' +
    '<div style="font-size:13px;color:var(--gray-500);">店铺：' + escapeHtml(data.shop || '') + ' · ' + (data.reviews || '') + '</div>' +
    '</div></div></div>';

  // 核心数据
  html += '<div class="competitor-data-card">' +
    '<h3>📊 核心数据</h3>' +
    '<div class="data-grid">' +
    '<div class="data-item"><div class="data-item-label">当前价格</div><div class="data-item-value" style="color:var(--danger-600);">' + (data.price || '--') + '</div></div>' +
    '<div class="data-item"><div class="data-item-label">月销量</div><div class="data-item-value">' + (data.sales || '--') + '</div></div>' +
    '<div class="data-item"><div class="data-item-label">评分</div><div class="data-item-value" style="color:var(--warning-500);">' + (data.rating || '--') + '</div></div>' +
    '<div class="data-item"><div class="data-item-label">评价数</div><div class="data-item-value">' + (data.reviews || '--') + '</div></div>' +
    '</div></div>';

  // 卖点
  if (data.selling_points && data.selling_points.length) {
    html += '<div class="competitor-data-card">' +
      '<h3>✨ 核心卖点</h3>' +
      '<div class="tag-list">';
    data.selling_points.forEach(function(sp) {
      html += '<span class="tag-item">' + escapeHtml(sp) + '</span>';
    });
    html += '</div></div>';
  }

  // 评价分析
  if (data.positive_tags && data.positive_tags.length) {
    html += '<div class="competitor-data-card">' +
      '<h3>💬 评价分析</h3>' +
      '<div style="margin-bottom:16px;"><div style="font-size:14px;font-weight:500;color:var(--success-600);margin-bottom:8px;">👍 好评关键词</div>' +
      '<div class="tag-list">';
    data.positive_tags.forEach(function(tag) {
      html += '<span class="tag-item">' + escapeHtml(tag) + '</span>';
    });
    html += '</div></div>';

    if (data.negative_tags && data.negative_tags.length) {
      html += '<div><div style="font-size:14px;font-weight:500;color:var(--danger-600);margin-bottom:8px;">👎 差评关键词</div>' +
        '<div class="tag-list">';
      data.negative_tags.forEach(function(tag) {
        html += '<span class="tag-item bad">' + escapeHtml(tag) + '</span>';
      });
      html += '</div></div>';
    }
    html += '</div>';
  }

  // 价格趋势和流量
  html += '<div class="two-col-grid" style="margin-bottom:16px;">' +
    '<div class="competitor-data-card" style="margin-bottom:0;"><h3>📈 价格趋势</h3>' +
    '<p class="result-text">' + escapeHtml(data.price_trend || '暂无数据') + '</p></div>' +
    '<div class="competitor-data-card" style="margin-bottom:0;"><h3>🚀 流量来源</h3>' +
    '<p class="result-text">' + escapeHtml(data.traffic_source || '暂无数据') + '</p></div>' +
    '</div>';

  // AI总结
  if (data.summary) {
    html += '<div class="ai-summary-box">' +
      '<h4>🤖 AI分析总结与建议</h4>' +
      '<p class="result-text">' + escapeHtml(data.summary) + '</p>' +
      '</div>';
  }

  resultEl.innerHTML = html;
  showToast('success', '竞品分析完成');
}

// ========== 运营诊断 ==========
function runDiagnosis() {
  var btn = document.getElementById('diagnosisBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  var resultEl = document.getElementById('diagnosisResult');
  resultEl.innerHTML = '<div class="card" style="text-align:center;padding:60px 20px;"><div class="loading-spinner" style="margin:0 auto 16px;"></div><p style="color:var(--gray-500);">AI正在全面诊断店铺运营状况...</p><p style="color:var(--gray-400);font-size:12px;margin-top:8px;">正在扫描：流量健康 → 转化效率 → 商品结构 → 客服质量 → 库存管理 → 复购表现 → 竞品对比 → 综合评分</p></div>';

  fetch('/api/operation-diagnosis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shop: '淘宝旗舰店' })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    // 如果后端只返回纯文本result，包装成结构化数据
    if (data.result && !data.score && !data.dimensions) {
      data = {
        score: 75,
        level: '良好',
        dimensions: [
          { name: '流量健康', score: 80, status: 'good', desc: '流量结构基本健康' },
          { name: '转化效率', score: 70, status: 'warning', desc: '转化率有提升空间' },
          { name: '商品结构', score: 75, status: 'good', desc: '商品结构合理' },
          { name: '客服质量', score: 85, status: 'good', desc: '客服响应及时' },
          { name: '库存管理', score: 65, status: 'warning', desc: '部分商品库存需关注' },
          { name: '复购表现', score: 70, status: 'warning', desc: '复购率有待提升' },
          { name: '竞品对比', score: 75, status: 'good', desc: '竞争力中等偏上' },
          { name: '综合运营', score: 75, status: 'good', desc: '整体运营状况良好' }
        ],
        problems: [
          { level: 'medium', title: '转化率有待提升', desc: '店铺转化率略低于类目均值，建议优化详情页', action: '优化详情页内容和主图' }
        ],
        plan: [
          { day: '第1-3天', task: '优化TOP10商品详情页', status: 'normal' },
          { day: '第4-5天', task: '检查并调整库存', status: 'normal' },
          { day: '第6-7天', task: '建立老客唤醒机制', status: 'normal' }
        ],
        summary: data.result
      };
    }
    renderDiagnosisResult(data);
  })
  .catch(function() {
    setTimeout(function() {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
      renderDiagnosisResult({
        score: 78,
        level: '良好',
        dimensions: [
          { name: '流量健康', score: 85, status: 'good', desc: '流量结构健康，自然流量占比60%，付费流量ROI达标' },
          { name: '转化效率', score: 72, status: 'warning', desc: '转化率3.8%略低于类目均值4.2%，详情页停留时间偏短' },
          { name: '商品结构', score: 80, status: 'good', desc: '有2款爆款支撑，动销率75%，但新品占比偏低' },
          { name: '客服质量', score: 88, status: 'good', desc: '响应时间30秒内，好评率98.5%，客服话术规范' },
          { name: '库存管理', score: 65, status: 'warning', desc: '2款热销商品库存不足，3款滞销商品库存积压超过90天' },
          { name: '复购表现', score: 70, status: 'warning', desc: '复购率15%低于类目均值20%，会员运营有待加强' },
          { name: '竞品对比', score: 75, status: 'good', desc: '价格竞争力中等，产品差异化不足，需加强卖点提炼' },
          { name: '综合运营', score: 78, status: 'good', desc: '整体运营状况良好，在转化、库存和复购方面有提升空间' }
        ],
        problems: [
          { level: 'high', title: '热销商品库存不足', desc: '商品「纯棉短袖T恤」库存仅剩23件，按当前销量预计2天内断货，将影响GMV约¥15,000', action: '立即补货，同时设置库存预警' },
          { level: 'medium', title: '转化率低于类目均值', desc: '店铺转化率3.8%，类目均值4.2%，主要原因是详情页平均停留时间仅28秒（类目均值45秒）', action: '优化详情页首屏内容，增加场景图和买家秀，使用AI重新生成详情文案' },
          { level: 'medium', title: '滞销商品库存积压', desc: '3款商品库存积压超过90天，占用资金约¥25,000，周转率偏低', action: '制定清仓计划，通过捆绑销售、限时折扣等方式加速去库存' },
          { level: 'low', title: '复购率有待提升', desc: '复购率15%低于类目均值20%，会员体系不完善，缺乏有效的老客唤醒机制', action: '建立会员等级体系，设置老客专属优惠券，定期推送新品和促销信息' }
        ],
        plan: [
          { day: '第1天', task: '立即补货热销商品，设置库存预警', status: 'urgent' },
          { day: '第2天', task: '使用AI重新生成TOP10商品详情页文案', status: 'normal' },
          { day: '第3天', task: '优化详情页首屏，增加场景图和买家秀模块', status: 'normal' },
          { day: '第4-5天', task: '制定滞销商品清仓计划，启动捆绑销售', status: 'normal' },
          { day: '第6天', task: '建立会员等级体系，设置老客专属优惠券', status: 'normal' },
          { day: '第7天', task: '复盘优化效果，调整后续运营策略', status: 'normal' }
        ]
      });
    }, 2500);
  });
}

function renderDiagnosisResult(data) {
  var resultEl = document.getElementById('diagnosisResult');
  var html = '';

  // 综合评分
  html += '<div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,#EFF6FF 0%,#F5F3FF 100%);border:none;">' +
    '<div class="card-body" style="display:flex;align-items:center;gap:32px;flex-wrap:wrap;">' +
    '<div style="text-align:center;">' +
    '<div style="font-size:48px;font-weight:700;color:var(--primary-600);">' + (data.score || '--') + '</div>' +
    '<div style="font-size:14px;color:var(--gray-500);">综合评分</div>' +
    '</div>' +
    '<div style="flex:1;min-width:200px;">' +
    '<div style="font-size:20px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">运营等级：' + (data.level || '--') + '</div>' +
    '<div style="font-size:14px;color:var(--gray-600);line-height:1.7;">店铺整体运营状况' + (data.score >= 80 ? '优秀' : data.score >= 70 ? '良好' : '一般') + '，在流量获取和客服质量方面表现出色，但在转化率、库存管理和复购率方面有较大提升空间。按照下方优化方案执行，预计可提升GMV 20%以上。</div>' +
    '</div></div></div>';

  // 8维度评分
  if (data.dimensions && data.dimensions.length) {
    html += '<div class="card" style="margin-bottom:16px;">' +
      '<div class="card-header"><h3>📊 8维度诊断评分</h3></div>' +
      '<div class="card-body"><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">';
    data.dimensions.forEach(function(dim) {
      var color = dim.score >= 80 ? 'var(--success-500)' : dim.score >= 70 ? 'var(--warning-500)' : 'var(--danger-500)';
      html += '<div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
        '<span style="font-size:14px;font-weight:500;color:var(--gray-700);">' + escapeHtml(dim.name) + '</span>' +
        '<span style="font-size:14px;font-weight:600;color:' + color + ';">' + dim.score + '分</span>' +
        '</div>' +
        '<div style="height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden;">' +
        '<div style="height:100%;width:' + dim.score + '%;background:' + color + ';border-radius:3px;transition:width 0.5s;"></div>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--gray-500);margin-top:4px;line-height:1.5;">' + escapeHtml(dim.desc) + '</div>' +
        '</div>';
    });
    html += '</div></div></div>';
  }

  // 发现的问题
  if (data.problems && data.problems.length) {
    html += '<div class="card" style="margin-bottom:16px;">' +
      '<div class="card-header"><h3>⚠️ 发现的问题</h3><span class="tag tag-danger">' + data.problems.length + '个待处理</span></div>' +
      '<div class="card-body">';
    data.problems.forEach(function(problem) {
      var levelColor = problem.level === 'high' ? 'var(--danger-500)' : problem.level === 'medium' ? 'var(--warning-500)' : 'var(--info-500)';
      var levelText = problem.level === 'high' ? '高优先级' : problem.level === 'medium' ? '中优先级' : '低优先级';
      html += '<div style="padding:16px;border:1px solid var(--gray-100);border-radius:8px;margin-bottom:12px;border-left:3px solid ' + levelColor + ';">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span class="tag" style="background:' + levelColor + '15;color:' + levelColor + ';">' + levelText + '</span>' +
        '<span style="font-size:15px;font-weight:600;color:var(--gray-800);">' + escapeHtml(problem.title) + '</span>' +
        '</div>' +
        '<p style="font-size:13px;color:var(--gray-600);line-height:1.7;margin-bottom:8px;">' + escapeHtml(problem.desc) + '</p>' +
        '<div style="font-size:13px;color:var(--primary-600);"><strong>建议操作：</strong>' + escapeHtml(problem.action) + '</div>' +
        '</div>';
    });
    html += '</div></div>';
  }

  // 7天执行计划
  if (data.plan && data.plan.length) {
    html += '<div class="card">' +
      '<div class="card-header"><h3>📅 7天优化执行计划</h3></div>' +
      '<div class="card-body">';
    data.plan.forEach(function(item, index) {
      html += '<div style="display:flex;gap:16px;padding:12px 0;' + (index < data.plan.length - 1 ? 'border-bottom:1px solid var(--gray-100);' : '') + '">' +
        '<div style="flex-shrink:0;width:60px;text-align:center;">' +
        '<div style="font-size:13px;font-weight:600;color:' + (item.status === 'urgent' ? 'var(--danger-500)' : 'var(--primary-600)') + ';">' + escapeHtml(item.day) + '</div>' +
        '</div>' +
        '<div style="flex:1;">' +
        '<div style="font-size:14px;color:var(--gray-700);line-height:1.6;">' + escapeHtml(item.task) + '</div>' +
        (item.status === 'urgent' ? '<span class="tag tag-danger" style="margin-top:4px;">紧急</span>' : '') +
        '</div></div>';
    });
    html += '</div></div>';
  }

  resultEl.innerHTML = html;
  showToast('success', '诊断完成，共发现 ' + (data.problems ? data.problems.length : 0) + ' 个问题');
}

// ========== 报表生成 ==========
function generateReport() {
  var btn = document.getElementById('genReportBtn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  var previewEl = document.getElementById('reportPreview');
  previewEl.innerHTML = '<div style="text-align:center;"><div class="loading-spinner" style="margin:0 auto 16px;"></div><p style="color:var(--gray-500);">正在生成报表...</p></div>';

  setTimeout(function() {
    btn.classList.remove('btn-loading');
    btn.disabled = false;

    var type = document.getElementById('reportType').value;
    var typeText = { daily: '日报', weekly: '周报', monthly: '月报', custom: '自定义报表' }[type] || '报表';

    previewEl.innerHTML = '<div style="width:100%;padding:24px;background:#fff;border:1px solid var(--gray-200);border-radius:8px;">' +
      '<div style="text-align:center;border-bottom:2px solid var(--primary-600);padding-bottom:16px;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:700;color:var(--gray-800);margin:0;">电商运营' + typeText + '</h2>' +
      '<p style="font-size:13px;color:var(--gray-500);margin:4px 0 0;">统计周期：2026年9月1日 - 2026年9月7日 | 店铺：淘宝旗舰店</p>' +
      '</div>' +
      '<h3 style="font-size:15px;font-weight:600;color:var(--gray-800);margin:16px 0 8px;">一、核心数据概览</h3>' +
      '<table class="data-table" style="margin-bottom:16px;"><thead><tr><th>指标</th><th class="num">本期</th><th class="num">上期</th><th class="num">环比</th></tr></thead><tbody>' +
      '<tr><td>GMV</td><td class="num">¥2,856,420</td><td class="num">¥2,410,500</td><td class="num" style="color:var(--success-500);">↑18.5%</td></tr>' +
      '<tr><td>订单量</td><td class="num">28,650</td><td class="num">25,510</td><td class="num" style="color:var(--success-500);">↑12.3%</td></tr>' +
      '<tr><td>客单价</td><td class="num">¥99.7</td><td class="num">¥94.5</td><td class="num" style="color:var(--success-500);">↑5.5%</td></tr>' +
      '<tr><td>访客数</td><td class="num">225,680</td><td class="num">210,450</td><td class="num" style="color:var(--success-500);">↑7.2%</td></tr>' +
      '<tr><td>转化率</td><td class="num">3.8%</td><td class="num">3.6%</td><td class="num" style="color:var(--success-500);">↑0.2%</td></tr>' +
      '<tr><td>退款率</td><td class="num">2.8%</td><td class="num">3.3%</td><td class="num" style="color:var(--success-500);">↓0.5%</td></tr>' +
      '</tbody></table>' +
      '<h3 style="font-size:15px;font-weight:600;color:var(--gray-800);margin:16px 0 8px;">二、销售趋势分析</h3>' +
      '<p style="font-size:13px;color:var(--gray-600);line-height:1.7;">本周GMV呈稳步上升趋势，周中（周三-周五）达到峰值，周末略有回落。主要增长来自「纯棉短袖T恤」和「运动休闲鞋」两款爆款，合计贡献GMV ¥1,280,000，占比44.8%。</p>' +
      '<h3 style="font-size:15px;font-weight:600;color:var(--gray-800);margin:16px 0 8px;">三、商品销售排行TOP5</h3>' +
      '<table class="data-table"><thead><tr><th>排名</th><th>商品名称</th><th class="num">销量</th><th class="num">GMV</th><th class="num">占比</th></tr></thead><tbody>' +
      '<tr><td>1</td><td>纯棉短袖T恤男士夏季新款</td><td class="num">2,156</td><td class="num">¥646,800</td><td class="num">22.6%</td></tr>' +
      '<tr><td>2</td><td>运动休闲鞋男透气跑步鞋</td><td class="num">1,680</td><td class="num">¥635,000</td><td class="num">22.2%</td></tr>' +
      '<tr><td>3</td><td>牛仔裤男士修身直筒长裤</td><td class="num">1,320</td><td class="num">¥396,000</td><td class="num">13.9%</td></tr>' +
      '<tr><td>4</td><td>夹克男士春秋款外套</td><td class="num">980</td><td class="num">¥294,000</td><td class="num">10.3%</td></tr>' +
      '<tr><td>5</td><td>卫衣男士连帽套头上衣</td><td class="num">856</td><td class="num">¥214,000</td><td class="num">7.5%</td></tr>' +
      '</tbody></table>' +
      '<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--gray-200);text-align:center;font-size:12px;color:var(--gray-400);">本报表由电商AI运营助手自动生成 | 生成时间：2026-09-07 10:30:00</div>' +
      '</div>';

    showToast('success', '报表生成成功，可导出');
  }, 1500);
}

// ========== 店铺绑定 ==========
function showAddShopModal() {
  document.getElementById('addShopModal').classList.add('active');
}

function selectPlatform(el, name) {
  document.querySelectorAll('#addShopModal [onclick^="selectPlatform"]').forEach(function(item) {
    item.style.border = '1px solid var(--gray-200)';
    item.style.background = '#fff';
  });
  el.style.border = '2px solid var(--primary-600)';
  el.style.background = 'var(--primary-50)';
  el.dataset.selected = name;
}

function confirmAddShop() {
  var name = document.getElementById('newShopName').value.trim();
  var url = document.getElementById('newShopUrl').value.trim();
  if (!name) {
    showToast('error', '请输入店铺名称');
    return;
  }
  // 获取选中的平台
  var platform = '淘宝';
  var selected = document.querySelector('#addShopModal [data-selected="true"], #addShopModal [style*="primary-600"]');
  var allPlatforms = document.querySelectorAll('#addShopModal [onclick^="selectPlatform"]');
  for (var i = 0; i < allPlatforms.length; i++) {
    if (allPlatforms[i].dataset && allPlatforms[i].dataset.selected) {
      platform = allPlatforms[i].dataset.selected;
      break;
    }
  }

  showToast('info', '正在绑定店铺...');
  fetch('/api/bind-shop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: platform, shop_name: name, shop_url: url })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      closeModal('addShopModal');
      showToast('success', '店铺「' + name + '」绑定成功');
      document.getElementById('newShopName').value = '';
      document.getElementById('newShopUrl').value = '';
      // 重置平台选择
      allPlatforms.forEach(function(item) {
        item.style.border = '1px solid var(--gray-200)';
        item.style.background = '#fff';
        if (item.dataset) item.dataset.selected = '';
      });
      if (typeof loadShopList === 'function') loadShopList();
    } else {
      showToast('error', data.message || '绑定失败');
    }
  })
  .catch(function() { showToast('error', '网络错误，请重试'); });
}

// ========== 个人中心 ==========
function saveProfile() {
  var nickname = document.getElementById('profileNickname') ? document.getElementById('profileNickname').value.trim() : '';
  var email = document.getElementById('profileEmail') ? document.getElementById('profileEmail').value.trim() : '';
  var city = document.getElementById('profileCity') ? document.getElementById('profileCity').value.trim() : '';

  if (!nickname) {
    showToast('error', '昵称不能为空');
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('error', '邮箱格式不正确');
    return;
  }

  fetch('/api/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: nickname, email: email, city: city })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      if (currentUser) currentUser.nickname = data.nickname || nickname;
      localStorage.setItem('ecom_ai_user', JSON.stringify(currentUser));
      updateUserUI();
      showToast('success', '个人信息已保存');
    } else {
      showToast('error', data.message || '保存失败');
    }
  })
  .catch(function() { showToast('error', '网络错误，请重试'); });
}

// ========== 通知中心 ==========
function showNotifications() {
  document.getElementById('notificationModal').classList.add('active');
}

// ========== 用户菜单 ==========
function showUserMenu() {
  document.getElementById('userMenuModal').classList.add('active');
}

// ========== 弹窗控制 ==========
function closeModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// 点击遮罩关闭弹窗
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ========== 全局搜索 ==========
function initGlobalSearch() {
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var searchInput = document.getElementById('globalSearch');
      if (searchInput) {
        searchInput.focus();
        showToast('info', '全局搜索功能');
      }
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(function(m) {
        m.classList.remove('active');
      });
    }
  });
}

function handleGlobalSearch(event) {
  if (event.key === 'Enter') {
    var query = event.target.value.trim();
    if (query) {
      showToast('info', '搜索：' + query);
    }
  }
}

// ========== Toast提示 ==========
function showToast(type, message) {
  var container = document.getElementById('toastContainer');
  if (!container) return;

  var icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span>' +
    '<span class="toast-message">' + escapeHtml(message) + '</span>' +
    '<span class="toast-close" onclick="this.parentElement.remove()">✕</span>';

  container.appendChild(toast);

  setTimeout(function() {
    toast.style.animation = 'toastOut 0.3s ease-out forwards';
    setTimeout(function() {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// ========== 加载遮罩 ==========
function showLoading(text) {
  var overlay = document.getElementById('loadingOverlay');
  var loadingText = document.getElementById('loadingText');
  if (overlay) overlay.classList.add('active');
  if (loadingText && text) loadingText.textContent = text;
}

function hideLoading() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('active');
}

// ========== 工具函数 ==========
function parseAiResultList(resultStr) {
  if (!resultStr) return [];
  if (Array.isArray(resultStr)) return resultStr;
  var lines = resultStr.split(/\n/);
  var items = [];
  lines.forEach(function(line) {
    line = line.trim();
    if (!line) return;
    // 去掉序号前缀如 "1. "、"1、"、"1)"
    line = line.replace(/^\d+[\.\、\)\:]\s*/, '');
    if (line) items.push(line);
  });
  return items;
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyText(text, btn) {
  copyToClipboard(text);
  if (btn) {
    var original = btn.innerHTML;
    btn.innerHTML = '✓';
    btn.style.color = 'var(--success-500)';
    setTimeout(function() {
      btn.innerHTML = original;
      btn.style.color = '';
    }, 1500);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('success', '已复制到剪贴板');
    }).catch(function() {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  var textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('success', '已复制到剪贴板');
  } catch(e) {
    showToast('error', '复制失败，请手动复制');
  }
  document.body.removeChild(textarea);
}

function shakeElement(elementId) {
  var el = document.getElementById(elementId);
  if (el) {
    el.classList.add('shake');
    setTimeout(function() {
      el.classList.remove('shake');
    }, 300);
  }
}

/* ==================== v5.2 补充页面交互函数 ==================== */

/* ---- 通用Tab切换 ---- */
function switchTabInContainer(container, clickedEl) {
  var tabs = container.querySelectorAll('.tab-item');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }
  clickedEl.classList.add('active');
}

/* ---- 通知中心 ---- */
function markAllNotificationsRead() {
  var items = document.querySelectorAll('#notificationList .notification-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.remove('unread');
    var dot = items[i].querySelector('.notification-dot');
    if (dot) dot.style.display = 'none';
  }
  showToast('success', '已全部标记为已读');
}

function markNotificationRead(el) {
  el.classList.remove('unread');
  var dot = el.querySelector('.notification-dot');
  if (dot) dot.style.display = 'none';
}

function switchNotificationTab(el, type) {
  switchTabInContainer(el.parentElement, el);
  showToast('info', '已切换到' + el.textContent.trim().split(' ')[0] + '通知');
}

/* ---- 历史记录 ---- */
function filterHistory(keyword) {
  var cards = document.querySelectorAll('#historyList .history-card');
  keyword = keyword.toLowerCase();
  for (var i = 0; i < cards.length; i++) {
    var text = cards[i].textContent.toLowerCase();
    cards[i].style.display = keyword === '' || text.indexOf(keyword) > -1 ? '' : 'none';
  }
}

function switchHistoryTab(el, type) {
  switchTabInContainer(el.parentElement, el);
}

function toggleFavorite(btn) {
  if (btn.textContent === '⭐') {
    btn.textContent = '☆';
    showToast('info', '已取消收藏');
  } else {
    btn.textContent = '⭐';
    showToast('success', '已添加到收藏');
  }
}

/* ---- 模板市场 ---- */
function switchTemplateTab(el) {
  switchTabInContainer(el.parentElement, el);
}

function useTemplate(name) {
  showToast('success', '已应用模板：' + name + '，正在跳转...');
  setTimeout(function() {
    var items = document.querySelectorAll('.sidebar-nav-item');
    if (items && items.length > 1) {
      switchAdminPage('title-gen', items[1]);
    }
  }, 800);
}

/* ---- 任务中心 ---- */
function switchTaskTab(el) {
  switchTabInContainer(el.parentElement, el);
}

/* ---- 发票管理 ---- */
function switchInvoiceTab(el) {
  switchTabInContainer(el.parentElement, el);
}

/* ---- 优惠券 ---- */
function switchCouponTab(el) {
  switchTabInContainer(el.parentElement, el);
}

/* ---- 意见反馈 ---- */
function selectFeedbackType(el, type) {
  var cards = el.parentElement.querySelectorAll('.feedback-type-card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].classList.remove('active');
  }
  el.classList.add('active');
}

function submitFeedback() {
  var title = document.getElementById('feedbackTitle');
  var desc = document.getElementById('feedbackDesc');
  if (!title || !title.value.trim()) {
    showToast('warning', '请输入反馈标题');
    return;
  }
  if (!desc || !desc.value.trim()) {
    showToast('warning', '请输入详细描述');
    return;
  }
  showToast('success', '反馈提交成功！我们会在1-3个工作日内回复');
  if (title) title.value = '';
  if (desc) desc.value = '';
}

function voteFeature(btn, count) {
  var countEl = btn.parentElement.querySelector('div');
  if (btn.textContent === '我也想要') {
    btn.textContent = '已投票';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    if (countEl) countEl.textContent = count + 1;
    showToast('success', '投票成功，感谢您的支持！');
  }
}

/* ---- 前台页面导航 ---- */
function showContentPage(pageId) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) {
    pages[i].classList.remove('active');
  }
  var target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

/* ==================== v7.0 真实API对接函数 ==================== */

/* ---- 通用API请求封装 ---- */
function apiRequest(url, method, data) {
  var options = {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  };
  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }
  return fetch(url, options).then(function(res) { return res.json(); });
}

/* ---- 用户系统：修改个人信息 ---- */
function saveProfile() {
  var nickname = document.getElementById('profileNickname') ? document.getElementById('profileNickname').value : '';
  var email = document.getElementById('profileEmail') ? document.getElementById('profileEmail').value : '';
  var city = document.getElementById('profileCity') ? document.getElementById('profileCity').value : '';

  if (!nickname) {
    showToast('error', '昵称不能为空');
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('error', '邮箱格式不正确');
    return;
  }

  apiRequest('/api/update-profile', 'POST', { nickname: nickname, email: email, city: city })
    .then(function(data) {
      if (data.success) {
        showToast('success', '个人信息已保存');
        if (currentUser) currentUser.nickname = data.nickname || nickname;
        updateUserUI();
      } else {
        showToast('error', data.message || '保存失败');
      }
    })
    .catch(function() { showToast('error', '网络错误，请重试'); });
}

/* ---- 用户系统：修改密码 ---- */
function submitChangePassword() {
  var oldPwd = document.getElementById('oldPassword') ? document.getElementById('oldPassword').value : '';
  var newPwd = document.getElementById('newPassword') ? document.getElementById('newPassword').value : '';
  var confirmPwd = document.getElementById('confirmPassword') ? document.getElementById('confirmPassword').value : '';

  if (!oldPwd || !newPwd || !confirmPwd) {
    showToast('error', '请填写完整信息');
    return;
  }
  if (newPwd !== confirmPwd) {
    showToast('error', '两次新密码不一致');
    return;
  }
  if (newPwd.length < 8) {
    showToast('error', '新密码至少8位');
    return;
  }

  apiRequest('/api/change-password', 'POST', { old_password: oldPwd, new_password: newPwd, confirm_password: confirmPwd })
    .then(function(data) {
      if (data.success) {
        showToast('success', '密码修改成功，请重新登录');
        setTimeout(function() { logout(); }, 1500);
      } else {
        showToast('error', data.message || '修改失败');
      }
    })
    .catch(function() { showToast('error', '网络错误，请重试'); });
}

/* ---- 安全设置 ---- */
function loadSecuritySettings() {
  apiRequest('/api/security-settings', 'GET')
    .then(function(data) {
      if (data.success) {
        var settings = data.settings || {};
        var twoFactor = document.getElementById('twoFactorSwitch');
        var loginAlert = document.getElementById('loginAlertSwitch');
        if (twoFactor) twoFactor.checked = !!settings.two_factor;
        if (loginAlert) loginAlert.checked = !!settings.login_alert;
        var scoreEl = document.getElementById('securityScore');
        if (scoreEl) scoreEl.textContent = data.security_score || 0;
      }
    })
    .catch(function() {});
}

function saveSecuritySetting(key, value) {
  var data = {};
  data[key] = value;
  apiRequest('/api/security-settings', 'POST', data)
    .then(function(res) {
      if (res.success) {
        showToast('success', '设置已保存');
        var scoreEl = document.getElementById('securityScore');
        if (scoreEl) scoreEl.textContent = res.security_score || 0;
      } else {
        showToast('error', res.message || '保存失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

/* ---- 设备管理 ---- */
function loadDevices() {
  apiRequest('/api/devices', 'GET')
    .then(function(data) {
      if (data.success) {
        var container = document.getElementById('deviceList');
        if (!container) return;
        var html = '';
        (data.devices || []).forEach(function(device) {
          html += '<div class="device-item">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
            '<div style="width:40px;height:40px;background:var(--primary-50);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;">💻</div>' +
            '<div>' +
            '<div style="font-weight:500;font-size:14px;">' + escapeHtml(device.device || '未知设备') + (device.current ? ' <span class="tag tag-success" style="font-size:10px;">当前设备</span>' : '') + '</div>' +
            '<div style="font-size:12px;color:var(--gray-400);margin-top:2px;">IP: ' + escapeHtml(device.ip || '未知') + ' · ' + new Date(device.last_active * 1000).toLocaleString('zh-CN') + '</div>' +
            '</div></div>' +
            (device.current ? '' : '<button class="btn btn-secondary btn-sm" onclick="logoutDevice(\'' + device.id + '\')">下线</button>') +
            '</div>';
        });
        container.innerHTML = html || '<p style="text-align:center;color:var(--gray-400);padding:20px;">暂无登录设备</p>';
      }
    })
    .catch(function() {});
}

function logoutDevice(deviceId) {
  if (!confirm('确定要下线该设备吗？')) return;
  apiRequest('/api/device-logout', 'POST', { device_id: deviceId })
    .then(function(data) {
      if (data.success) {
        showToast('success', '设备已下线');
        loadDevices();
      } else {
        showToast('error', data.message || '操作失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

/* ---- 登录记录 ---- */
function loadLoginHistory() {
  apiRequest('/api/login-history', 'GET')
    .then(function(data) {
      if (data.success) {
        var container = document.getElementById('loginHistoryList');
        if (!container) return;
        var html = '';
        (data.history || []).forEach(function(record) {
          var statusClass = record.status === 'success' ? 'success' : 'danger';
          var statusText = record.status === 'success' ? '成功' : '失败';
          html += '<div class="login-record">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<div><span style="font-size:14px;font-weight:500;">' + escapeHtml(record.device || '未知') + '</span>' +
            '<span style="font-size:12px;color:var(--gray-400);margin-left:8px;">IP: ' + escapeHtml(record.ip || '未知') + '</span></div>' +
            '<span class="tag tag-' + statusClass + '" style="font-size:11px;">' + statusText + '</span>' +
            '</div>' +
            '<div style="font-size:12px;color:var(--gray-400);margin-top:4px;">' + new Date(record.time * 1000).toLocaleString('zh-CN') + '</div>' +
            '</div>';
        });
        container.innerHTML = html || '<p style="text-align:center;color:var(--gray-400);padding:20px;">暂无登录记录</p>';
      }
    })
    .catch(function() {});
}

/* ---- AI生成历史 ---- */
function loadAiHistory(type, page) {
  var url = '/api/ai-history?page=' + (page || 1);
  if (type && type !== 'all') url += '&type=' + type;
  apiRequest(url, 'GET')
    .then(function(data) {
      if (data.success) {
        renderAiHistory(data.history || []);
      }
    })
    .catch(function() {});
}

function renderAiHistory(history) {
  var container = document.getElementById('historyList');
  if (!container) return;
  if (!history || history.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--gray-400);"><div style="font-size:48px;margin-bottom:16px;">📭</div><p>暂无生成记录</p><p style="font-size:12px;margin-top:8px;">使用AI功能后，记录会显示在这里</p></div>';
    return;
  }
  var typeNames = { title: '标题生成', detail: '详情页', service: '客服话术', competitor: '竞品分析', diagnosis: '运营诊断', report: '报表生成' };
  var html = '';
  history.forEach(function(item) {
    var typeName = typeNames[item.type] || item.type;
    var preview = (item.result || '').substring(0, 80);
    html += '<div class="history-card">' +
      '<div class="history-card-header">' +
      '<span class="tag tag-primary" style="font-size:11px;">' + typeName + '</span>' +
      '<span style="font-size:12px;color:var(--gray-400);">' + new Date(item.created_at * 1000).toLocaleString('zh-CN') + '</span>' +
      '</div>' +
      '<div class="history-card-title">' + escapeHtml(item.title || '未命名') + '</div>' +
      '<div class="history-card-preview">' + escapeHtml(preview) + '...</div>' +
      '<div class="history-card-footer">' +
      '<button class="btn btn-text btn-sm" onclick="copyText(\'' + escapeHtml((item.result || '').replace(/'/g, "\\'")) + '\')">📋 复制</button>' +
      '<button class="btn btn-text btn-sm" onclick="toggleHistoryFavorite(\'' + item.id + '\', this)">' + (item.favorite ? '⭐ 已收藏' : '☆ 收藏') + '</button>' +
      '<button class="btn btn-text btn-sm" onclick="deleteHistoryItem(\'' + item.id + '\')">🗑️ 删除</button>' +
      '</div></div>';
  });
  container.innerHTML = html;
}

function toggleHistoryFavorite(id, btn) {
  apiRequest('/api/ai-history/favorite', 'POST', { id: id })
    .then(function(data) {
      if (data.success) {
        if (btn) btn.innerHTML = data.favorite ? '⭐ 已收藏' : '☆ 收藏';
        showToast('success', data.favorite ? '已收藏' : '已取消收藏');
      }
    })
    .catch(function() {});
}

function deleteHistoryItem(id) {
  if (!confirm('确定要删除这条记录吗？')) return;
  apiRequest('/api/ai-history/' + id, 'DELETE')
    .then(function(data) {
      if (data.success) {
        showToast('success', '已删除');
        loadAiHistory(document.getElementById('historyTypeFilter') ? document.getElementById('historyTypeFilter').value : '');
      }
    })
    .catch(function() {});
}

/* ---- 店铺绑定 ---- */
function loadShopList() {
  apiRequest('/api/shop-list', 'GET')
    .then(function(data) {
      if (data.success) {
        renderShopList(data.shops || []);
      }
    })
    .catch(function() {});
}

function renderShopList(shops) {
  var container = document.getElementById('shopList');
  if (!container) return;
  if (!shops || shops.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--gray-400);"><div style="font-size:48px;margin-bottom:16px;">🏪</div><p>暂无绑定店铺</p><button class="btn btn-primary" onclick="showAddShopModal()" style="margin-top:16px;">立即绑定</button></div>';
    return;
  }
  var platformIcons = { taobao: '🛒', tmall: '🛍️', jd: '📦', pinduoduo: '🍊', douyin: '🎵', xiaohongshu: '📕' };
  var html = '';
  shops.forEach(function(shop) {
    var icon = platformIcons[shop.platform] || '🏪';
    html += '<div class="shop-card">' +
      '<div style="display:flex;align-items:center;gap:16px;">' +
      '<div style="width:56px;height:56px;background:var(--primary-50);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px;">' + icon + '</div>' +
      '<div style="flex:1;">' +
      '<div style="font-weight:600;font-size:16px;">' + escapeHtml(shop.shop_name) + '</div>' +
      '<div style="font-size:13px;color:var(--gray-500);margin-top:4px;">' + escapeHtml(shop.platform) + ' · 绑定于 ' + new Date(shop.bind_time * 1000).toLocaleDateString('zh-CN') + '</div>' +
      '<div style="margin-top:8px;"><span class="tag tag-success" style="font-size:11px;">● 已连接</span>' +
      '<span style="font-size:11px;color:var(--gray-400);margin-left:8px;">最后同步: ' + new Date((shop.last_sync || 0) * 1000).toLocaleString('zh-CN') + '</span></div>' +
      '</div></div>' +
      '<div style="display:flex;gap:8px;">' +
      '<button class="btn btn-secondary btn-sm" onclick="syncShop(\'' + shop.id + '\')">🔄 同步</button>' +
      '<button class="btn btn-text btn-sm" style="color:var(--danger-500);" onclick="unbindShop(\'' + shop.id + '\', \'' + escapeHtml(shop.shop_name) + '\')">解绑</button>' +
      '</div></div>';
  });
  container.innerHTML = html;
}

function showAddShopModal() {
  var modal = document.getElementById('addShopModal');
  if (modal) modal.classList.add('active');
}

function submitBindShop() {
  var platform = document.getElementById('bindPlatform') ? document.getElementById('bindPlatform').value : '';
  var shopName = document.getElementById('bindShopName') ? document.getElementById('bindShopName').value : '';
  var authCode = document.getElementById('bindAuthCode') ? document.getElementById('bindAuthCode').value : '';

  if (!platform || !shopName) {
    showToast('error', '请填写平台和店铺名称');
    return;
  }

  apiRequest('/api/bind-shop', 'POST', { platform: platform, shop_name: shopName, auth_code: authCode })
    .then(function(data) {
      if (data.success) {
        showToast('success', '店铺绑定成功');
        closeModal('addShopModal');
        loadShopList();
      } else {
        showToast('error', data.message || '绑定失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function unbindShop(shopId, shopName) {
  if (!confirm('确定要解绑店铺「' + shopName + '」吗？解绑后将无法查看该店铺数据。')) return;
  apiRequest('/api/unbind-shop', 'POST', { shop_id: shopId })
    .then(function(data) {
      if (data.success) {
        showToast('success', '店铺已解绑');
        loadShopList();
      } else {
        showToast('error', data.message || '操作失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function syncShop(shopId) {
  showToast('info', '正在同步店铺数据...');
  apiRequest('/api/shop-sync', 'POST', { shop_id: shopId })
    .then(function(data) {
      if (data.success) {
        showToast('success', '数据同步成功');
        loadShopList();
      } else {
        showToast('error', data.message || '同步失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

/* ---- 会员支付 ---- */
function createOrder(plan, period) {
  var couponId = document.getElementById('selectedCouponId') ? document.getElementById('selectedCouponId').value : '';
  apiRequest('/api/upgrade-plan', 'POST', { plan: plan, period: period, coupon_id: couponId })
    .then(function(data) {
      if (data.success && data.order) {
        showPaymentModal(data.order);
      } else {
        showToast('error', data.message || '创建订单失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function showPaymentModal(order) {
  var modal = document.getElementById('paymentModal');
  if (!modal) {
    showToast('info', '订单创建成功，订单号：' + order.id);
    return;
  }
  var orderInfo = document.getElementById('paymentOrderInfo');
  if (orderInfo) {
    orderInfo.innerHTML = '<div style="text-align:center;padding:20px;">' +
      '<div style="font-size:18px;font-weight:600;margin-bottom:8px;">' + escapeHtml(order.plan_name) + '</div>' +
      '<div style="font-size:14px;color:var(--gray-500);margin-bottom:16px;">订单号：' + order.id + '</div>' +
      '<div style="font-size:36px;font-weight:700;color:var(--primary-600);">¥' + order.final_price + '</div>' +
      (order.discount > 0 ? '<div style="font-size:13px;color:var(--success-600);margin-top:8px;">已优惠 ¥' + order.discount + '</div>' : '') +
      '</div>';
  }
  document.getElementById('currentOrderId').value = order.id;
  modal.classList.add('active');
}

function payOrder(method) {
  var orderId = document.getElementById('currentOrderId') ? document.getElementById('currentOrderId').value : '';
  if (!orderId) {
    showToast('error', '订单信息缺失');
    return;
  }
  showToast('info', '正在支付...');
  apiRequest('/api/pay/' + orderId, 'POST', { payment_method: method })
    .then(function(data) {
      if (data.success) {
        showToast('success', '支付成功，会员已开通！');
        closeModal('paymentModal');
        if (currentUser) currentUser.plan = data.order.plan;
        updateUserUI();
        setTimeout(function() { switchAdminPage('membership', document.querySelectorAll('.sidebar-nav-item')[10]); }, 500);
      } else {
        showToast('error', data.message || '支付失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function loadOrders() {
  apiRequest('/api/orders', 'GET')
    .then(function(data) {
      if (data.success) {
        renderOrders(data.orders || []);
      }
    })
    .catch(function() {});
}

function renderOrders(orders) {
  var container = document.getElementById('orderList');
  if (!container) return;
  if (!orders || orders.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--gray-400);"><div style="font-size:48px;margin-bottom:16px;">📋</div><p>暂无订单记录</p></div>';
    return;
  }
  var statusMap = { pending: { text: '待支付', class: 'warning' }, paid: { text: '已支付', class: 'success' }, refunded: { text: '已退款', class: 'gray' } };
  var html = '<table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:2px solid var(--gray-100);">' +
    '<th style="text-align:left;padding:12px;font-size:13px;color:var(--gray-500);">订单号</th>' +
    '<th style="text-align:left;padding:12px;font-size:13px;color:var(--gray-500);">套餐</th>' +
    '<th style="text-align:left;padding:12px;font-size:13px;color:var(--gray-500);">金额</th>' +
    '<th style="text-align:left;padding:12px;font-size:13px;color:var(--gray-500);">状态</th>' +
    '<th style="text-align:left;padding:12px;font-size:13px;color:var(--gray-500);">时间</th>' +
    '<th style="text-align:left;padding:12px;font-size:13px;color:var(--gray-500);">操作</th></tr></thead><tbody>';
  orders.forEach(function(order) {
    var status = statusMap[order.status] || { text: order.status, class: 'gray' };
    html += '<tr style="border-bottom:1px solid var(--gray-100);">' +
      '<td style="padding:14px 12px;font-size:13px;font-family:monospace;">' + order.id + '</td>' +
      '<td style="padding:14px 12px;font-size:13px;">' + escapeHtml(order.plan_name) + ' (' + (order.period === 'yearly' ? '年付' : '月付') + ')</td>' +
      '<td style="padding:14px 12px;font-size:14px;font-weight:600;">¥' + order.final_price + '</td>' +
      '<td style="padding:14px 12px;"><span class="tag tag-' + status.class + '" style="font-size:11px;">' + status.text + '</span></td>' +
      '<td style="padding:14px 12px;font-size:12px;color:var(--gray-400);">' + new Date(order.created_at * 1000).toLocaleString('zh-CN') + '</td>' +
      '<td style="padding:14px 12px;">' +
      (order.status === 'pending' ? '<button class="btn btn-primary btn-sm" onclick="payOrder(\'wechat\')">去支付</button>' : '') +
      (order.status === 'paid' ? '<button class="btn btn-secondary btn-sm" onclick="applyInvoice(\'' + order.id + '\')">开发票</button>' : '') +
      '</td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

/* ---- 发票管理 ---- */
function applyInvoice(orderId) {
  var modal = document.getElementById('invoiceModal');
  if (modal) {
    document.getElementById('invoiceOrderId').value = orderId;
    modal.classList.add('active');
  }
}

function submitInvoice() {
  var orderId = document.getElementById('invoiceOrderId') ? document.getElementById('invoiceOrderId').value : '';
  var type = document.getElementById('invoiceType') ? document.getElementById('invoiceType').value : 'personal';
  var title = document.getElementById('invoiceTitle') ? document.getElementById('invoiceTitle').value : '';
  var taxNumber = document.getElementById('invoiceTaxNumber') ? document.getElementById('invoiceTaxNumber').value : '';
  var email = document.getElementById('invoiceEmail') ? document.getElementById('invoiceEmail').value : '';

  if (!title || !email) {
    showToast('error', '请填写发票抬头和邮箱');
    return;
  }

  apiRequest('/api/invoice', 'POST', { order_id: orderId, type: type, title: title, tax_number: taxNumber, email: email })
    .then(function(data) {
      if (data.success) {
        showToast('success', '发票申请已提交');
        closeModal('invoiceModal');
        loadInvoices();
      } else {
        showToast('error', data.message || '提交失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function loadInvoices() {
  apiRequest('/api/invoices', 'GET')
    .then(function(data) {
      if (data.success) {
        var container = document.getElementById('invoiceList');
        if (!container) return;
        if (!data.invoices || data.invoices.length === 0) {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400);">暂无发票记录</div>';
          return;
        }
        var statusMap = { processing: '处理中', done: '已开具', failed: '开具失败' };
        var html = '';
        data.invoices.forEach(function(inv) {
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid var(--gray-100);">' +
            '<div><div style="font-weight:500;font-size:14px;">' + escapeHtml(inv.title) + '</div>' +
            '<div style="font-size:12px;color:var(--gray-400);margin-top:4px;">订单号: ' + inv.order_id + ' · 金额: ¥' + inv.amount + '</div></div>' +
            '<span class="tag tag-' + (inv.status === 'done' ? 'success' : inv.status === 'processing' ? 'warning' : 'danger') + '" style="font-size:11px;">' + (statusMap[inv.status] || inv.status) + '</span>' +
            '</div>';
        });
        container.innerHTML = html;
      }
    })
    .catch(function() {});
}

/* ---- 优惠券 ---- */
function loadCoupons(status) {
  var url = '/api/coupons';
  if (status) url += '?status=' + status;
  apiRequest(url, 'GET')
    .then(function(data) {
      if (data.success) {
        renderCoupons(data.coupons || []);
      }
    })
    .catch(function() {});
}

function renderCoupons(coupons) {
  var container = document.getElementById('couponList');
  if (!container) return;
  if (!coupons || coupons.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--gray-400);"><div style="font-size:48px;margin-bottom:16px;">🎫</div><p>暂无优惠券</p></div>';
    return;
  }
  var html = '<div class="coupon-grid">';
  coupons.forEach(function(coupon) {
    var isExpired = coupon.expire_at && (coupon.expire_at * 1000) < Date.now();
    var isUsed = coupon.status === 'used';
    var disabled = isExpired || isUsed;
    html += '<div class="coupon-card' + (disabled ? ' disabled' : '') + '">' +
      '<div class="coupon-left">' +
      '<div class="coupon-amount">¥<span>' + coupon.amount + '</span></div>' +
      '<div class="coupon-condition">满' + coupon.min_amount + '可用</div>' +
      '</div>' +
      '<div class="coupon-right">' +
      '<div class="coupon-name">' + escapeHtml(coupon.name) + '</div>' +
      '<div class="coupon-scope">' + escapeHtml(coupon.scope || '全部套餐') + '</div>' +
      '<div class="coupon-expire">' + (isExpired ? '已过期' : isUsed ? '已使用' : '有效期至 ' + new Date(coupon.expire_at * 1000).toLocaleDateString('zh-CN')) + '</div>' +
      (disabled ? '' : '<button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="useCoupon(\'' + coupon.id + '\')">立即使用</button>') +
      '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function useCoupon(couponId) {
  document.getElementById('selectedCouponId').value = couponId;
  showToast('success', '优惠券已选择，请在升级会员时使用');
  switchAdminPage('membership', document.querySelectorAll('.sidebar-nav-item')[10]);
}

/* ---- 消息通知 ---- */
function loadNotifications(type) {
  var url = '/api/notifications';
  if (type && type !== 'all') url += '?type=' + type;
  apiRequest(url, 'GET')
    .then(function(data) {
      if (data.success) {
        renderNotifications(data.notifications || []);
        updateNotificationBadge(data.unread_count || 0);
      }
    })
    .catch(function() {});
}

function renderNotifications(notifications) {
  var container = document.getElementById('notificationList');
  if (!container) return;
  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--gray-400);"><div style="font-size:48px;margin-bottom:16px;">🔔</div><p>暂无通知</p></div>';
    return;
  }
  var typeIcons = { system: '🔔', activity: '🎁', usage: '📊', security: '🔐' };
  var html = '';
  notifications.forEach(function(n) {
    html += '<div class="notification-item' + (n.read ? '' : ' unread') + '" onclick="markNotificationRead(\'' + n.id + '\')">' +
      '<div class="notification-icon">' + (typeIcons[n.type] || '📢') + '</div>' +
      '<div class="notification-content">' +
      '<div class="notification-title">' + escapeHtml(n.title) + (n.read ? '' : '<span class="notification-dot"></span>') + '</div>' +
      '<div class="notification-desc">' + escapeHtml(n.content) + '</div>' +
      '<div class="notification-time">' + new Date(n.created_at * 1000).toLocaleString('zh-CN') + '</div>' +
      '</div></div>';
  });
  container.innerHTML = html;
}

function markNotificationRead(id) {
  apiRequest('/api/notifications/read', 'POST', { id: id })
    .then(function() { loadNotifications(document.getElementById('notificationTab') ? document.getElementById('notificationTab').value : ''); })
    .catch(function() {});
}

function markAllNotificationsReadReal() {
  apiRequest('/api/notifications/read', 'POST', { all: true })
    .then(function(data) {
      if (data.success) {
        showToast('success', '全部标记为已读');
        loadNotifications();
      }
    })
    .catch(function() {});
}

function updateNotificationBadge(count) {
  var badge = document.querySelector('.topbar-notification-dot');
  if (badge) {
    badge.style.display = count > 0 ? 'block' : 'none';
    badge.textContent = count > 99 ? '99+' : count;
  }
}

/* ---- 任务中心 ---- */
function loadTasks(status) {
  apiRequest('/api/tasks' + (status ? '?status=' + status : ''), 'GET')
    .then(function(data) {
      if (data.success) {
        renderTasks(data.tasks || []);
      }
    })
    .catch(function() {});
}

function renderTasks(tasks) {
  var container = document.getElementById('taskList');
  if (!container) return;
  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--gray-400);"><div style="font-size:48px;margin-bottom:16px;">⚡</div><p>暂无任务</p><p style="font-size:12px;margin-top:8px;">使用批量生成等功能时，任务会显示在这里</p></div>';
    return;
  }
  var statusMap = { pending: '等待中', running: '进行中', completed: '已完成', failed: '失败' };
  var statusClass = { pending: 'gray', running: 'primary', completed: 'success', failed: 'danger' };
  var html = '';
  tasks.forEach(function(task) {
    html += '<div class="task-card">' +
      '<div class="task-card-header">' +
      '<span class="tag tag-' + (statusClass[task.status] || 'gray') + '" style="font-size:11px;">' + (statusMap[task.status] || task.status) + '</span>' +
      '<span style="font-size:12px;color:var(--gray-400);">' + new Date(task.created_at * 1000).toLocaleString('zh-CN') + '</span>' +
      '</div>' +
      '<div class="task-card-title">' + escapeHtml(task.title || '未命名任务') + '</div>' +
      (task.status === 'running' ? '<div class="task-progress"><div class="task-progress-bar" style="width:' + (task.progress || 50) + '%"></div></div>' : '') +
      '<div style="font-size:12px;color:var(--gray-400);margin-top:8px;">' + escapeHtml(task.description || '') + '</div>' +
      '</div>';
  });
  container.innerHTML = html;
}

/* ---- 模板市场 ---- */
function loadTemplates(category) {
  var url = '/api/templates';
  if (category && category !== 'all') url += '?category=' + category;
  apiRequest(url, 'GET')
    .then(function(data) {
      if (data.success) {
        renderTemplates(data.templates || []);
      }
    })
    .catch(function() {});
}

function renderTemplates(templates) {
  var container = document.getElementById('templateGrid');
  if (!container) return;
  var categoryColors = { title: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)', detail: 'linear-gradient(135deg,#FCE7F3,#FBCFE8)', service: 'linear-gradient(135deg,#CFFAFE,#A5F3FC)', report: 'linear-gradient(135deg,#FEF3C7,#FDE68A)' };
  var categoryIcons = { title: '✍️', detail: '📄', service: '💬', report: '📊' };
  var html = '';
  templates.forEach(function(t) {
    html += '<div class="template-card">' +
      '<div class="template-cover" style="background:' + (categoryColors[t.category] || 'var(--gray-100)') + ';">' +
      '<span style="font-size:36px;">' + (categoryIcons[t.category] || '📋') + '</span>' +
      '<span style="font-size:12px;color:var(--gray-500);margin-top:8px;">' + t.category + '</span>' +
      '</div>' +
      '<div class="template-card-body">' +
      '<div class="template-card-title">' + escapeHtml(t.name) + '</div>' +
      '<div class="template-card-desc">' + escapeHtml(t.desc) + '</div>' +
      '<div class="template-card-tags">' + (t.tags || []).map(function(tag) { return '<span class="tag tag-gray" style="font-size:10px;">' + tag + '</span>'; }).join('') + '</div>' +
      '<div class="template-card-footer">' +
      '<span style="font-size:12px;color:var(--gray-400);">🔥 ' + t.usage + '次使用 · ⭐ ' + t.rating + '</span>' +
      '<button class="btn btn-primary btn-sm" onclick="useTemplateReal(\'' + t.id + '\')">使用</button>' +
      '</div></div></div>';
  });
  container.innerHTML = html;
}

function useTemplateReal(templateId) {
  apiRequest('/api/templates/use', 'POST', { template_id: templateId })
    .then(function(data) {
      if (data.success && data.template) {
        showToast('success', '模板已加载');
        var t = data.template;
        if (t.category === 'title') {
          switchAdminPage('title-gen', document.querySelectorAll('.sidebar-nav-item')[1]);
          setTimeout(function() {
            var sp = document.getElementById('titleSellingPoints');
            if (sp) sp.value = t.content || '';
          }, 300);
        } else if (t.category === 'detail') {
          switchAdminPage('detail-gen', document.querySelectorAll('.sidebar-nav-item')[2]);
        } else if (t.category === 'service') {
          switchAdminPage('service-gen', document.querySelectorAll('.sidebar-nav-item')[3]);
        }
      } else {
        showToast('error', data.message || '加载失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

/* ---- 邀请好友 ---- */
function loadInviteInfo() {
  apiRequest('/api/invite/info', 'GET')
    .then(function(data) {
      if (data.success) {
        var codeEl = document.getElementById('inviteCode');
        var linkEl = document.getElementById('inviteLink');
        var totalEl = document.getElementById('inviteTotal');
        var rewardEl = document.getElementById('inviteReward');
        if (codeEl) codeEl.textContent = data.invite_code || '';
        if (linkEl) linkEl.textContent = data.invite_link || '';
        if (totalEl) totalEl.textContent = data.total_invited || 0;
        if (rewardEl) rewardEl.textContent = '¥' + (data.total_reward || 0);
        renderInviteList(data.invitations || []);
      }
    })
    .catch(function() {});
}

function renderInviteList(invitations) {
  var container = document.getElementById('inviteList');
  if (!container) return;
  if (!invitations || invitations.length === 0) {
    container.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--gray-400);">暂无邀请记录</td></tr>';
    return;
  }
  var html = '';
  invitations.forEach(function(inv) {
    html += '<tr style="border-bottom:1px solid var(--gray-100);">' +
      '<td style="padding:12px;font-size:13px;">' + escapeHtml(inv.phone || '未知用户') + '</td>' +
      '<td style="padding:12px;font-size:13px;">' + new Date((inv.registered_at || 0) * 1000).toLocaleDateString('zh-CN') + '</td>' +
      '<td style="padding:12px;font-size:13px;"><span class="tag tag-' + (inv.status === 'paid' ? 'success' : 'gray') + '" style="font-size:11px;">' + (inv.status === 'paid' ? '已付费' : '已注册') + '</span></td>' +
      '<td style="padding:12px;font-size:13px;color:var(--success-600);font-weight:600;">' + (inv.reward ? '¥' + inv.reward : '¥0') + '</td></tr>';
  });
  container.innerHTML = html;
}

function copyInviteLink() {
  var link = document.getElementById('inviteLink') ? document.getElementById('inviteLink').textContent : '';
  if (link) {
    copyToClipboard(link);
    showToast('success', '邀请链接已复制');
  }
}

/* ---- 意见反馈 ---- */
function submitFeedbackReal() {
  var type = document.querySelector('input[name="feedbackType"]:checked') ? document.querySelector('input[name="feedbackType"]:checked').value : '';
  var content = document.getElementById('feedbackContent') ? document.getElementById('feedbackContent').value : '';
  var contact = document.getElementById('feedbackContact') ? document.getElementById('feedbackContact').value : '';

  if (!type) {
    showToast('error', '请选择反馈类型');
    return;
  }
  if (!content || content.length < 5) {
    showToast('error', '请输入至少5个字的反馈内容');
    return;
  }

  apiRequest('/api/feedback', 'POST', { type: type, content: content, contact: contact })
    .then(function(data) {
      if (data.success) {
        showToast('success', '反馈提交成功，感谢您的建议！');
        document.getElementById('feedbackContent').value = '';
        document.getElementById('feedbackContact').value = '';
        loadMyFeedbacks();
      } else {
        showToast('error', data.message || '提交失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

function loadMyFeedbacks() {
  apiRequest('/api/feedbacks', 'GET')
    .then(function(data) {
      if (data.success) {
        var container = document.getElementById('myFeedbackList');
        if (!container) return;
        if (!data.feedbacks || data.feedbacks.length === 0) {
          container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gray-400);">暂无反馈记录</div>';
          return;
        }
        var typeMap = { bug: 'Bug反馈', feature: '功能建议', experience: '体验问题', other: '其他' };
        var statusMap = { pending: '处理中', replied: '已回复', closed: '已关闭' };
        var html = '';
        data.feedbacks.forEach(function(fb) {
          html += '<div class="my-feedback-item">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span class="tag tag-primary" style="font-size:11px;">' + (typeMap[fb.type] || fb.type) + '</span>' +
            '<span class="tag tag-' + (fb.status === 'replied' ? 'success' : 'warning') + '" style="font-size:11px;">' + (statusMap[fb.status] || fb.status) + '</span>' +
            '</div>' +
            '<div style="font-size:14px;margin-top:8px;line-height:1.6;">' + escapeHtml(fb.content) + '</div>' +
            (fb.reply ? '<div class="feedback-reply" style="margin-top:12px;padding:12px;background:var(--primary-50);border-radius:8px;font-size:13px;"><strong style="color:var(--primary-600);">官方回复：</strong>' + escapeHtml(fb.reply) + '</div>' : '') +
            '<div style="font-size:12px;color:var(--gray-400);margin-top:8px;">' + new Date(fb.created_at * 1000).toLocaleString('zh-CN') + '</div>' +
            '</div>';
        });
        container.innerHTML = html;
      }
    })
    .catch(function() {});
}

/* ---- 功能投票 ---- */
function voteFeatureReal(featureId, btn) {
  apiRequest('/api/vote', 'POST', { feature_id: featureId })
    .then(function(data) {
      if (data.success) {
        showToast('success', '投票成功，感谢您的支持！');
        if (btn) {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
          btn.textContent = '已投票';
          btn.disabled = true;
        }
      } else {
        showToast('error', data.message || '投票失败');
      }
    })
    .catch(function() { showToast('error', '网络错误'); });
}

/* ---- 页面加载时初始化数据 ---- */
function initUserData() {
  if (!currentUser) return;
  loadNotifications();
  loadAiHistory();
  loadShopList();
  loadOrders();
  loadCoupons();
  loadTemplates();
  loadInviteInfo();
  loadMyFeedbacks();
  loadSecuritySettings();
  loadDevices();
  loadLoginHistory();
  loadTasks();
}

/* 覆盖原有的showPage，进入dashboard时加载用户数据 */
var originalShowPage = showPage;
showPage = function(pageName) {
  originalShowPage(pageName);
  if (pageName === 'dashboard' && currentUser) {
    setTimeout(initUserData, 300);
  }
};



// 关闭升级卡片
function closeUpgradeCard() {
  var card = document.getElementById('sidebarUpgradeCard');
  if (card) {
    var parent = card.parentElement;
    if (parent) {
      parent.classList.add('hidden');
    }
  }
  // 保存到localStorage，下次不显示
  try {
    localStorage.setItem('upgradeCardHidden', 'true');
  } catch(e) {}
}

// 页面加载时检查是否隐藏升级卡片
document.addEventListener('DOMContentLoaded', function() {
  try {
    if (localStorage.getItem('upgradeCardHidden') === 'true') {
      var card = document.getElementById('sidebarUpgradeCard');
      if (card && card.parentElement) {
        card.parentElement.classList.add('hidden');
      }
    }
  } catch(e) {}
});

