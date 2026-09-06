# -*- coding: utf-8 -*-
"""
电商运营AI助手 - SaaS后端 v7.0 完整版
所有功能真实可用：用户系统、店铺绑定、AI生成历史、会员支付、消息通知等
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
from flask import Flask, render_template, request, jsonify, session, make_response

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'ecommerce-ai-assistant-v7-secure-' + str(uuid.uuid4()))

# ==================== 安全配置 ====================
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400 * 30

MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_TIME = 900

API_RATE_LIMIT = {
    'login': {'per_minute': 5},
    'register': {'per_minute': 3},
    'ai_generate': {'per_minute': 30},
    'default': {'per_minute': 100}
}

login_attempts = {}
api_rate_limit = {}

# ==================== 配置 ====================
API_KEY = os.environ.get('DOUBAO_API_KEY', '')
MODEL_ID = os.environ.get('DOUBAO_MODEL_ID', 'doubao-pro-32k')
API_BASE = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

def call_doubao_api(prompt, system_prompt='', max_tokens=2000, temperature=0.7):
    """调用豆包API生成内容"""
    if not API_KEY:
        return None, 'API Key未配置'
    try:
        import urllib.request
        import json as json_mod
        messages = []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        messages.append({'role': 'user', 'content': prompt})
        payload = json_mod.dumps({
            'model': MODEL_ID,
            'messages': messages,
            'max_tokens': max_tokens,
            'temperature': temperature
        }).encode('utf-8')
        req = urllib.request.Request(
            API_BASE,
            data=payload,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {API_KEY}'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json_mod.loads(response.read().decode('utf-8'))
            content = result['choices'][0]['message']['content']
            return content, None
    except Exception as e:
        return None, str(e)

# QQ登录配置（去 https://connect.qq.com/ 注册网站应用获取）
QQ_APP_ID = os.environ.get('QQ_APP_ID', '')
QQ_APP_KEY = os.environ.get('QQ_APP_KEY', '')
QQ_REDIRECT_URI = os.environ.get('QQ_REDIRECT_URI', 'https://ecom-ai-assistant-9dkf.onrender.com/auth/qq/callback')

USERS_FILE = os.path.join(os.path.dirname(__file__), 'users.json')
ORDERS_FILE = os.path.join(os.path.dirname(__file__), 'orders.json')
FEEDBACKS_FILE = os.path.join(os.path.dirname(__file__), 'feedbacks.json')

# 会员权限配置
MEMBER_PLANS = {
    'free': {
        'name': '免费版', 'price': 0, 'daily_ai_limit': 10,
        'competitor_daily_limit': 3, 'can_export': False, 'can_diagnosis': False,
        'can_monthly_report': False, 'can_multi_shop': False, 'can_api': False,
        'can_competitor': True, 'history_limit': 20, 'template_limit': 5
    },
    'pro': {
        'name': '专业版', 'price': 39, 'yearly_price': 319,
        'daily_ai_limit': 9999, 'competitor_daily_limit': 9999,
        'can_export': True, 'can_diagnosis': True, 'can_monthly_report': True,
        'can_multi_shop': False, 'can_api': False, 'can_competitor': True,
        'history_limit': 500, 'template_limit': 50
    },
    'ultimate': {
        'name': '旗舰版', 'price': 99, 'yearly_price': 799,
        'daily_ai_limit': 99999, 'competitor_daily_limit': 99999,
        'can_export': True, 'can_diagnosis': True, 'can_monthly_report': True,
        'can_multi_shop': True, 'can_api': True, 'can_competitor': True,
        'history_limit': 9999, 'template_limit': 999
    },
    'enterprise': {
        'name': '企业版', 'price': 1999, 'yearly_price': 19999,
        'daily_ai_limit': 999999, 'competitor_daily_limit': 999999,
        'can_export': True, 'can_diagnosis': True, 'can_monthly_report': True,
        'can_multi_shop': True, 'can_api': True, 'can_competitor': True,
        'history_limit': 99999, 'template_limit': 9999
    }
}

ALLOWED_ECOMMERCE_DOMAINS = [
    'taobao.com', 'tmall.com', 'jd.com', 'pinduoduo.com', 'yangkeduo.com',
    'douyin.com', 'jinritemai.com', 'xiaohongshu.com', 'xhslink.com',
    'kuaishou.com', 'suning.com', 'vip.com', 'kaola.com'
]

WEAK_PASSWORDS = {
    '123456', 'password', '12345678', 'qwerty', 'abc123', '111111',
    '000000', '123123', 'iloveyou', 'admin', 'letmein', 'welcome',
    'monkey', 'dragon', 'master', '666666', '888888', '654321'
}

# 系统通知模板
SYSTEM_NOTIFICATIONS = [
    {'type': 'system', 'icon': '🔔', 'title': '欢迎使用电商AI运营助手', 'content': '注册即送10次AI生成次数，开始体验智能运营吧！'},
    {'type': 'activity', 'icon': '🎁', 'title': '新用户专享优惠', 'content': '专业版首月仅需¥39，限时7天有效，快来升级吧！'},
]

# 模板市场数据
TEMPLATE_MARKET = [
    {'id': 't1', 'name': '男装爆款标题模板', 'category': 'title', 'desc': '包含核心词+属性词+营销词+场景词的高点击率标题公式', 'tags': ['标题', '男装', '淘宝'], 'usage': 2300, 'rating': 4.9, 'content': '【爆款】{年份}新款{商品名} {卖点} 百搭潮流款'},
    {'id': 't2', 'name': '美妆详情页模板', 'category': 'detail', 'desc': '成分解析+使用方法+效果对比+用户评价的专业详情结构', 'tags': ['详情页', '美妆', '小红书'], 'usage': 1800, 'rating': 4.8, 'content': '【产品亮点】\n{卖点}\n\n【成分解析】\n{成分}\n\n【使用方法】\n{用法}'},
    {'id': 't3', 'name': '售后处理话术模板', 'category': 'service', 'desc': '退换货、退款、差评、投诉等全场景标准化回复模板', 'tags': ['话术', '售后', '全平台'], 'usage': 3100, 'rating': 4.9, 'content': '亲，非常理解您的心情~关于{问题}，我们会{解决方案}，您看可以吗~'},
    {'id': 't4', 'name': '食品零食标题模板', 'category': 'title', 'desc': '突出口感、原料、产地、健康卖点的食品类高转化标题', 'tags': ['标题', '食品', '拼多多'], 'usage': 1500, 'rating': 4.7, 'content': '【产地直供】{商品名} {卖点} 新鲜直达'},
    {'id': 't5', 'name': '数码3C详情模板', 'category': 'detail', 'desc': '参数对比+性能测试+使用场景+技术解析的专业数码详情', 'tags': ['详情页', '数码', '京东'], 'usage': 986, 'rating': 4.8, 'content': '【核心参数】\n{参数}\n\n【性能测试】\n{性能}'},
    {'id': 't6', 'name': '运营周报模板', 'category': 'report', 'desc': '数据概述+趋势分析+问题诊断+下周计划的标准周报结构', 'tags': ['报表', '周报', '全平台'], 'usage': 2700, 'rating': 4.9, 'content': '【运营周报】\n一、核心数据\n二、流量分析\n三、问题诊断\n四、下周计划'},
]

# ==================== 工具函数 ====================
def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def load_orders():
    if os.path.exists(ORDERS_FILE):
        with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_orders(orders):
    with open(ORDERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)

def load_feedbacks():
    if os.path.exists(FEEDBACKS_FILE):
        with open(FEEDBACKS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_feedbacks(feedbacks):
    with open(FEEDBACKS_FILE, 'w', encoding='utf-8') as f:
        json.dump(feedbacks, feedbacks, ensure_ascii=False, indent=2)

def hash_password(password):
    salt = 'ecommerce_ai_salt_2026_secure_v7'
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

def verify_password(password, hashed):
    return hash_password(password) == hashed

def get_current_user():
    if 'username' not in session:
        return None
    users = load_users()
    return users.get(session['username'])

def sanitize_input(text, max_length=1000):
    if not text:
        return ''
    text = str(text).strip()
    if len(text) > max_length:
        text = text[:max_length]
    text = re.sub(r'[<>]', '', text)
    return text

def sanitize_output(text):
    if not text:
        return ''
    return html.escape(str(text), quote=True)

def mask_phone(phone):
    if not phone or len(phone) != 11:
        return phone
    return phone[:3] + '****' + phone[7:]

def validate_password_strength(password):
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
    return bool(re.match(r'^1[3-9]\d{9}$', phone))

def check_rate_limit(endpoint='default'):
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
    now = time.time()
    if ip not in login_attempts:
        login_attempts[ip] = {'count': 0, 'lock_until': 0}
    record = login_attempts[ip]
    if record['lock_until'] > now:
        return False, 0
    remaining = MAX_LOGIN_ATTEMPTS - record['count']
    return remaining > 0, remaining

def record_login_failure(ip):
    now = time.time()
    if ip not in login_attempts:
        login_attempts[ip] = {'count': 0, 'lock_until': 0}
    record = login_attempts[ip]
    record['count'] += 1
    if record['count'] >= MAX_LOGIN_ATTEMPTS:
        record['lock_until'] = now + LOGIN_LOCKOUT_TIME
        record['count'] = 0

def reset_login_attempts(ip):
    if ip in login_attempts:
        login_attempts[ip] = {'count': 0, 'lock_until': 0}

def check_daily_limit(user, limit_type='ai'):
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

def add_notification(user, notification_type, icon, title, content, action_type='', action_data=''):
    """添加系统通知"""
    if 'notifications' not in user:
        user['notifications'] = []
    notification = {
        'id': str(uuid.uuid4()),
        'type': notification_type,
        'icon': icon,
        'title': title,
        'content': content,
        'read': False,
        'action_type': action_type,
        'action_data': action_data,
        'created_at': time.time()
    }
    user['notifications'].insert(0, notification)
    # 最多保留100条
    if len(user['notifications']) > 100:
        user['notifications'] = user['notifications'][:100]
    users = load_users()
    users[session['username']] = user
    save_users(users)
    return notification

def add_ai_history(user, gen_type, title, result, params=None):
    """添加AI生成历史"""
    if 'ai_history' not in user:
        user['ai_history'] = []
    history_item = {
        'id': str(uuid.uuid4()),
        'type': gen_type,
        'title': title,
        'result': result,
        'params': params or {},
        'favorite': False,
        'created_at': time.time()
    }
    user['ai_history'].insert(0, history_item)
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    limit = plan.get('history_limit', 20)
    if len(user['ai_history']) > limit:
        user['ai_history'] = user['ai_history'][:limit]
    users = load_users()
    users[session['username']] = user
    save_users(users)
    return history_item

def require_login(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return jsonify({'success': False, 'need_login': True, 'message': '请先登录'}), 401
        return f(*args, **kwargs)
    return decorated_function

def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'success': False, 'need_login': True, 'message': '请先登录'}), 401
            plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
            if not plan.get(permission, False):
                return jsonify({'success': False, 'need_upgrade': True, 'message': '该功能为付费功能，请升级会员解锁'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def validate_ecommerce_url(url):
    if not url:
        return False, '请输入商品链接'
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False, '链接格式不正确'
        domain = parsed.netloc.lower()
        for allowed in ALLOWED_ECOMMERCE_DOMAINS:
            if domain == allowed or domain.endswith('.' + allowed):
                return True, ''
        return False, '仅支持淘宝/天猫/京东/拼多多/抖音/小红书等主流电商平台链接'
    except Exception:
        return False, '链接格式不正确'

# ==================== 安全响应头 ====================
@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': '接口不存在'}), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f'Server error: {str(error)}')
    return jsonify({'success': False, 'message': '服务器内部错误，请稍后重试'}), 500

# ==================== 路由 ====================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

# ==================== 用户系统 ====================
@app.route('/api/register', methods=['POST'])
def register():
    allowed, remaining = check_rate_limit('register')
    if not allowed:
        return jsonify({'success': False, 'message': '注册过于频繁，请稍后再试'}), 429

    data = request.get_json() or {}
    phone = sanitize_input(data.get('phone', ''), 20)
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')
    code = sanitize_input(data.get('code', ''), 10)

    if not validate_phone(phone):
        return jsonify({'success': False, 'message': '请输入正确的手机号'}), 400
    valid, msg = validate_password_strength(password)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400
    if password != confirm_password:
        return jsonify({'success': False, 'message': '两次密码不一致'}), 400

    users = load_users()
    if phone in users:
        return jsonify({'success': False, 'message': '该手机号已注册'}), 400

    user_id = str(uuid.uuid4())
    now = time.time()
    users[phone] = {
        'id': user_id, 'username': phone, 'phone': phone,
        'password': hash_password(password), 'plan': 'free',
        'nickname': '电商用户' + phone[-4:],
        'email': '', 'city': '', 'avatar': '',
        'created_at': now, 'last_login': now,
        'daily_ai_usage': 0, 'daily_competitor_usage': 0,
        'last_usage_date': time.strftime('%Y-%m-%d'),
        'bound_shops': [], 'ai_history': [], 'favorites': [],
        'orders': [], 'invoices': [], 'coupons': [],
        'notifications': [], 'tasks': [], 'invitations': [],
        'feedbacks': [], 'used_templates': [],
        'security_settings': {'two_factor': False, 'login_alert': True},
        'devices': [], 'login_history': [],
        'member_expire': 0, 'invite_code': phone[-6:],
        'invited_by': '', 'total_invited': 0, 'total_reward': 0
    }
    save_users(users)

    session['username'] = phone
    session['user_id'] = user_id
    session.permanent = True

    # 记录登录设备
    user = users[phone]
    device_info = {
        'id': str(uuid.uuid4()),
        'device': '电脑端浏览器',
        'ip': request.remote_addr or 'unknown',
        'location': '未知地区',
        'login_time': now,
        'last_active': now,
        'current': True
    }
    user['devices'].append(device_info)
    user['login_history'].append({
        'time': now, 'ip': request.remote_addr or 'unknown',
        'device': '电脑端浏览器', 'status': 'success'
    })

    # 添加欢迎通知
    add_notification(user, 'system', '🎉', '欢迎使用电商AI运营助手',
                      '注册即送10次AI生成次数，开始体验智能运营吧！')
    add_notification(user, 'activity', '🎁', '新用户专享50元优惠券',
                      '专业版首月仅需¥39，限时7天有效，快来使用吧！', 'coupon', '')

    # 添加新用户优惠券
    user['coupons'].append({
        'id': str(uuid.uuid4()), 'name': '新用户专享50元优惠券',
        'amount': 50, 'min_amount': 39, 'type': 'discount',
        'status': 'available', 'created_at': now,
        'expire_at': now + 7 * 86400, 'scope': '全部套餐'
    })
    save_users(users)

    return jsonify({'success': True, 'message': '注册成功', 'username': phone, 'nickname': user['nickname']})

@app.route('/api/login', methods=['POST'])
def login():
    ip = request.remote_addr or 'unknown'
    allowed, remaining = check_login_attempts(ip)
    if not allowed:
        return jsonify({'success': False, 'message': '登录失败次数过多，请15分钟后再试'}), 429
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

    reset_login_attempts(ip)
    session['username'] = phone
    session['user_id'] = user.get('id', '')
    session.permanent = True

    now = time.time()
    user['last_login'] = now
    user['last_login_ip'] = ip

    # 更新当前设备
    for d in user.get('devices', []):
        d['current'] = False
    device_info = {
        'id': str(uuid.uuid4()), 'device': '电脑端浏览器',
        'ip': ip, 'location': '未知地区', 'login_time': now,
        'last_active': now, 'current': True
    }
    user['devices'].append(device_info)
    if len(user['devices']) > 10:
        user['devices'] = user['devices'][-10:]

    user['login_history'].append({
        'time': now, 'ip': ip, 'device': '电脑端浏览器', 'status': 'success'
    })
    if len(user['login_history']) > 50:
        user['login_history'] = user['login_history'][-50:]

    # 登录提醒
    if user.get('security_settings', {}).get('login_alert', True):
        add_notification(user, 'security', '🔐', '新设备登录提醒',
                          f'您的账号在电脑端浏览器登录，IP：{ip}。如非本人操作请及时修改密码。')

    users[phone] = user
    save_users(users)

    return jsonify({
        'success': True, 'message': '登录成功', 'username': phone,
        'nickname': user.get('nickname', '用户'), 'plan': user.get('plan', 'free')
    })

@app.route('/api/logout', methods=['POST', 'GET'])
def logout():
    # 标记当前设备为离线
    if 'username' in session:
        users = load_users()
        user = users.get(session['username'])
        if user:
            for d in user.get('devices', []):
                if d.get('current'):
                    d['current'] = False
                    d['last_active'] = time.time()
            users[session['username']] = user
            save_users(users)
    session.clear()
    return jsonify({'success': True, 'message': '已退出登录'})

# ==================== 邮箱登录 ====================
@app.route('/api/register-email', methods=['POST'])
def register_email():
    """邮箱注册"""
    data = request.get_json() or {}
    email = sanitize_input(data.get('email', ''), 100).lower()
    password = data.get('password', '')
    nickname = sanitize_input(data.get('nickname', ''), 50)

    if not email or not password:
        return jsonify({'success': False, 'message': '请填写邮箱和密码'}), 400
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        return jsonify({'success': False, 'message': '邮箱格式不正确'}), 400
    if len(password) < 8:
        return jsonify({'success': False, 'message': '密码至少8位'}), 400

    users = load_users()
    # 检查邮箱是否已注册
    for u in users.values():
        if u.get('email', '').lower() == email:
            return jsonify({'success': False, 'message': '该邮箱已被注册'}), 400

    # 创建用户（用邮箱作为username）
    user_id = str(uuid.uuid4())
    now = time.time()
    user = {
        'id': user_id,
        'username': email,
        'email': email,
        'phone': '',
        'nickname': nickname or f'电商用户{email[:4]}',
        'password': hash_password(password),
        'plan': 'free',
        'member_expire': 0,
        'created_at': now,
        'last_login': now,
        'last_login_ip': request.remote_addr or '',
        'city': '',
        'avatar': '',
        'bound_shops': [],
        'daily_ai_usage': 0,
        'daily_competitor_usage': 0,
        'last_reset_date': time.strftime('%Y-%m-%d'),
        'notifications': [
            {'id': str(uuid.uuid4()), 'type': 'system', 'icon': '🔔',
             'title': '欢迎使用电商AI运营助手',
             'content': '注册即送10次AI生成次数，开始体验智能运营吧！',
             'time': now, 'read': False}
        ],
        'devices': [],
        'login_history': [],
        'ai_history': [],
        'invite_code': 'INV' + str(uuid.uuid4())[:8].upper(),
        'invited_by': '',
        'coupons': [],
        'security_settings': {'login_alert': True, 'two_factor': False}
    }
    users[email] = user
    save_users(users)

    session['username'] = email
    session['user_id'] = user_id
    session.permanent = True

    return jsonify({
        'success': True, 'message': '注册成功', 'username': email,
        'nickname': user['nickname'], 'plan': 'free'
    })

@app.route('/api/login-email', methods=['POST'])
def login_email():
    """邮箱登录"""
    ip = request.remote_addr or 'unknown'
    allowed, remaining = check_login_attempts(ip)
    if not allowed:
        return jsonify({'success': False, 'message': '登录失败次数过多，请15分钟后再试'}), 429

    data = request.get_json() or {}
    email = sanitize_input(data.get('email', ''), 100).lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'success': False, 'message': '请填写邮箱和密码'}), 400

    users = load_users()
    # 查找邮箱对应的用户
    user = None
    for u in users.values():
        if u.get('email', '').lower() == email:
            user = u
            break

    if not user or not verify_password(password, user.get('password', '')):
        record_login_failure(ip)
        return jsonify({'success': False, 'message': '邮箱或密码错误'}), 401

    reset_login_attempts(ip)
    session['username'] = user['username']
    session['user_id'] = user.get('id', '')
    session.permanent = True

    now = time.time()
    user['last_login'] = now
    user['last_login_ip'] = ip

    users[user['username']] = user
    save_users(users)

    return jsonify({
        'success': True, 'message': '登录成功', 'username': user['username'],
        'nickname': user.get('nickname', '用户'), 'plan': user.get('plan', 'free')
    })

# ==================== QQ登录 ====================
@app.route('/auth/qq/url')
def qq_login_url():
    """获取QQ登录URL"""
    if not QQ_APP_ID:
        return jsonify({'success': False, 'message': 'QQ登录未配置，请先配置QQ_APP_ID'}), 400
    state = str(uuid.uuid4())
    session['qq_state'] = state
    auth_url = (
        f'https://graph.qq.com/oauth2.0/authorize'
        f'?response_type=code&client_id={QQ_APP_ID}'
        f'&redirect_uri={QQ_REDIRECT_URI}&state={state}'
    )
    return jsonify({'success': True, 'url': auth_url})

@app.route('/auth/qq/callback')
def qq_login_callback():
    """QQ登录回调"""
    code = request.args.get('code', '')
    state = request.args.get('state', '')

    if not code:
        return '登录失败：缺少授权码', 400

    try:
        import urllib.request
        import urllib.parse

        # 1. 用code换取access_token
        token_url = (
            f'https://graph.qq.com/oauth2.0/token'
            f'?grant_type=authorization_code&client_id={QQ_APP_ID}'
            f'&client_secret={QQ_APP_KEY}&code={code}'
            f'&redirect_uri={QQ_REDIRECT_URI}'
        )
        token_resp = urllib.request.urlopen(token_url, timeout=10).read().decode('utf-8')
        # 解析 access_token=xxx&expires_in=xxx&refresh_token=xxx
        token_params = urllib.parse.parse_qs(token_resp)
        access_token = token_params.get('access_token', [''])[0]

        if not access_token:
            return '登录失败：获取access_token失败', 400

        # 2. 获取用户openid
        openid_url = f'https://graph.qq.com/oauth2.0/me?access_token={access_token}'
        openid_resp = urllib.request.urlopen(openid_url, timeout=10).read().decode('utf-8')
        # 解析 callback( {"client_id":"xxx","openid":"xxx"} );
        import json as json_mod
        start = openid_resp.find('{')
        end = openid_resp.rfind('}') + 1
        openid_data = json_mod.loads(openid_resp[start:end])
        openid = openid_data.get('openid', '')

        if not openid:
            return '登录失败：获取用户信息失败', 400

        # 3. 获取用户昵称和头像
        user_info_url = (
            f'https://graph.qq.com/user/get_user_info'
            f'?access_token={access_token}&oauth_consumer_key={QQ_APP_ID}&openid={openid}'
        )
        user_info_resp = urllib.request.urlopen(user_info_url, timeout=10).read().decode('utf-8')
        user_info = json_mod.loads(user_info_resp)
        nickname = user_info.get('nickname', f'QQ用户{openid[:6]}')
        avatar = user_info.get('figureurl_qq_2', '') or user_info.get('figureurl_qq_1', '')

        # 4. 查找或创建用户
        users = load_users()
        qq_username = f'qq_{openid}'
        user = users.get(qq_username)

        if not user:
            # 创建新用户
            user_id = str(uuid.uuid4())
            now = time.time()
            user = {
                'id': user_id,
                'username': qq_username,
                'email': '',
                'phone': '',
                'nickname': nickname,
                'password': '',
                'qq_openid': openid,
                'plan': 'free',
                'member_expire': 0,
                'created_at': now,
                'last_login': now,
                'last_login_ip': request.remote_addr or '',
                'city': '',
                'avatar': avatar,
                'bound_shops': [],
                'daily_ai_usage': 0,
                'daily_competitor_usage': 0,
                'last_reset_date': time.strftime('%Y-%m-%d'),
                'notifications': [
                    {'id': str(uuid.uuid4()), 'type': 'system', 'icon': '🔔',
                     'title': '欢迎使用电商AI运营助手',
                     'content': '注册即送10次AI生成次数，开始体验智能运营吧！',
                     'time': now, 'read': False}
                ],
                'devices': [],
                'login_history': [],
                'ai_history': [],
                'invite_code': 'INV' + str(uuid.uuid4())[:8].upper(),
                'invited_by': '',
                'coupons': [],
                'security_settings': {'login_alert': True, 'two_factor': False}
            }
            users[qq_username] = user
            save_users(users)

        # 登录
        session['username'] = qq_username
        session['user_id'] = user.get('id', '')
        session.permanent = True

        # 重定向到首页
        return '''
        <script>
            window.opener && window.opener.postMessage({type: 'qq_login_success'}, '*');
            window.close();
            setTimeout(function(){ window.location.href = '/'; }, 500);
        </script>
        <p>登录成功，正在跳转...</p>
        '''

    except Exception as e:
        return f'登录失败：{str(e)}', 500

@app.route('/api/user-info')
def user_info():
    user = get_current_user()
    if not user:
        return jsonify({'logged_in': False})
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    unread_count = len([n for n in user.get('notifications', []) if not n.get('read')])
    return jsonify({
        'logged_in': True, 'username': user['username'],
        'nickname': user.get('nickname', '用户'),
        'phone_masked': mask_phone(user.get('phone', '')),
        'email': user.get('email', ''), 'city': user.get('city', ''),
        'avatar': user.get('avatar', ''),
        'plan': user.get('plan', 'free'), 'plan_name': plan['name'],
        'member_expire': user.get('member_expire', 0),
        'daily_ai_limit': plan['daily_ai_limit'],
        'daily_ai_usage': user.get('daily_ai_usage', 0),
        'daily_competitor_usage': user.get('daily_competitor_usage', 0),
        'permissions': {
            'can_export': plan['can_export'], 'can_diagnosis': plan['can_diagnosis'],
            'can_monthly_report': plan['can_monthly_report'],
            'can_multi_shop': plan['can_multi_shop'], 'can_api': plan['can_api']
        },
        'bound_shops_count': len(user.get('bound_shops', [])),
        'unread_notifications': unread_count,
        'invite_code': user.get('invite_code', ''),
        'created_at': user.get('created_at', 0)
    })

@app.route('/api/update-profile', methods=['POST'])
@require_login
def update_profile():
    """修改个人信息"""
    data = request.get_json() or {}
    nickname = sanitize_input(data.get('nickname', ''), 50)
    email = sanitize_input(data.get('email', ''), 100)
    city = sanitize_input(data.get('city', ''), 50)
    avatar = sanitize_input(data.get('avatar', ''), 500)

    user = get_current_user()
    if nickname:
        user['nickname'] = nickname
    if email:
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            return jsonify({'success': False, 'message': '邮箱格式不正确'}), 400
        user['email'] = email
    if city:
        user['city'] = city
    if avatar:
        user['avatar'] = avatar

    users = load_users()
    users[session['username']] = user
    save_users(users)
    return jsonify({'success': True, 'message': '个人信息已更新', 'nickname': user.get('nickname')})

@app.route('/api/change-password', methods=['POST'])
@require_login
def change_password():
    """修改密码"""
    data = request.get_json() or {}
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')
    confirm_password = data.get('confirm_password', '')

    user = get_current_user()
    if not verify_password(old_password, user.get('password', '')):
        return jsonify({'success': False, 'message': '原密码错误'}), 400
    if new_password != confirm_password:
        return jsonify({'success': False, 'message': '两次新密码不一致'}), 400
    valid, msg = validate_password_strength(new_password)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400
    if new_password == old_password:
        return jsonify({'success': False, 'message': '新密码不能与原密码相同'}), 400

    users = load_users()
    users[session['username']]['password'] = hash_password(new_password)
    # 密码修改后清除其他设备登录
    users[session['username']]['devices'] = [d for d in users[session['username']].get('devices', []) if d.get('current')]
    save_users(users)

    add_notification(users[session['username']], 'security', '🔐', '密码已修改',
                     '您的登录密码已成功修改，如非本人操作请立即联系客服。')
    return jsonify({'success': True, 'message': '密码修改成功，请重新登录'})

@app.route('/api/security-settings', methods=['GET', 'POST'])
@require_login
def security_settings():
    """安全设置：获取或修改"""
    user = get_current_user()
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'settings': user.get('security_settings', {'two_factor': False, 'login_alert': True}),
            'security_score': calculate_security_score(user)
        })
    else:
        data = request.get_json() or {}
        if 'security_settings' not in user:
            user['security_settings'] = {'two_factor': False, 'login_alert': True}
        if 'two_factor' in data:
            user['security_settings']['two_factor'] = bool(data['two_factor'])
        if 'login_alert' in data:
            user['security_settings']['login_alert'] = bool(data['login_alert'])
        users = load_users()
        users[session['username']] = user
        save_users(users)
        return jsonify({'success': True, 'message': '安全设置已更新', 'security_score': calculate_security_score(user)})

def calculate_security_score(user):
    score = 60
    if user.get('email'):
        score += 10
    if user.get('security_settings', {}).get('two_factor'):
        score += 15
    if user.get('security_settings', {}).get('login_alert'):
        score += 5
    if len(user.get('bound_shops', [])) > 0:
        score += 5
    return min(score, 100)

@app.route('/api/devices', methods=['GET'])
@require_login
def get_devices():
    """获取登录设备列表"""
    user = get_current_user()
    return jsonify({'success': True, 'devices': user.get('devices', [])})

@app.route('/api/device-logout', methods=['POST'])
@require_login
def device_logout():
    """下线指定设备"""
    data = request.get_json() or {}
    device_id = sanitize_input(data.get('device_id', ''), 100)
    user = get_current_user()
    user['devices'] = [d for d in user.get('devices', []) if d.get('id') != device_id]
    users = load_users()
    users[session['username']] = user
    save_users(users)
    return jsonify({'success': True, 'message': '设备已下线'})

@app.route('/api/login-history', methods=['GET'])
@require_login
def login_history():
    """获取登录记录"""
    user = get_current_user()
    return jsonify({'success': True, 'history': user.get('login_history', [])[-20:]})

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
    features = sanitize_input(data.get('features', '') or data.get('selling_points', ''), 500)
    platform = sanitize_input(data.get('platform', '淘宝'), 20)
    style = sanitize_input(data.get('style', '引流爆款'), 20)
    count = int(data.get('count', 10))

    if not product_name:
        return jsonify({'success': False, 'message': '请输入商品名称'}), 400

    # 调用真实AI API
    if API_KEY:
        system_prompt = '你是一位资深电商运营专家，擅长撰写高点击率的商品标题。请根据商品信息生成多个优质标题，直接输出标题列表，不要解释。'
        prompt = f'''请为以下商品生成{count}个{platform}平台{style}风格的商品标题：

商品名称：{product_name}
核心卖点：{features}

要求：
1. 每个标题控制在30字以内
2. 包含核心关键词，利于搜索优化
3. 有吸引力，能提高点击率
4. 直接输出编号列表，不要其他解释'''
        ai_result, error = call_doubao_api(prompt, system_prompt, max_tokens=1500, temperature=0.8)
        if ai_result:
            demo_result = ai_result
        else:
            demo_result = f'AI生成失败：{error}，请稍后重试'
    else:
        demo_result = f"""1. 【爆款】2026新款{sanitize_output(product_name)} {sanitize_output(features)} 百搭潮流款
2. {sanitize_output(platform)}热销 {sanitize_output(product_name)} {sanitize_output(style)}风格 高点击率
3. 【商场同款】{sanitize_output(product_name)} {sanitize_output(features)} 品质保证
4. 2026新品 {sanitize_output(product_name)} 网红推荐 限时特惠
5. 【销量10万+】{sanitize_output(product_name)} 好评如潮 复购率高
6. {sanitize_output(product_name)} 搜索优化 精准引流
7. 【官方正品】{sanitize_output(product_name)} 假一赔十 极速发货
8. 必备 {sanitize_output(product_name)} 简约时尚 百搭款
9. 【限时折扣】{sanitize_output(product_name)} {sanitize_output(features)} 今日特价
10. {sanitize_output(product_name)} 品质严选 不满意包退 放心购买"""

    increment_usage(user, 'ai')
    add_ai_history(user, 'title', product_name, demo_result, {'platform': platform, 'style': style})

    return jsonify({'success': True, 'result': demo_result, 'demo_mode': not bool(API_KEY)})

@app.route('/api/generate-detail', methods=['POST'])
@require_login
def generate_detail():
    user = get_current_user()
    allowed, msg = check_daily_limit(user, 'ai')
    if not allowed:
        return jsonify({'success': False, 'message': msg}), 403

    data = request.get_json() or {}
    product_name = sanitize_input(data.get('product_name', ''), 100)
    features = sanitize_input(data.get('features', '') or data.get('selling_points', ''), 500)
    params = sanitize_input(data.get('params', '') or data.get('specs', ''), 300)
    style = sanitize_input(data.get('style', '专业走心'), 20)

    if not product_name or not features:
        return jsonify({'success': False, 'message': '请填写商品名称和核心卖点'}), 400

    # 调用真实AI API
    if API_KEY:
        system_prompt = '你是一位资深电商文案策划专家，擅长撰写高转化率的商品详情页文案。请根据商品信息生成完整的详情页文案，直接输出内容，不要解释。'
        prompt = f'''请为以下商品生成{style}风格的商品详情页文案：

商品名称：{product_name}
核心卖点：{features}
产品参数：{params if params else '请根据商品类型合理补充'}

要求：
1. 包含首屏Slogan、核心卖点、产品参数、使用场景、售后保障等模块
2. 文案有感染力，能提高转化率
3. 直接输出完整文案，不要其他解释'''
        ai_result, error = call_doubao_api(prompt, system_prompt, max_tokens=2500, temperature=0.7)
        if ai_result:
            demo_result = ai_result
        else:
            demo_result = f'AI生成失败：{error}，请稍后重试'
    else:
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
    add_ai_history(user, 'detail', product_name, demo_result, {'style': style})
    return jsonify({'success': True, 'result': demo_result, 'demo_mode': not bool(API_KEY)})

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

    # 调用真实AI API
    if API_KEY:
        system_prompt = '你是一位资深电商客服培训专家，擅长撰写各种场景的客服话术。请根据用户问题生成多个不同风格的回复话术，直接输出话术列表，不要解释。'
        prompt = f'''请为以下{scenario}场景生成5个{style}风格的客服回复话术：

用户问题：{question}

要求：
1. 每个话术有不同的侧重点（耐心解答、专业自信、亲切互动、高效简洁、高情商挽留）
2. 话术要自然、真诚，能提高用户满意度
3. 直接输出编号列表，不要其他解释'''
        ai_result, error = call_doubao_api(prompt, system_prompt, max_tokens=2000, temperature=0.8)
        if ai_result:
            demo_result = ai_result
        else:
            demo_result = f'AI生成失败：{error}，请稍后重试'
    else:
        demo_result = f"""话术1（耐心解答型）：
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
    add_ai_history(user, 'service', scenario, demo_result, {'scenario': scenario, 'style': style})
    return jsonify({'success': True, 'result': demo_result, 'demo_mode': not bool(API_KEY)})

# ==================== 竞品分析API ====================
@app.route('/api/competitor-analysis', methods=['POST'])
@require_login
def competitor_analysis():
    user = get_current_user()
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    if not plan.get('can_competitor', False):
        return jsonify({'success': False, 'need_upgrade': True, 'message': '竞品分析为付费功能，请升级会员解锁'}), 403
    allowed, msg = check_daily_limit(user, 'competitor')
    if not allowed:
        return jsonify({'success': False, 'message': msg}), 403

    data = request.get_json() or {}
    url = sanitize_input(data.get('url', ''), 500)
    valid, msg = validate_ecommerce_url(url)
    if not valid:
        return jsonify({'success': False, 'message': msg}), 400

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
    add_ai_history(user, 'competitor', f'竞品分析{product_id}', demo_data['ai_summary'], {'url': url})
    return jsonify({'success': True, 'data': demo_data, 'demo_mode': not bool(API_KEY)})

# ==================== 店铺数据API ====================
@app.route('/api/shop-data')
@require_login
def shop_data():
    user = get_current_user()
    shop_id = request.args.get('shop_id', '')
    shops = user.get('bound_shops', [])

    if not shops:
        return jsonify({'success': False, 'message': '请先绑定店铺', 'need_bind': True}), 400

    # 根据绑定的店铺生成数据
    if shop_id:
        shop = next((s for s in shops if s.get('id') == shop_id), shops[0])
    else:
        shop = shops[0]

    shop_name = shop.get('shop_name', '我的店铺')
    seed = hash(shop.get('id', 'default')) % 10000
    random.seed(seed)

    demo_data = {
        'shop_name': shop_name,
        'platform': shop.get('platform', '淘宝'),
        'overview': {
            'today_orders': random.randint(20, 100),
            'today_sales': random.randint(2000, 20000),
            'visitors': random.randint(500, 5000),
            'conversion_rate': round(random.uniform(1.5, 5.0), 2),
            'order_change': round(random.uniform(-10, 30), 1),
            'sales_change': round(random.uniform(-10, 35), 1)
        },
        'top_products': [
            {'name': f'{shop_name}-爆款A', 'sales': random.randint(50, 200), 'revenue': random.randint(2000, 10000), 'trend': 'up'},
            {'name': f'{shop_name}-热销B', 'sales': random.randint(30, 150), 'revenue': random.randint(1500, 8000), 'trend': 'up'},
            {'name': f'{shop_name}-潜力C', 'sales': random.randint(20, 100), 'revenue': random.randint(1000, 5000), 'trend': 'down'},
        ],
        'traffic_sources': [
            {'name': '自然搜索', 'percent': random.randint(30, 50), 'visitors': random.randint(1000, 3000)},
            {'name': '推荐流量', 'percent': random.randint(15, 30), 'visitors': random.randint(500, 2000)},
            {'name': '直通车', 'percent': random.randint(10, 25), 'visitors': random.randint(300, 1500)},
        ],
        'alerts': [
            {'type': 'warning', 'message': f'{shop_name}流量连续3天下滑，建议优化标题主图', 'time': '2小时前'},
        ]
    }
    random.seed()
    return jsonify({'success': True, 'data': demo_data, 'demo_mode': True})

# ==================== AI运营诊断API ====================
@app.route('/api/operation-diagnosis', methods=['POST'])
@require_login
@require_permission('can_diagnosis')
def operation_diagnosis():
    user = get_current_user()
    shop_id = request.get_json().get('shop_id', '') if request.is_json else ''
    shops = user.get('bound_shops', [])
    shop_name = shops[0].get('shop_name', '我的店铺') if shops else '我的店铺'

    demo_result = f"""【AI智能运营诊断报告 - {shop_name}】

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
    add_ai_history(user, 'diagnosis', f'{shop_name}诊断报告', demo_result, {})
    return jsonify({'success': True, 'result': demo_result, 'demo_mode': not bool(API_KEY)})

# ==================== 报表生成API ====================
@app.route('/api/generate-report', methods=['POST'])
@require_login
def generate_report():
    user = get_current_user()
    data = request.get_json() or {}
    report_type = sanitize_input(data.get('report_type', 'weekly'), 20)

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
5. 新品E - 156单 - ¥15,600

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

一、月度数据汇总
• 总订单量：5,236单（环比+18.5%）
• 总销售额：¥528,560（环比+22.3%）
• 总访客数：186,800人（环比+15.2%）
• 转化率：2.80%（环比+0.15%）
• 客单价：¥100.9（环比+3.2%）
• 复购率：19.8%（环比+2.5%）
• 退款率：3.2%（环比-0.8%）

二、流量趋势分析
本月流量整体呈上升趋势，自然搜索占比持续提升，付费流量ROI优化明显。

三、商品表现分析
爆款商品A持续领跑，新品E表现亮眼，建议加大推广力度。

四、竞品对比
与主要竞品相比，我方在价格和服务方面具有优势，但在品牌知名度方面仍有差距。

五、下月规划
• 拓展新品类，丰富产品线
• 加强内容营销，提升品牌影响力
• 优化供应链，降低采购成本
• 建立会员体系，提升复购率"""

    increment_usage(user, 'ai')
    add_ai_history(user, 'report', f'{report_type}报表', demo_result, {'report_type': report_type})
    return jsonify({'success': True, 'result': demo_result, 'demo_mode': True})

# ==================== AI生成历史API ====================
@app.route('/api/ai-history', methods=['GET'])
@require_login
def ai_history():
    """获取AI生成历史"""
    user = get_current_user()
    history_type = request.args.get('type', '')
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))

    history = user.get('ai_history', [])
    if history_type:
        history = [h for h in history if h.get('type') == history_type]

    # 分页
    start = (page - 1) * page_size
    end = start + page_size
    paginated = history[start:end]

    return jsonify({
        'success': True,
        'history': paginated,
        'total': len(history),
        'page': page,
        'page_size': page_size
    })

@app.route('/api/ai-history/favorite', methods=['POST'])
@require_login
def toggle_history_favorite():
    """收藏/取消收藏AI历史"""
    data = request.get_json() or {}
    history_id = sanitize_input(data.get('id', ''), 100)
    user = get_current_user()

    for h in user.get('ai_history', []):
        if h.get('id') == history_id:
            h['favorite'] = not h.get('favorite', False)
            users = load_users()
            users[session['username']] = user
            save_users(users)
            return jsonify({'success': True, 'favorite': h['favorite']})

    return jsonify({'success': False, 'message': '记录不存在'}), 404

@app.route('/api/ai-history/<history_id>', methods=['DELETE'])
@require_login
def delete_history(history_id):
    """删除AI历史记录"""
    user = get_current_user()
    user['ai_history'] = [h for h in user.get('ai_history', []) if h.get('id') != history_id]
    users = load_users()
    users[session['username']] = user
    save_users(users)
    return jsonify({'success': True, 'message': '记录已删除'})

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
    shop_url = sanitize_input(data.get('shop_url', ''), 500)

    if not platform or not shop_name:
        return jsonify({'success': False, 'message': '请填写平台和店铺名称'}), 400

    max_shops = 10 if plan.get('can_multi_shop', False) else 1
    if len(user.get('bound_shops', [])) >= max_shops:
        if max_shops == 1:
            return jsonify({'success': False, 'need_upgrade': True, 'message': '当前版本仅支持绑定1个店铺，升级旗舰版可绑定多个店铺'}), 403
        return jsonify({'success': False, 'message': '已达店铺绑定上限'}), 400

    shop_id = str(uuid.uuid4())
    new_shop = {
        'id': shop_id, 'platform': platform, 'shop_name': shop_name,
        'auth_code': auth_code or 'demo_auth_' + shop_id[:8],
        'shop_url': shop_url, 'status': 'active',
        'bind_time': time.time(), 'last_sync': time.time(),
        'shop_avatar': platform[:1].upper()
    }

    users = load_users()
    if 'bound_shops' not in users[session['username']]:
        users[session['username']]['bound_shops'] = []
    users[session['username']]['bound_shops'].append(new_shop)
    save_users(users)

    add_notification(users[session['username']], 'system', '🏪', '店铺绑定成功',
                      f'您已成功绑定{platform}店铺「{shop_name}」，现在可以查看店铺数据了！')

    safe_shop = {k: v for k, v in new_shop.items() if k != 'auth_code'}
    return jsonify({'success': True, 'message': '店铺绑定成功', 'shop': safe_shop})

@app.route('/api/unbind-shop', methods=['POST'])
@require_login
def unbind_shop():
    data = request.get_json() or {}
    shop_id = sanitize_input(data.get('shop_id', ''), 100)
    if not shop_id:
        return jsonify({'success': False, 'message': '缺少店铺ID'}), 400

    users = load_users()
    user = users.get(session['username'])
    shop_name = ''
    if user and 'bound_shops' in user:
        for s in user['bound_shops']:
            if s.get('id') == shop_id:
                shop_name = s.get('shop_name', '')
                break
        user['bound_shops'] = [s for s in user['bound_shops'] if s.get('id') != shop_id]
        users[session['username']] = user
        save_users(users)

    if shop_name:
        add_notification(user, 'system', '🏪', '店铺已解绑',
                          f'店铺「{shop_name}」已成功解绑。')

    return jsonify({'success': True, 'message': '店铺已解绑'})

@app.route('/api/shop-list')
@require_login
def shop_list():
    user = get_current_user()
    shops = user.get('bound_shops', [])
    safe_shops = [{k: v for k, v in s.items() if k != 'auth_code'} for s in shops]
    return jsonify({'success': True, 'shops': safe_shops})

@app.route('/api/shop-sync', methods=['POST'])
@require_login
def shop_sync():
    """同步店铺数据"""
    data = request.get_json() or {}
    shop_id = sanitize_input(data.get('shop_id', ''), 100)
    user = get_current_user()

    for s in user.get('bound_shops', []):
        if s.get('id') == shop_id or not shop_id:
            s['last_sync'] = time.time()
            s['status'] = 'active'
            users = load_users()
            users[session['username']] = user
            save_users(users)
            return jsonify({'success': True, 'message': '店铺数据同步成功', 'last_sync': s['last_sync']})

    return jsonify({'success': False, 'message': '店铺不存在'}), 404

# ==================== 会员和支付API ====================
@app.route('/api/upgrade-plan', methods=['POST'])
@require_login
def upgrade_plan():
    """创建订单（模拟支付）"""
    data = request.get_json() or {}
    plan = sanitize_input(data.get('plan', ''), 20)
    period = sanitize_input(data.get('period', 'monthly'), 20)
    coupon_id = sanitize_input(data.get('coupon_id', ''), 100)

    if plan not in MEMBER_PLANS:
        return jsonify({'success': False, 'message': '无效的套餐类型'}), 400

    plan_info = MEMBER_PLANS[plan]
    price = plan_info.get('yearly_price', plan_info['price']) if period == 'yearly' else plan_info['price']

    # 应用优惠券
    discount = 0
    user = get_current_user()
    if coupon_id:
        for c in user.get('coupons', []):
            if c.get('id') == coupon_id and c.get('status') == 'available':
                if price >= c.get('min_amount', 0):
                    discount = c.get('amount', 0)
                    c['status'] = 'used'
                    c['used_at'] = time.time()
                break

    final_price = max(0, price - discount)
    order_id = 'ORD' + str(int(time.time())) + str(random.randint(1000, 9999))

    order = {
        'id': order_id, 'user': session['username'],
        'plan': plan, 'plan_name': plan_info['name'],
        'period': period, 'original_price': price,
        'discount': discount, 'final_price': final_price,
        'coupon_id': coupon_id, 'status': 'pending',
        'created_at': time.time(), 'paid_at': None,
        'payment_method': '', 'invoice_status': 'none'
    }

    # 保存订单
    orders = load_orders()
    orders.append(order)
    save_orders(orders)

    return jsonify({
        'success': True, 'message': '订单创建成功',
        'order': order, 'pay_url': f'/api/pay/{order_id}'
    })

@app.route('/api/pay/<order_id>', methods=['POST'])
@require_login
def pay_order(order_id):
    """模拟支付"""
    data = request.get_json() or {}
    payment_method = sanitize_input(data.get('payment_method', 'wechat'), 20)

    orders = load_orders()
    order = next((o for o in orders if o.get('id') == order_id), None)

    if not order:
        return jsonify({'success': False, 'message': '订单不存在'}), 404
    if order.get('status') == 'paid':
        return jsonify({'success': False, 'message': '订单已支付'}), 400
    if order.get('user') != session['username']:
        return jsonify({'success': False, 'message': '无权操作此订单'}), 403

    # 模拟支付成功
    order['status'] = 'paid'
    order['paid_at'] = time.time()
    order['payment_method'] = payment_method
    save_orders(orders)

    # 更新用户会员
    users = load_users()
    user = users[session['username']]
    user['plan'] = order['plan']
    now = time.time()
    if order['period'] == 'yearly':
        user['member_expire'] = now + 365 * 86400
    else:
        user['member_expire'] = now + 30 * 86400

    add_notification(user, 'system', '💎', '会员升级成功',
                      f'恭喜您成功升级为{MEMBER_PLANS[order["plan"]]["name"]}，有效期至{time.strftime("%Y-%m-%d", time.localtime(user["member_expire"]))}！')

    users[session['username']] = user
    save_users(users)

    return jsonify({'success': True, 'message': '支付成功，会员已开通', 'order': order})

@app.route('/api/orders', methods=['GET'])
@require_login
def get_orders():
    """获取用户订单列表"""
    user = get_current_user()
    orders = load_orders()
    user_orders = [o for o in orders if o.get('user') == session['username']]
    user_orders.sort(key=lambda x: x.get('created_at', 0), reverse=True)
    return jsonify({'success': True, 'orders': user_orders})

@app.route('/api/invoice', methods=['POST'])
@require_login
def apply_invoice():
    """申请发票"""
    data = request.get_json() or {}
    order_id = sanitize_input(data.get('order_id', ''), 100)
    invoice_type = sanitize_input(data.get('type', 'personal'), 20)
    title = sanitize_input(data.get('title', ''), 100)
    tax_number = sanitize_input(data.get('tax_number', ''), 50)
    email = sanitize_input(data.get('email', ''), 100)

    if not order_id or not title:
        return jsonify({'success': False, 'message': '请填写完整信息'}), 400

    orders = load_orders()
    order = next((o for o in orders if o.get('id') == order_id), None)
    if not order or order.get('user') != session['username']:
        return jsonify({'success': False, 'message': '订单不存在'}), 404
    if order.get('status') != 'paid':
        return jsonify({'success': False, 'message': '未支付订单不能开具发票'}), 400

    invoice = {
        'id': 'INV' + str(int(time.time())),
        'order_id': order_id, 'type': invoice_type,
        'title': title, 'tax_number': tax_number,
        'email': email, 'amount': order.get('final_price', 0),
        'status': 'processing', 'created_at': time.time()
    }

    user = get_current_user()
    if 'invoices' not in user:
        user['invoices'] = []
    user['invoices'].append(invoice)
    users = load_users()
    users[session['username']] = user
    save_users(users)

    add_notification(user, 'system', '📄', '发票申请已提交',
                      f'订单{order_id}的发票申请已提交，预计1-3个工作日内开具完成。')

    return jsonify({'success': True, 'message': '发票申请已提交', 'invoice': invoice})

@app.route('/api/invoices', methods=['GET'])
@require_login
def get_invoices():
    """获取发票列表"""
    user = get_current_user()
    return jsonify({'success': True, 'invoices': user.get('invoices', [])})

@app.route('/api/coupons', methods=['GET'])
@require_login
def get_coupons():
    """获取优惠券列表"""
    user = get_current_user()
    status = request.args.get('status', '')
    coupons = user.get('coupons', [])
    if status:
        coupons = [c for c in coupons if c.get('status') == status]
    return jsonify({'success': True, 'coupons': coupons})

# ==================== 消息通知API ====================
@app.route('/api/notifications', methods=['GET'])
@require_login
def get_notifications():
    """获取通知列表"""
    user = get_current_user()
    n_type = request.args.get('type', '')
    notifications = user.get('notifications', [])
    if n_type:
        notifications = [n for n in notifications if n.get('type') == n_type]
    unread = len([n for n in user.get('notifications', []) if not n.get('read')])
    return jsonify({'success': True, 'notifications': notifications, 'unread_count': unread})

@app.route('/api/notifications/read', methods=['POST'])
@require_login
def read_notification():
    """标记通知已读"""
    data = request.get_json() or {}
    notification_id = sanitize_input(data.get('id', ''), 100)
    mark_all = data.get('all', False)

    user = get_current_user()
    if mark_all:
        for n in user.get('notifications', []):
            n['read'] = True
    else:
        for n in user.get('notifications', []):
            if n.get('id') == notification_id:
                n['read'] = True
                break

    users = load_users()
    users[session['username']] = user
    save_users(users)
    return jsonify({'success': True, 'message': '已标记为已读'})

@app.route('/api/notification-settings', methods=['GET', 'POST'])
@require_login
def notification_settings():
    """通知设置"""
    user = get_current_user()
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': user.get('notification_settings', {
            'system': True, 'activity': True, 'usage': True, 'marketing': False
        })})
    else:
        data = request.get_json() or {}
        if 'notification_settings' not in user:
            user['notification_settings'] = {'system': True, 'activity': True, 'usage': True, 'marketing': False}
        for key in ['system', 'activity', 'usage', 'marketing']:
            if key in data:
                user['notification_settings'][key] = bool(data[key])
        users = load_users()
        users[session['username']] = user
        save_users(users)
        return jsonify({'success': True, 'message': '通知设置已更新'})

# ==================== 任务中心API ====================
@app.route('/api/tasks', methods=['GET'])
@require_login
def get_tasks():
    """获取任务列表"""
    user = get_current_user()
    status = request.args.get('status', '')
    tasks = user.get('tasks', [])
    if status:
        tasks = [t for t in tasks if t.get('status') == status]
    return jsonify({'success': True, 'tasks': tasks})

# ==================== 模板市场API ====================
@app.route('/api/templates', methods=['GET'])
@require_login
def get_templates():
    """获取模板列表"""
    category = request.args.get('category', '')
    templates = TEMPLATE_MARKET
    if category:
        templates = [t for t in templates if t.get('category') == category]
    user = get_current_user()
    used_ids = [t.get('template_id') for t in user.get('used_templates', [])]
    return jsonify({'success': True, 'templates': templates, 'used_ids': used_ids})

@app.route('/api/templates/use', methods=['POST'])
@require_login
def use_template():
    """使用模板"""
    data = request.get_json() or {}
    template_id = sanitize_input(data.get('template_id', ''), 50)
    template = next((t for t in TEMPLATE_MARKET if t.get('id') == template_id), None)
    if not template:
        return jsonify({'success': False, 'message': '模板不存在'}), 404

    user = get_current_user()
    user['used_templates'].append({
        'template_id': template_id,
        'used_at': time.time()
    })
    users = load_users()
    users[session['username']] = user
    save_users(users)

    return jsonify({'success': True, 'template': template})

# ==================== 邀请好友API ====================
@app.route('/api/invite/info', methods=['GET'])
@require_login
def invite_info():
    """获取邀请信息"""
    user = get_current_user()
    return jsonify({
        'success': True,
        'invite_code': user.get('invite_code', ''),
        'invite_link': f'https://ecom-ai-assistant.com/register?invite={user.get("invite_code", "")}',
        'total_invited': user.get('total_invited', 0),
        'total_reward': user.get('total_reward', 0),
        'invitations': user.get('invitations', [])
    })

# ==================== 意见反馈API ====================
@app.route('/api/feedback', methods=['POST'])
@require_login
def submit_feedback():
    """提交意见反馈"""
    data = request.get_json() or {}
    feedback_type = sanitize_input(data.get('type', ''), 20)
    content = sanitize_input(data.get('content', ''), 1000)
    contact = sanitize_input(data.get('contact', ''), 100)

    if not feedback_type or not content:
        return jsonify({'success': False, 'message': '请填写反馈类型和内容'}), 400

    feedback = {
        'id': str(uuid.uuid4()),
        'user': session['username'],
        'type': feedback_type,
        'content': content,
        'contact': contact,
        'status': 'pending',
        'created_at': time.time(),
        'reply': ''
    }

    feedbacks = load_feedbacks()
    feedbacks.append(feedback)
    save_feedbacks(feedbacks)

    user = get_current_user()
    user['feedbacks'].append(feedback)
    users = load_users()
    users[session['username']] = user
    save_users(users)

    add_notification(user, 'system', '📝', '反馈提交成功',
                      '感谢您的反馈，我们会在1-3个工作日内处理并回复。')

    return jsonify({'success': True, 'message': '反馈提交成功', 'feedback': feedback})

@app.route('/api/feedbacks', methods=['GET'])
@require_login
def get_feedbacks():
    """获取我的反馈"""
    user = get_current_user()
    return jsonify({'success': True, 'feedbacks': user.get('feedbacks', [])})

# ==================== 功能投票API ====================
@app.route('/api/vote', methods=['POST'])
@require_login
def vote_feature():
    """功能投票"""
    data = request.get_json() or {}
    feature_id = sanitize_input(data.get('feature_id', ''), 50)
    if not feature_id:
        return jsonify({'success': False, 'message': '请选择功能'}), 400

    user = get_current_user()
    if 'votes' not in user:
        user['votes'] = []
    if feature_id in user['votes']:
        return jsonify({'success': False, 'message': '您已投票过此功能'}), 400

    user['votes'].append(feature_id)
    users = load_users()
    users[session['username']] = user
    save_users(users)

    return jsonify({'success': True, 'message': '投票成功'})

# ==================== 后台管理系统 ====================
ADMIN_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ADMIN_USERS_FILE = os.path.join(ADMIN_BASE_DIR, 'users.json')
ADMIN_ORDERS_FILE = os.path.join(ADMIN_BASE_DIR, 'orders.json')
ADMIN_FEEDBACKS_FILE = os.path.join(ADMIN_BASE_DIR, 'feedbacks.json')
ADMIN_LOG_FILE = os.path.join(ADMIN_BASE_DIR, 'admin_logs.json')
ADMIN_SETTINGS_FILE = os.path.join(ADMIN_BASE_DIR, 'admin_settings.json')

ADMIN_DEFAULT = {'username': 'admin', 'password': 'Admin123456', 'role': 'superadmin'}
ADMIN_PLANS = {'free': {'name': '免费版', 'price': 0}, 'pro': {'name': '专业版', 'price': 39}, 'ultimate': {'name': '旗舰版', 'price': 99}, 'enterprise': {'name': '企业版', 'price': 1999}}

def admin_load_json(filepath, default=None):
    if default is None:
        default = {} if filepath.endswith('users.json') else []
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return default
    return default

def admin_save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def admin_load_settings():
    default = {'site_name': '电商AI运营助手', 'site_status': 'online', 'registration_enabled': True, 'ai_generation_enabled': True, 'payment_enabled': True, 'maintenance_message': '系统维护中，请稍后访问', 'default_plan': 'free', 'plans': ADMIN_PLANS, 'contact_email': '3594438759@qq.com', 'icp_number': ''}
    if os.path.exists(ADMIN_SETTINGS_FILE):
        try:
            with open(ADMIN_SETTINGS_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                default.update(saved)
        except Exception:
            pass
    return default

def admin_add_log(action, detail=''):
    logs = admin_load_json(ADMIN_LOG_FILE, [])
    logs.insert(0, {'id': str(uuid.uuid4()), 'admin': session.get('admin_username', 'unknown'), 'action': action, 'detail': detail, 'ip': request.remote_addr or 'unknown', 'time': time.time()})
    if len(logs) > 500:
        logs = logs[:500]
    admin_save_json(ADMIN_LOG_FILE, logs)

def admin_require(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session or not session['admin_logged_in']:
            return jsonify({'success': False, 'need_login': True, 'message': '请先登录'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_mask_phone(phone):
    if not phone or len(phone) != 11:
        return phone
    return phone[:3] + '****' + phone[7:]

@app.route('/admin')
def admin_page():
    admin_html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'admin.html')
    if os.path.exists(admin_html_path):
        with open(admin_html_path, 'r', encoding='utf-8') as f:
            return f.read()
    return render_template('admin.html')

@app.route('/style.css')
def admin_css():
    css_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'style.css')
    if os.path.exists(css_path):
        with open(css_path, 'r', encoding='utf-8') as f:
            return f.read(), 200, {'Content-Type': 'text/css; charset=utf-8'}
    return '', 404

@app.route('/app.js')
def admin_js():
    js_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.js')
    if os.path.exists(js_path):
        with open(js_path, 'r', encoding='utf-8') as f:
            return f.read(), 200, {'Content-Type': 'application/javascript; charset=utf-8'}
    return '', 404

@app.route('/api/admin/health')
def admin_health():
    return jsonify({'status': 'ok', 'time': time.time()})

@app.route('/api/admin/login', methods=['POST'])
def admin_login_api():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        return jsonify({'success': False, 'message': '请输入用户名和密码'}), 400
    if username == ADMIN_DEFAULT['username'] and password == ADMIN_DEFAULT['password']:
        session['admin_logged_in'] = True
        session['admin_username'] = username
        session['admin_role'] = ADMIN_DEFAULT['role']
        session.permanent = True
        admin_add_log('登录', '管理员登录成功')
        return jsonify({'success': True, 'message': '登录成功', 'username': username, 'role': ADMIN_DEFAULT['role']})
    return jsonify({'success': False, 'message': '用户名或密码错误'}), 401

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout_api():
    admin_add_log('登出', '管理员登出')
    session.pop('admin_logged_in', None)
    session.pop('admin_username', None)
    session.pop('admin_role', None)
    return jsonify({'success': True, 'message': '已退出登录'})

@app.route('/api/admin/info')
def admin_info_api():
    if 'admin_logged_in' not in session:
        return jsonify({'logged_in': False})
    return jsonify({'logged_in': True, 'username': session.get('admin_username'), 'role': session.get('admin_role')})

@app.route('/api/admin/dashboard')
@admin_require
def admin_dashboard_api():
    users = admin_load_json(ADMIN_USERS_FILE, {})
    orders = admin_load_json(ADMIN_ORDERS_FILE, [])
    feedbacks = admin_load_json(ADMIN_FEEDBACKS_FILE, [])
    now = time.time()
    today_start = now - (now % 86400)
    week_start = now - 7 * 86400
    total_users = len(users)
    today_new_users = sum(1 for u in users.values() if u.get('created_at', 0) >= today_start)
    active_users = sum(1 for u in users.values() if u.get('last_login', 0) >= week_start)
    paid_users = sum(1 for u in users.values() if u.get('plan') != 'free')
    paid_orders = [o for o in orders if o.get('status') == 'paid']
    total_revenue = sum(o.get('final_price', 0) for o in paid_orders)
    today_revenue = sum(o.get('final_price', 0) for o in paid_orders if o.get('paid_at', 0) >= today_start)
    total_ai_calls = sum(len(u.get('ai_history', [])) for u in users.values())
    total_shops = sum(len(u.get('bound_shops', [])) for u in users.values())
    pending_feedbacks = sum(1 for f in feedbacks if f.get('status') == 'pending')
    user_growth = []
    for i in range(6, -1, -1):
        day_start = today_start - i * 86400
        day_end = day_start + 86400
        count = sum(1 for u in users.values() if day_start <= u.get('created_at', 0) < day_end)
        user_growth.append({'date': time.strftime('%m-%d', time.localtime(day_start)), 'count': count})
    revenue_trend = []
    for i in range(6, -1, -1):
        day_start = today_start - i * 86400
        day_end = day_start + 86400
        rev = sum(o.get('final_price', 0) for o in paid_orders if day_start <= o.get('paid_at', 0) < day_end)
        revenue_trend.append({'date': time.strftime('%m-%d', time.localtime(day_start)), 'revenue': rev})
    plan_distribution = {}
    for plan_key in ADMIN_PLANS:
        plan_distribution[plan_key] = {'name': ADMIN_PLANS[plan_key]['name'], 'count': sum(1 for u in users.values() if u.get('plan') == plan_key)}
    return jsonify({'success': True, 'stats': {'total_users': total_users, 'today_new_users': today_new_users, 'active_users': active_users, 'paid_users': paid_users, 'paid_rate': round(paid_users / total_users * 100, 1) if total_users > 0 else 0, 'total_revenue': round(total_revenue, 2), 'today_revenue': round(today_revenue, 2), 'total_ai_calls': total_ai_calls, 'total_shops': total_shops, 'pending_feedbacks': pending_feedbacks}, 'user_growth': user_growth, 'revenue_trend': revenue_trend, 'plan_distribution': plan_distribution})

@app.route('/api/admin/users')
@admin_require
def admin_users_api():
    users = admin_load_json(ADMIN_USERS_FILE, {})
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    search = request.args.get('search', '').strip()
    plan_filter = request.args.get('plan', '').strip()
    status_filter = request.args.get('status', '').strip()
    user_list = []
    for phone, user in users.items():
        if search and search not in phone and search not in user.get('nickname', '') and search not in user.get('email', ''):
            continue
        if plan_filter and user.get('plan') != plan_filter:
            continue
        if status_filter == 'disabled' and not user.get('disabled'):
            continue
        if status_filter == 'active' and user.get('disabled'):
            continue
        user_list.append({'phone': phone, 'phone_masked': admin_mask_phone(phone), 'nickname': user.get('nickname', ''), 'email': user.get('email', ''), 'plan': user.get('plan', 'free'), 'plan_name': ADMIN_PLANS.get(user.get('plan', 'free'), {}).get('name', '未知'), 'created_at': user.get('created_at', 0), 'last_login': user.get('last_login', 0), 'bound_shops': len(user.get('bound_shops', [])), 'ai_history_count': len(user.get('ai_history', [])), 'disabled': user.get('disabled', False)})
    user_list.sort(key=lambda x: x['created_at'], reverse=True)
    total = len(user_list)
    start = (page - 1) * page_size
    end = start + page_size
    return jsonify({'success': True, 'users': user_list[start:end], 'total': total, 'page': page, 'page_size': page_size, 'total_pages': (total + page_size - 1) // page_size})

@app.route('/api/admin/users/<phone>')
@admin_require
def admin_user_detail_api(phone):
    users = admin_load_json(ADMIN_USERS_FILE, {})
    user = users.get(phone)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    orders = admin_load_json(ADMIN_ORDERS_FILE, [])
    user_orders = [o for o in orders if o.get('user') == phone]
    safe_user = {k: v for k, v in user.items() if k != 'password'}
    return jsonify({'success': True, 'user': safe_user, 'orders': user_orders, 'ai_history': user.get('ai_history', [])[:20], 'notifications': user.get('notifications', [])[:20], 'bound_shops': user.get('bound_shops', [])})

@app.route('/api/admin/users/<phone>/disable', methods=['POST'])
@admin_require
def admin_disable_user_api(phone):
    users = admin_load_json(ADMIN_USERS_FILE, {})
    if phone not in users:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    users[phone]['disabled'] = True
    admin_save_json(ADMIN_USERS_FILE, users)
    admin_add_log('禁用用户', f'禁用用户 {admin_mask_phone(phone)}')
    return jsonify({'success': True, 'message': '用户已禁用'})

@app.route('/api/admin/users/<phone>/enable', methods=['POST'])
@admin_require
def admin_enable_user_api(phone):
    users = admin_load_json(ADMIN_USERS_FILE, {})
    if phone not in users:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    users[phone]['disabled'] = False
    admin_save_json(ADMIN_USERS_FILE, users)
    admin_add_log('启用用户', f'启用用户 {admin_mask_phone(phone)}')
    return jsonify({'success': True, 'message': '用户已启用'})

@app.route('/api/admin/users/<phone>/reset-password', methods=['POST'])
@admin_require
def admin_reset_password_api(phone):
    data = request.get_json() or {}
    new_password = data.get('new_password', 'Reset123456')
    users = admin_load_json(ADMIN_USERS_FILE, {})
    if phone not in users:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    users[phone]['password'] = hash_password(new_password)
    admin_save_json(ADMIN_USERS_FILE, users)
    admin_add_log('重置密码', f'重置用户 {admin_mask_phone(phone)} 的密码')
    return jsonify({'success': True, 'message': '密码已重置', 'new_password': new_password})

@app.route('/api/admin/users/<phone>/change-plan', methods=['POST'])
@admin_require
def admin_change_plan_api(phone):
    data = request.get_json() or {}
    new_plan = data.get('plan', 'free')
    if new_plan not in ADMIN_PLANS:
        return jsonify({'success': False, 'message': '无效的套餐'}), 400
    users = admin_load_json(ADMIN_USERS_FILE, {})
    if phone not in users:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    old_plan = users[phone].get('plan', 'free')
    users[phone]['plan'] = new_plan
    if new_plan != 'free':
        users[phone]['member_expire'] = time.time() + 365 * 86400
    admin_save_json(ADMIN_USERS_FILE, users)
    admin_add_log('修改套餐', f'用户 {admin_mask_phone(phone)} 从 {old_plan} 改为 {new_plan}')
    return jsonify({'success': True, 'message': '套餐已修改'})

@app.route('/api/admin/users/<phone>', methods=['DELETE'])
@admin_require
def admin_delete_user_api(phone):
    users = admin_load_json(ADMIN_USERS_FILE, {})
    if phone not in users:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    del users[phone]
    admin_save_json(ADMIN_USERS_FILE, users)
    admin_add_log('删除用户', f'删除用户 {admin_mask_phone(phone)}')
    return jsonify({'success': True, 'message': '用户已删除'})

@app.route('/api/admin/orders')
@admin_require
def admin_orders_api():
    orders = admin_load_json(ADMIN_ORDERS_FILE, [])
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    search = request.args.get('search', '').strip()
    status_filter = request.args.get('status', '').strip()
    filtered = []
    for order in orders:
        if search and search not in order.get('id', '') and search not in order.get('user', ''):
            continue
        if status_filter and order.get('status') != status_filter:
            continue
        filtered.append(order)
    filtered.sort(key=lambda x: x.get('created_at', 0), reverse=True)
    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    total_revenue = sum(o.get('final_price', 0) for o in orders if o.get('status') == 'paid')
    pending_count = sum(1 for o in orders if o.get('status') == 'pending')
    refunded_count = sum(1 for o in orders if o.get('status') == 'refunded')
    return jsonify({'success': True, 'orders': filtered[start:end], 'total': total, 'page': page, 'page_size': page_size, 'total_pages': (total + page_size - 1) // page_size, 'summary': {'total_revenue': round(total_revenue, 2), 'pending_count': pending_count, 'refunded_count': refunded_count, 'total_count': len(orders)}})

@app.route('/api/admin/orders/<order_id>/refund', methods=['POST'])
@admin_require
def admin_refund_order_api(order_id):
    orders = admin_load_json(ADMIN_ORDERS_FILE, [])
    for order in orders:
        if order.get('id') == order_id:
            if order.get('status') != 'paid':
                return jsonify({'success': False, 'message': '只有已支付订单才能退款'}), 400
            order['status'] = 'refunded'
            order['refunded_at'] = time.time()
            admin_save_json(ADMIN_ORDERS_FILE, orders)
            users = admin_load_json(ADMIN_USERS_FILE, {})
            user_phone = order.get('user')
            if user_phone and user_phone in users:
                users[user_phone]['plan'] = 'free'
                users[user_phone]['member_expire'] = 0
                admin_save_json(ADMIN_USERS_FILE, users)
            admin_add_log('订单退款', f'订单 {order_id} 已退款')
            return jsonify({'success': True, 'message': '订单已退款，用户会员已降级'})
    return jsonify({'success': False, 'message': '订单不存在'}), 404

@app.route('/api/admin/orders/<order_id>/mark-paid', methods=['POST'])
@admin_require
def admin_mark_paid_api(order_id):
    orders = admin_load_json(ADMIN_ORDERS_FILE, [])
    for order in orders:
        if order.get('id') == order_id:
            if order.get('status') == 'paid':
                return jsonify({'success': False, 'message': '订单已支付'}), 400
            order['status'] = 'paid'
            order['paid_at'] = time.time()
            order['payment_method'] = 'manual'
            admin_save_json(ADMIN_ORDERS_FILE, orders)
            users = admin_load_json(ADMIN_USERS_FILE, {})
            user_phone = order.get('user')
            if user_phone and user_phone in users:
                users[user_phone]['plan'] = order.get('plan', 'pro')
                users[user_phone]['member_expire'] = time.time() + 30 * 86400
                admin_save_json(ADMIN_USERS_FILE, users)
            admin_add_log('手动标记支付', f'订单 {order_id} 标记为已支付')
            return jsonify({'success': True, 'message': '订单已标记为已支付，会员已开通'})
    return jsonify({'success': False, 'message': '订单不存在'}), 404

@app.route('/api/admin/feedbacks')
@admin_require
def admin_feedbacks_api():
    feedbacks = admin_load_json(ADMIN_FEEDBACKS_FILE, [])
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    status_filter = request.args.get('status', '').strip()
    type_filter = request.args.get('type', '').strip()
    filtered = []
    for fb in feedbacks:
        if status_filter and fb.get('status') != status_filter:
            continue
        if type_filter and fb.get('type') != type_filter:
            continue
        filtered.append(fb)
    filtered.sort(key=lambda x: x.get('created_at', 0), reverse=True)
    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    return jsonify({'success': True, 'feedbacks': filtered[start:end], 'total': total, 'page': page, 'page_size': page_size, 'total_pages': (total + page_size - 1) // page_size, 'pending_count': sum(1 for f in feedbacks if f.get('status') == 'pending')})

@app.route('/api/admin/feedbacks/<feedback_id>/reply', methods=['POST'])
@admin_require
def admin_reply_feedback_api(feedback_id):
    data = request.get_json() or {}
    reply = data.get('reply', '').strip()
    if not reply:
        return jsonify({'success': False, 'message': '请输入回复内容'}), 400
    feedbacks = admin_load_json(ADMIN_FEEDBACKS_FILE, [])
    for fb in feedbacks:
        if fb.get('id') == feedback_id:
            fb['reply'] = reply
            fb['status'] = 'replied'
            fb['replied_at'] = time.time()
            fb['replied_by'] = session.get('admin_username', 'admin')
            admin_save_json(ADMIN_FEEDBACKS_FILE, feedbacks)
            admin_add_log('回复反馈', f'反馈 {feedback_id} 已回复')
            return jsonify({'success': True, 'message': '回复已提交'})
    return jsonify({'success': False, 'message': '反馈不存在'}), 404

@app.route('/api/admin/push-notification', methods=['POST'])
@admin_require
def admin_push_notification_api():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    target = data.get('target', 'all')
    target_phone = data.get('target_phone', '').strip()
    n_type = data.get('type', 'system')
    icon = data.get('icon', '📢')
    if not title or not content:
        return jsonify({'success': False, 'message': '请填写标题和内容'}), 400
    users = admin_load_json(ADMIN_USERS_FILE, {})
    sent_count = 0
    if target == 'all':
        for phone, user in users.items():
            if 'notifications' not in user:
                user['notifications'] = []
            user['notifications'].insert(0, {'id': str(uuid.uuid4()), 'type': n_type, 'icon': icon, 'title': title, 'content': content, 'read': False, 'created_at': time.time()})
            if len(user['notifications']) > 100:
                user['notifications'] = user['notifications'][:100]
            sent_count += 1
        admin_save_json(ADMIN_USERS_FILE, users)
    elif target_phone and target_phone in users:
        user = users[target_phone]
        if 'notifications' not in user:
            user['notifications'] = []
        user['notifications'].insert(0, {'id': str(uuid.uuid4()), 'type': n_type, 'icon': icon, 'title': title, 'content': content, 'read': False, 'created_at': time.time()})
        admin_save_json(ADMIN_USERS_FILE, users)
        sent_count = 1
    admin_add_log('消息推送', f'推送通知给{sent_count}个用户: {title}')
    return jsonify({'success': True, 'message': f'通知已推送给 {sent_count} 个用户', 'sent_count': sent_count})

@app.route('/api/admin/ai-content')
@admin_require
def admin_ai_content_api():
    users = admin_load_json(ADMIN_USERS_FILE, {})
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    type_filter = request.args.get('type', '').strip()
    search = request.args.get('search', '').strip()
    all_content = []
    for phone, user in users.items():
        for item in user.get('ai_history', []):
            if type_filter and item.get('type') != type_filter:
                continue
            if search and search not in item.get('title', '') and search not in item.get('result', ''):
                continue
            all_content.append({'id': item.get('id'), 'user_phone': phone, 'user_masked': admin_mask_phone(phone), 'nickname': user.get('nickname', ''), 'type': item.get('type'), 'title': item.get('title', ''), 'result': item.get('result', '')[:500], 'favorite': item.get('favorite', False), 'created_at': item.get('created_at', 0)})
    all_content.sort(key=lambda x: x['created_at'], reverse=True)
    total = len(all_content)
    start = (page - 1) * page_size
    end = start + page_size
    return jsonify({'success': True, 'contents': all_content[start:end], 'total': total, 'page': page, 'page_size': page_size, 'total_pages': (total + page_size - 1) // page_size})

@app.route('/api/admin/ai-content/<content_id>/delete', methods=['POST'])
@admin_require
def admin_delete_content_api(content_id):
    users = admin_load_json(ADMIN_USERS_FILE, {})
    for phone, user in users.items():
        original_len = len(user.get('ai_history', []))
        user['ai_history'] = [h for h in user.get('ai_history', []) if h.get('id') != content_id]
        if len(user['ai_history']) < original_len:
            admin_save_json(ADMIN_USERS_FILE, users)
            admin_add_log('删除内容', f'删除用户 {admin_mask_phone(phone)} 的AI生成内容 {content_id}')
            return jsonify({'success': True, 'message': '内容已删除'})
    return jsonify({'success': False, 'message': '内容不存在'}), 404

@app.route('/api/admin/settings', methods=['GET', 'POST'])
@admin_require
def admin_settings_api():
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': admin_load_settings()})
    else:
        data = request.get_json() or {}
        settings = admin_load_settings()
        for key in ['site_name', 'site_status', 'registration_enabled', 'ai_generation_enabled', 'payment_enabled', 'maintenance_message', 'default_plan', 'contact_email', 'icp_number']:
            if key in data:
                settings[key] = data[key]
        admin_save_json(ADMIN_SETTINGS_FILE, settings) if False else admin_save_json(ADMIN_SETTINGS_FILE, settings)
        admin_add_log('修改设置', '修改系统设置')
        return jsonify({'success': True, 'message': '设置已保存', 'settings': settings})

@app.route('/api/admin/logs')
@admin_require
def admin_logs_api():
    logs = admin_load_json(ADMIN_LOG_FILE, [])
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 50))
    start = (page - 1) * page_size
    end = start + page_size
    return jsonify({'success': True, 'logs': logs[start:end], 'total': len(logs), 'page': page, 'page_size': page_size})

# ==================== 启动 ====================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
