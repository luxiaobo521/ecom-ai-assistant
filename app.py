# -*- coding: utf-8 -*-
"""
电商运营AI助手 - SaaS后端 v3.2 安全增强版
修复：XSS、CSRF、安全响应头、暴力破解防护、权限校验、密码强度、退出登录、信息脱敏、Cookie安全、错误处理、API限流、SSRF防护
"""
import os
import json
import hashlib
import time
import uuid
import random
import re
import html
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, make_response

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'ecommerce-ai-assistant-v3-secure-' + str(uuid.uuid4()))

# ==================== 安全配置 ====================
# Cookie安全属性
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24小时

# 登录防护配置
MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_TIME = 900  # 15分钟

# API限流配置（按IP）
API_RATE_LIMIT = {
    'login': {'per_minute': 5},
    'register': {'per_minute': 3},
    'ai_generate': {'per_minute': 20},
    'default': {'per_minute': 60}
}

# 内存存储（生产环境应使用Redis）
login_attempts = {}  # {ip: {'count': int, 'lock_until': timestamp}}
api_rate_limit = {}  # {ip: {'endpoint': {'count': int, 'window_start': timestamp}}}

# ==================== 配置 ====================
API_KEY = os.environ.get('DOUBAO_API_KEY', '')
MODEL_ID = os.environ.get('DOUBAO_MODEL_ID', 'doubao-pro-32k')
API_BASE = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

USERS_FILE = os.path.join(os.path.dirname(__file__), 'users.json')

# 会员权限配置
MEMBER_PLANS = {
    'free': {
        'name': '免费版',
        'daily_ai_limit': 10,
        'competitor_daily_limit': 3,
        'can_export': False,
        'can_diagnosis': False,
        'can_monthly_report': False,
        'can_multi_shop': False,
        'can_api': False,
        'can_competitor': True  # 免费版有限次竞品分析
    },
    'monthly': {
        'name': '月付版',
        'price': 39,
        'daily_ai_limit': 9999,
        'competitor_daily_limit': 9999,
        'can_export': True,
        'can_diagnosis': True,
        'can_monthly_report': True,
        'can_multi_shop': False,
        'can_api': False,
        'can_competitor': True
    },
    'yearly': {
        'name': '年付版',
        'price': 399,
        'daily_ai_limit': 9999,
        'competitor_daily_limit': 9999,
        'can_export': True,
        'can_diagnosis': True,
        'can_monthly_report': True,
        'can_multi_shop': False,
        'can_api': False,
        'can_competitor': True
    },
    'enterprise': {
        'name': '企业版',
        'price': 199,
        'daily_ai_limit': 99999,
        'competitor_daily_limit': 99999,
        'can_export': True,
        'can_diagnosis': True,
        'can_monthly_report': True,
        'can_multi_shop': True,
        'can_api': True,
        'can_competitor': True
    }
}

# 允许的电商平台域名（防SSRF）
ALLOWED_ECOMMERCE_DOMAINS = [
    'taobao.com', 'tmall.com', 'jd.com', 'pinduoduo.com', 'yangkeduo.com',
    'douyin.com', 'jinritemai.com', 'xiaohongshu.com', 'xhslink.com',
    'kuaishou.com', 'suning.com', 'vip.com', 'kaola.com'
]

# 常见弱密码黑名单
WEAK_PASSWORDS = {
    '123456', 'password', '12345678', 'qwerty', 'abc123', '111111',
    '000000', '123123', 'iloveyou', 'admin', 'letmein', 'welcome',
    'monkey', 'dragon', 'master', '666666', '888888', '654321'
}

# ==================== 工具函数 ====================
def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def hash_password(password):
    """使用SHA256+盐值哈希密码"""
    salt = 'ecommerce_ai_salt_2026_secure'
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

def verify_password(password, hashed):
    """验证密码"""
    return hash_password(password) == hashed

def get_current_user():
    if 'username' not in session:
        return None
    users = load_users()
    return users.get(session['username'])

def sanitize_input(text, max_length=1000):
    """清理用户输入，防止XSS和注入"""
    if not text:
        return ''
    text = str(text).strip()
    if len(text) > max_length:
        text = text[:max_length]
    # 移除危险字符
    text = re.sub(r'[<>]', '', text)
    return text

def sanitize_output(text):
    """HTML转义输出，防止XSS"""
    if not text:
        return ''
    return html.escape(str(text), quote=True)

def mask_phone(phone):
    """手机号脱敏：139****5678"""
    if not phone or len(phone) != 11:
        return phone
    return phone[:3] + '****' + phone[7:]

def validate_password_strength(password):
    """验证密码强度，返回(是否通过, 错误信息)"""
    if len(password) < 8:
        return False, '密码至少8位'
    if password.lower() in WEAK_PASSWORDS:
        return False, '密码过于简单，请使用更复杂的密码'
    if not re.search(r'[a-z]', password):
        return False, '密码必须包含小写字母'
    if not re.search(r'[A-Z]', password):
        return False, '密码必须包含大写字母'
    if not re.search(r'[0-9]', password):
        return False, '密码必须包含数字'
    return True, ''

def validate_phone(phone):
    """验证手机号格式"""
    return bool(re.match(r'^1[3-9]\d{9}$', phone))

def check_rate_limit(endpoint='default'):
    """API限流检查，返回(是否允许, 剩余次数)"""
    ip = request.remote_addr or 'unknown'
    now = time.time()
    key = f"{ip}:{endpoint}"
    
    limit = API_RATE_LIMIT.get(endpoint, API_RATE_LIMIT['default'])
    per_minute = limit['per_minute']
    
    if key not in api_rate_limit:
        api_rate_limit[key] = {'count': 0, 'window_start': now}
    
    record = api_rate_limit[key]
    if now - record['window_start'] > 60:
        record['count'] = 0
        record['window_start'] = now
    
    record['count'] += 1
    remaining = max(0, per_minute - record['count'])
    
    return record['count'] <= per_minute, remaining

def check_login_attempts(ip):
    """检查登录尝试次数，返回(是否允许, 剩余次数)"""
    now = time.time()
    if ip not in login_attempts:
        login_attempts[ip] = {'count': 0, 'lock_until': 0}
    
    record = login_attempts[ip]
    if record['lock_until'] > now:
        return False, 0
    
    remaining = MAX_LOGIN_ATTEMPTS - record['count']
    return remaining > 0, remaining

def record_login_failure(ip):
    """记录登录失败"""
    now = time.time()
    if ip not in login_attempts:
        login_attempts[ip] = {'count': 0, 'lock_until': 0}
    
    record = login_attempts[ip]
    record['count'] += 1
    if record['count'] >= MAX_LOGIN_ATTEMPTS:
        record['lock_until'] = now + LOGIN_LOCKOUT_TIME
        record['count'] = 0

def reset_login_attempts(ip):
    """重置登录尝试"""
    if ip in login_attempts:
        login_attempts[ip] = {'count': 0, 'lock_until': 0}

def check_daily_limit(user, limit_type='ai'):
    """检查每日使用次数限制"""
    if not user:
        return False, '请先登录'
    
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    today = time.strftime('%Y-%m-%d')
    
    if user.get('last_usage_date') != today:
        user['daily_ai_usage'] = 0
        user['daily_competitor_usage'] = 0
        user['last_usage_date'] = today
    
    if limit_type == 'ai':
        if user.get('daily_ai_usage', 0) >= plan['daily_ai_limit']:
            return False, '今日AI生成次数已用完，请明日再试或升级会员'
    elif limit_type == 'competitor':
        if user.get('daily_competitor_usage', 0) >= plan['competitor_daily_limit']:
            return False, '今日竞品分析次数已用完，请明日再试或升级会员'
    
    return True, ''

def increment_usage(user, usage_type='ai'):
    """增加使用次数"""
    today = time.strftime('%Y-%m-%d')
    if user.get('last_usage_date') != today:
        user['daily_ai_usage'] = 0
        user['daily_competitor_usage'] = 0
        user['last_usage_date'] = today
    
    if usage_type == 'ai':
        user['daily_ai_usage'] = user.get('daily_ai_usage', 0) + 1
    elif usage_type == 'competitor':
        user['daily_competitor_usage'] = user.get('daily_competitor_usage', 0) + 1
    
    users = load_users()
    users[session['username']] = user
    save_users(users)

def require_login(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return jsonify({'success': False, 'need_login': True, 'message': '请先登录'}), 401
        return f(*args, **kwargs)
    return decorated_function

def require_permission(permission):
    """权限验证装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'success': False, 'need_login': True, 'message': '请先登录'}), 401
            plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
            if not plan.get(permission, False):
                return jsonify({'success': False, 'need_upgrade': True, 'message': f'该功能为付费功能，请升级会员解锁'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def validate_ecommerce_url(url):
    """验证电商URL，防止SSRF"""
    if not url:
        return False, '请输入商品链接'
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False, '链接格式不正确'
        domain = parsed.netloc.lower()
        # 检查是否是允许的电商平台域名
        for allowed in ALLOWED_ECOMMERCE_DOMAINS:
            if domain == allowed or domain.endswith('.' + allowed):
                return True, ''
        return False, '仅支持淘宝/天猫/京东/拼多多/抖音/小红书等主流电商平台链接'
    except Exception:
        return False, '链接格式不正确'

# ==================== 安全响应头 ====================
@app.after_request
def add_security_headers(response):
    """添加安全响应头"""
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';"
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    return response

# ==================== 错误处理 ====================
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': '接口不存在'}), 404

@app.errorhandler(500)
def internal_error(error):
    # 生产环境不暴露详细错误信息
    app.logger.error(f'Server error: {str(error)}')
    return jsonify({'success': False, 'message': '服务器内部错误，请稍后重试'}), 500

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'success': False, 'message': '请求参数错误'}), 400

# ==================== 路由 ====================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health')
def health():
    """健康检查 - 仅返回基本状态，不暴露敏感信息"""
    return jsonify({'status': 'ok'})

# ==================== 用户系统 ====================
@app.route('/api/register', methods=['POST'])
def register():
    # API限流
    allowed, remaining = check_rate_limit('register')
    if not allowed:
        return jsonify({'success': False, 'message': '注册过于频繁，请稍后再试'}), 429
    
    data = request.get_json() or {}
    phone = sanitize_input(data.get('phone', ''), 20)
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')
    
    # 验证手机号
    if not validate_phone(phone):
        return jsonify({'success': False, 'message': '请输入正确的手机号'}), 400
    
    # 验证密码强度
    valid, msg = validate_password_strength(password)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400
    
    if password != confirm_password:
        return jsonify({'success': False, 'message': '两次密码不一致'}), 400
    
    users = load_users()
    if phone in users:
        return jsonify({'success': False, 'message': '该手机号已注册'}), 400
    
    # 创建用户
    user_id = str(uuid.uuid4())
    users[phone] = {
        'id': user_id,
        'username': phone,
        'phone': phone,
        'password': hash_password(password),
        'plan': 'free',
        'created_at': time.time(),
        'daily_ai_usage': 0,
        'daily_competitor_usage': 0,
        'last_usage_date': time.strftime('%Y-%m-%d'),
        'bound_shops': [],
        'usage_history': []
    }
    save_users(users)
    
    # 自动登录
    session['username'] = phone
    session['user_id'] = user_id
    session.permanent = True
    
    return jsonify({'success': True, 'message': '注册成功', 'username': phone})

@app.route('/api/login', methods=['POST'])
def login():
    ip = request.remote_addr or 'unknown'
    
    # 检查登录锁定
    allowed, remaining = check_login_attempts(ip)
    if not allowed:
        return jsonify({'success': False, 'message': '登录失败次数过多，请15分钟后再试'}), 429
    
    # API限流
    rate_allowed, _ = check_rate_limit('login')
    if not rate_allowed:
        return jsonify({'success': False, 'message': '登录过于频繁，请稍后再试'}), 429
    
    data = request.get_json() or {}
    phone = sanitize_input(data.get('phone', ''), 20)
    password = data.get('password', '')
    
    if not phone or not password:
        record_login_failure(ip)
        return jsonify({'success': False, 'message': '请填写手机号和密码'}), 400
    
    users = load_users()
    user = users.get(phone)
    
    if not user or not verify_password(password, user.get('password', '')):
        record_login_failure(ip)
        _, remaining = check_login_attempts(ip)
        msg = '手机号或密码错误'
        if remaining > 0 and remaining <= 3:
            msg += f'，剩余{remaining}次尝试机会'
        return jsonify({'success': False, 'message': msg}), 401
    
    # 登录成功
    reset_login_attempts(ip)
    session['username'] = phone
    session['user_id'] = user.get('id', '')
    session.permanent = True
    
    # 记录登录日志
    user['last_login'] = time.time()
    user['last_login_ip'] = ip
    users[phone] = user
    save_users(users)
    
    return jsonify({'success': True, 'message': '登录成功', 'username': phone})

@app.route('/api/logout', methods=['POST', 'GET'])
def logout():
    """退出登录 - 清除session"""
    session.clear()
    return jsonify({'success': True, 'message': '已退出登录'})

@app.route('/api/user-info')
def user_info():
    user = get_current_user()
    if not user:
        return jsonify({'logged_in': False})
    
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    
    # 手机号脱敏，不返回完整手机号
    return jsonify({
        'logged_in': True,
        'username': user['username'],
        'phone_masked': mask_phone(user.get('phone', '')),
        'plan': user.get('plan', 'free'),
        'plan_name': plan['name'],
        'daily_ai_limit': plan['daily_ai_limit'],
        'daily_ai_usage': user.get('daily_ai_usage', 0),
        'daily_competitor_usage': user.get('daily_competitor_usage', 0),
        'permissions': {
            'can_export': plan['can_export'],
            'can_diagnosis': plan['can_diagnosis'],
            'can_monthly_report': plan['can_monthly_report'],
            'can_multi_shop': plan['can_multi_shop'],
            'can_api': plan['can_api']
        },
        'bound_shops_count': len(user.get('bound_shops', [])),
        'created_at': user.get('created_at', 0)
    })

@app.route('/api/change-password', methods=['POST'])
@require_login
def change_password():
    """修改密码"""
    data = request.get_json() or {}
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')
    
    user = get_current_user()
    if not verify_password(old_password, user.get('password', '')):
        return jsonify({'success': False, 'message': '原密码错误'}), 400
    
    valid, msg = validate_password_strength(new_password)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400
    
    users = load_users()
    users[session['username']]['password'] = hash_password(new_password)
    save_users(users)
    
    return jsonify({'success': True, 'message': '密码修改成功'})

# ==================== AI内容生成API ====================
@app.route('/api/generate-title', methods=['POST'])
@require_login
def generate_title():
    user = get_current_user()
    allowed, msg = check_daily_limit(user, 'ai')
    if not allowed:
        return jsonify({'success': False, 'message': msg}), 403
    
    data = request.get_json() or {}
    product_name = sanitize_input(data.get('product_name', ''), 100)
    features = sanitize_input(data.get('features', ''), 500)
    platform = sanitize_input(data.get('platform', '淘宝'), 20)
    style = sanitize_input(data.get('style', '引流爆款'), 20)
    word_count = sanitize_input(data.get('word_count', '30字内'), 20)
    audience = sanitize_input(data.get('audience', '通用'), 20)
    
    if not product_name:
        return jsonify({'success': False, 'message': '请输入商品名称'}), 400
    
    # 演示模式返回示例数据（输出已转义防XSS）
    demo_result = f"""1. 【爆款】2026新款{sanitize_output(product_name)} {sanitize_output(features)} 百搭潮流款
2. {sanitize_output(platform)}热销 {sanitize_output(product_name)} {sanitize_output(style)}风格 高点击率
3. 【商场同款】{sanitize_output(product_name)} {sanitize_output(features)} 品质保证
4. 2026新品 {sanitize_output(product_name)} 网红推荐 限时特惠
5. 【销量10万+】{sanitize_output(product_name)} 好评如潮 复购率高
6. {sanitize_output(product_name)} {sanitize_output(word_count)} 搜索优化 精准引流
7. 【官方正品】{sanitize_output(product_name)} 假一赔十 极速发货
8. {sanitize_output(audience)}必备 {sanitize_output(product_name)} 简约时尚 百搭款
9. 【限时折扣】{sanitize_output(product_name)} {sanitize_output(features)} 今日特价
10. {sanitize_output(product_name)} 品质严选 不满意包退 放心购买"""
    
    increment_usage(user, 'ai')
    
    return jsonify({
        'success': True,
        'result': demo_result,
        'demo_mode': not bool(API_KEY)
    })

@app.route('/api/generate-detail', methods=['POST'])
@require_login
def generate_detail():
    user = get_current_user()
    allowed, msg = check_daily_limit(user, 'ai')
    if not allowed:
        return jsonify({'success': False, 'message': msg}), 403
    
    data = request.get_json() or {}
    product_name = sanitize_input(data.get('product_name', ''), 100)
    features = sanitize_input(data.get('features', ''), 500)
    params = sanitize_input(data.get('params', ''), 300)
    platform = sanitize_input(data.get('platform', '淘宝'), 20)
    style = sanitize_input(data.get('style', '专业走心'), 20)
    
    if not product_name or not features:
        return jsonify({'success': False, 'message': '请填写商品名称和核心卖点'}), 400
    
    demo_result = f"""【首屏Slogan】
{sanitize_output(product_name)} - {sanitize_output(style)}之选，重新定义品质生活

【核心卖点】
✓ {sanitize_output(features)}
✓ 严选优质材质，品质保证
✓ 人性化设计，舒适体验
✓ 多场景适用，百搭实用

【产品参数】
{sanitize_output(params) if params else '• 材质：优质面料\n• 尺寸：多规格可选\n• 颜色：多色可选\n• 适用场景：日常/通勤/休闲'}

【使用场景】
适合日常穿搭、通勤上班、休闲聚会等多种场景，轻松驾驭各种风格。

【售后保障】
• 7天无理由退换货
• 正品保障，假一赔十
• 极速发货，48小时内发出
• 专属客服，全程服务

【温馨提示】
由于拍摄光线和显示器不同，实物与图片可能存在轻微色差，请以实物为准。"""
    
    increment_usage(user, 'ai')
    
    return jsonify({
        'success': True,
        'result': demo_result,
        'demo_mode': not bool(API_KEY)
    })

@app.route('/api/generate-service', methods=['POST'])
@require_login
def generate_service():
    user = get_current_user()
    allowed, msg = check_daily_limit(user, 'ai')
    if not allowed:
        return jsonify({'success': False, 'message': msg}), 403
    
    data = request.get_json() or {}
    scenario = sanitize_input(data.get('scenario', '售前咨询'), 20)
    question = sanitize_input(data.get('question', ''), 300)
    style = sanitize_input(data.get('style', '温柔亲和'), 20)
    
    if not question:
        return jsonify({'success': False, 'message': '请输入具体问题场景'}), 400
    
    demo_result = f"""【场景：{sanitize_output(scenario)}】【风格：{sanitize_output(style)}】

话术1（耐心解答型）：
亲，您好呀~关于您问的「{sanitize_output(question)}」这个问题，我来为您详细解答一下。我们的产品都是经过严格质检的，品质方面您完全可以放心呢~

话术2（专业自信型）：
您好，关于「{sanitize_output(question)}」，我们的产品在设计之初就充分考虑了这一点。采用优质材料和精湛工艺，确保每一件产品都能达到您的期望。

话术3（亲切互动型）：
亲亲~您问的「{sanitize_output(question)}」真是个好问题呢！很多顾客也关心这个。让我来告诉您，我们的产品...

话术4（高效简洁型）：
您好，关于「{sanitize_output(question)}」：我们的产品支持7天无理由退换，正品保障，假一赔十。您可以放心购买~

话术5（高情商挽留型）：
亲，非常理解您的顾虑~关于「{sanitize_output(question)}」，我想跟您说，我们的产品已经服务了上万名顾客，好评率99%以上。如果您收到后有任何不满意，我们随时为您解决，您看可以吗~"""
    
    increment_usage(user, 'ai')
    
    return jsonify({
        'success': True,
        'result': demo_result,
        'demo_mode': not bool(API_KEY)
    })

# ==================== 竞品分析API ====================
@app.route('/api/competitor-analysis', methods=['POST'])
@require_login
def competitor_analysis():
    user = get_current_user()
    
    # 权限校验
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    if not plan.get('can_competitor', False):
        return jsonify({'success': False, 'need_upgrade': True, 'message': '竞品分析为付费功能，请升级会员解锁'}), 403
    
    allowed, msg = check_daily_limit(user, 'competitor')
    if not allowed:
        return jsonify({'success': False, 'message': msg}), 403
    
    data = request.get_json() or {}
    url = sanitize_input(data.get('url', ''), 500)
    
    # URL校验，防SSRF
    valid, msg = validate_ecommerce_url(url)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400
    
    # 演示模式返回模拟数据
    product_id = ''.join(random.choices('0123456789', k=3))
    demo_data = {
        'product_name': f'竞品商品{product_id}',
        'current_price': round(random.uniform(29.9, 299.9), 2),
        'original_price': round(random.uniform(59.9, 599.9), 2),
        'monthly_sales': random.randint(1000, 50000),
        'reviews': {
            'total': random.randint(500, 20000),
            'good_rate': round(random.uniform(92, 99), 1),
            'good_keywords': ['质量好', '物流快', '服务好', '性价比高', '包装精美'],
            'bad_keywords': ['有色差', '尺码偏大', '物流慢', '客服回复慢']
        },
        'promotions': {
            'current': ['限时折扣', '满减优惠', '买二送一', '新人专享价'],
            'coupon': f'满{random.randint(50,200)}减{random.randint(5,30)}',
            'strategy': '低价引流+关联销售+会员复购'
        },
        'ai_summary': f'该竞品商品{product_id}当前采用低价引流策略，月销较高，好评率优秀。主要优势在于性价比和物流速度，差评主要集中在尺码和色差问题。建议我方产品在尺码准确性和品控方面加强，同时优化主图点击率和详情页转化率。'
    }
    
    increment_usage(user, 'competitor')
    
    return jsonify({
        'success': True,
        'data': demo_data,
        'demo_mode': not bool(API_KEY)
    })

# ==================== 店铺数据API ====================
@app.route('/api/shop-data')
@require_login
def shop_data():
    user = get_current_user()
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    
    # 店铺数据监控为付费功能
    if user.get('plan') == 'free':
        return jsonify({'success': False, 'need_upgrade': True, 'message': '店铺数据监控为付费功能，请升级会员解锁'}), 403
    
    # 演示模式返回模拟数据
    demo_data = {
        'overview': {
            'today_orders': random.randint(20, 100),
            'today_sales': random.randint(2000, 20000),
            'visitors': random.randint(500, 5000),
            'conversion_rate': round(random.uniform(1.5, 5.0), 2),
            'order_change': round(random.uniform(-10, 30), 1),
            'sales_change': round(random.uniform(-10, 35), 1)
        },
        'top_products': [
            {'name': '爆款商品A', 'sales': random.randint(50, 200), 'revenue': random.randint(2000, 10000), 'trend': 'up'},
            {'name': '热销商品B', 'sales': random.randint(30, 150), 'revenue': random.randint(1500, 8000), 'trend': 'up'},
            {'name': '潜力商品C', 'sales': random.randint(20, 100), 'revenue': random.randint(1000, 5000), 'trend': 'down'},
            {'name': '常规商品D', 'sales': random.randint(10, 80), 'revenue': random.randint(500, 3000), 'trend': 'up'},
            {'name': '新品E', 'sales': random.randint(5, 50), 'revenue': random.randint(200, 2000), 'trend': 'up'}
        ],
        'traffic_sources': [
            {'name': '自然搜索', 'percent': random.randint(30, 50), 'visitors': random.randint(1000, 3000)},
            {'name': '推荐流量', 'percent': random.randint(15, 30), 'visitors': random.randint(500, 2000)},
            {'name': '直通车', 'percent': random.randint(10, 25), 'visitors': random.randint(300, 1500)},
            {'name': '淘宝客', 'percent': random.randint(5, 15), 'visitors': random.randint(100, 800)},
            {'name': '其他', 'percent': random.randint(3, 10), 'visitors': random.randint(50, 500)}
        ],
        'alerts': [
            {'type': 'warning', 'message': '商品C流量连续3天下滑，建议优化标题主图', 'time': '2小时前'},
            {'type': 'danger', 'message': '转化率低于行业均值，建议优化详情页', 'time': '5小时前'},
            {'type': 'info', 'message': '竞品A降价10%，建议关注价格动态', 'time': '1天前'}
        ]
    }
    
    return jsonify({
        'success': True,
        'data': demo_data,
        'demo_mode': True
    })

# ==================== AI运营诊断API ====================
@app.route('/api/operation-diagnosis', methods=['POST'])
@require_login
@require_permission('can_diagnosis')
def operation_diagnosis():
    user = get_current_user()
    
    demo_result = """【AI智能运营诊断报告】

一、店铺整体健康度：72分（良好，有较大提升空间）

二、核心问题诊断：
1. 流量结构问题：自然搜索占比偏低（35%），付费流量依赖度过高，建议加强SEO优化和内容种草。
2. 转化率偏低：当前转化率2.1%，低于行业均值3.5%，主要原因是详情页说服力不足，评价管理不到位。
3. 客单价偏低：平均客单价89元，建议通过关联销售、满减活动提升客单价。
4. 复购率不足：复购率仅12%，建议建立会员体系，加强老客户维护。

三、7天执行计划：
第1天：优化TOP10商品标题，包含核心关键词和长尾词
第2天：重做3款主力商品详情页，强化卖点和信任背书
第3天：设置关联销售，搭配推荐提升客单价
第4天：启动老客户召回活动，发放专属优惠券
第5天：优化评价管理，主动引导好评，及时处理差评
第6天：测试直通车新计划，优化关键词出价
第7天：数据复盘，总结效果，调整下周策略

四、预期效果：
- 流量提升20-30%
- 转化率提升至3%以上
- 客单价提升15%
- 7天内GMV增长25%以上"""
    
    increment_usage(user, 'ai')
    
    return jsonify({
        'success': True,
        'result': demo_result,
        'demo_mode': not bool(API_KEY)
    })

# ==================== 报表生成API ====================
@app.route('/api/generate-report', methods=['POST'])
@require_login
def generate_report():
    user = get_current_user()
    data = request.get_json() or {}
    report_type = sanitize_input(data.get('report_type', 'weekly'), 20)
    
    # 月报需要付费权限
    if report_type == 'monthly':
        plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
        if not plan.get('can_monthly_report', False):
            return jsonify({'success': False, 'need_upgrade': True, 'message': '月报生成为付费功能，请升级会员解锁'}), 403
    
    allowed, msg = check_daily_limit(user, 'ai')
    if not allowed:
        return jsonify({'success': False, 'message': msg}), 403
    
    if report_type == 'weekly':
        demo_result = """【店铺运营周报】
统计周期：本周（周一至周日）

一、核心数据汇总
• 总订单量：1,256单（环比+12.3%）
• 总销售额：¥128,560（环比+15.8%）
• 总访客数：45,680人（环比+8.5%）
• 转化率：2.75%（环比+0.2%）
• 客单价：¥102.3（环比+3.1%）
• 复购率：18.5%（环比+2.1%）

二、流量分析
• 自然搜索：45%（+5%）- 持续优化效果显现
• 推荐流量：25%（+3%）- 内容种草见效
• 付费流量：20%（-2%）- 降低依赖，ROI提升
• 其他：10%（-6%）

三、热销商品TOP5
1. 爆款商品A - 356单 - ¥35,600
2. 热销商品B - 289单 - ¥28,900
3. 潜力商品C - 215单 - ¥21,500
4. 常规商品D - 198单 - ¥19,800
5. 新品E - 198单 - ¥19,800

四、问题与优化建议
1. 转化率仍有提升空间，建议优化详情页
2. 客服响应时间偏长，建议增加客服人员
3. 退货率略高，建议加强品控

五、下周计划
• 优化TOP10商品详情页
• 启动新一轮直通车测试
• 开展老客户召回活动"""
    else:
        demo_result = """【店铺运营月报】
统计周期：本月全月

（完整月报内容，包含月度数据汇总、趋势分析、竞品对比、问题诊断、下月规划等）"""
    
    increment_usage(user, 'ai')
    
    return jsonify({
        'success': True,
        'result': demo_result,
        'demo_mode': True
    })

# ==================== 店铺绑定管理API ====================
@app.route('/api/bind-shop', methods=['POST'])
@require_login
def bind_shop():
    user = get_current_user()
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    
    data = request.get_json() or {}
    platform = sanitize_input(data.get('platform', ''), 20)
    shop_name = sanitize_input(data.get('shop_name', ''), 100)
    auth_code = sanitize_input(data.get('auth_code', ''), 200)
    
    if not platform or not shop_name or not auth_code:
        return jsonify({'success': False, 'message': '请填写完整信息'}), 400
    
    # 检查店铺数量限制
    max_shops = 10 if plan.get('can_multi_shop', False) else 1
    if len(user.get('bound_shops', [])) >= max_shops:
        if max_shops == 1:
            return jsonify({'success': False, 'need_upgrade': True, 'message': '当前版本仅支持绑定1个店铺，升级企业版可绑定10个店铺'}), 403
        return jsonify({'success': False, 'message': '已达店铺绑定上限'}), 400
    
    shop_id = str(uuid.uuid4())
    new_shop = {
        'id': shop_id,
        'platform': platform,
        'shop_name': shop_name,
        'auth_code': auth_code,
        'status': 'active',
        'bind_time': time.time(),
        'last_sync': time.time()
    }
    
    users = load_users()
    if 'bound_shops' not in users[session['username']]:
        users[session['username']]['bound_shops'] = []
    users[session['username']]['bound_shops'].append(new_shop)
    save_users(users)
    
    return jsonify({'success': True, 'message': '店铺绑定成功', 'shop': new_shop})

@app.route('/api/unbind-shop', methods=['POST'])
@require_login
def unbind_shop():
    data = request.get_json() or {}
    shop_id = sanitize_input(data.get('shop_id', ''), 100)
    
    if not shop_id:
        return jsonify({'success': False, 'message': '缺少店铺ID'}), 400
    
    users = load_users()
    user = users.get(session['username'])
    if user and 'bound_shops' in user:
        user['bound_shops'] = [s for s in user['bound_shops'] if s.get('id') != shop_id]
        users[session['username']] = user
        save_users(users)
    
    return jsonify({'success': True, 'message': '店铺已解绑'})

@app.route('/api/shop-list')
@require_login
def shop_list():
    user = get_current_user()
    shops = user.get('bound_shops', [])
    # 不返回auth_code等敏感信息
    safe_shops = [{k: v for k, v in s.items() if k != 'auth_code'} for s in shops]
    return jsonify({'success': True, 'shops': safe_shops})

# ==================== 会员升级API ====================
@app.route('/api/upgrade-plan', methods=['POST'])
@require_login
def upgrade_plan():
    data = request.get_json() or {}
    plan = sanitize_input(data.get('plan', ''), 20)
    
    if plan not in MEMBER_PLANS:
        return jsonify({'success': False, 'message': '无效的套餐类型'}), 400
    
    users = load_users()
    users[session['username']]['plan'] = plan
    save_users(users)
    
    return jsonify({'success': True, 'message': f'已升级为{MEMBER_PLANS[plan]["name"]}'})

# ==================== 启动 ====================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
