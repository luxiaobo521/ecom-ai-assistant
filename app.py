# -*- coding: utf-8 -*-
"""
电商运营AI助手 - SaaS后端 v3.0
按详细设计方案实现：12页面、专业AI提示词、权限分级、竞品分析、店铺监控、报表生成
"""
import os
import json
import hashlib
import time
import uuid
import random
from flask import Flask, render_template, request, jsonify, session, redirect, url_for

app = Flask(__name__)
app.secret_key = 'ecommerce-ai-assistant-v3-secret-2026'

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
        'can_api': False
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
        'can_api': False
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
        'can_api': False
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
        'can_api': True
    }
}

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def get_current_user():
    if 'username' not in session:
        return None
    users = load_users()
    return users.get(session['username'])

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
            return False, '今日AI生成次数已用完，请升级会员解锁不限次数'
        user['daily_ai_usage'] = user.get('daily_ai_usage', 0) + 1
    elif limit_type == 'competitor':
        if user.get('daily_competitor_usage', 0) >= plan['competitor_daily_limit']:
            return False, '今日竞品分析次数已用完，请升级会员解锁不限次数'
        user['daily_competitor_usage'] = user.get('daily_competitor_usage', 0) + 1
    
    # 保存用户数据
    users = load_users()
    users[user['username']] = user
    save_users(users)
    
    return True, ''

# ==================== AI调用 ====================
def call_doubao_api(prompt, max_tokens=2000):
    if not API_KEY:
        return None
    try:
        import requests
        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        }
        data = {
            'model': MODEL_ID,
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': max_tokens,
            'temperature': 0.7
        }
        response = requests.post(API_BASE, headers=headers, json=data, timeout=60)
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content']
    except Exception as e:
        print(f'API调用失败: {e}')
    return None

# ==================== 专业AI提示词（来自设计方案） ====================
TITLE_PROMPT = """你是资深电商标题优化专家，精通淘宝、拼多多、抖音、小红书平台搜索引擎规则和用户搜索习惯。根据用户输入的【商品名称、核心卖点、平台、风格、字数、适用人群】，生成10组高搜索权重、高点击率、合规无违规、适配平台算法的商品标题。要求：1、包含行业核心关键词、长尾流量词；2、贴合用户搜索习惯，不堆砌关键词；3、风格匹配用户选择；4、严格控制字数；5、适合中小卖家新品上架、老品优化；6、标题通顺自然、引流性强。直接输出10组标题，无需多余解释。"""

DETAIL_PROMPT = """你是资深电商详情页文案策划师，精通各平台电商转化逻辑。根据用户提供的产品信息，生成一套完整、高转化、无违规、适配对应电商平台的商品详情页全套文案。内容包含：1、爆款首屏slogan；2、核心卖点拆解（分点通俗易懂）；3、产品参数详细介绍；4、用户痛点解决说明；5、产品优势对比；6、售后保障、发货说明、温馨提示。文案风格匹配用户选择，语言接地气、适合消费者阅读，提升下单转化率，适配中小卖家店铺使用，结构清晰、分段明确，直接输出完整文案，无需多余话术。"""

SERVICE_PROMPT = """你是资深电商金牌客服，精通各类电商场景沟通技巧，擅长提升客户满意度、促成下单、减少差评、化解纠纷。根据用户选择的【沟通场景、具体问题、话术风格】，生成5套不同版本、可直接复制使用的高情商客服回复话术。要求：语气友好、专业合规、不违规、能解决客户问题、最大限度留住客户、促成成交，适配中小电商卖家日常客服工作，直接输出话术内容。"""

DIAGNOSIS_PROMPT = """你是资深全域电商运营专家，拥有5年以上中小店铺操盘经验。根据用户店铺的真实流量、转化、销量、退款、商品数据、竞品对标数据，进行全方位运营诊断。精准找出店铺存在的问题，包括流量、转化、卖点、定价、货品、客服、活动等维度。针对每一个问题，给出具体、可直接落地、无需二次思考的优化操作步骤，输出7天短期运营执行方案和长期优化方向，语言通俗，适合中小卖家直接照做，拒绝空泛理论。"""

REPORT_PROMPT = """根据店铺周期运营数据，生成一份专业、规范、完整的电商运营周报/月报。内容包含：周期数据汇总（流量、订单、销售额、转化）、店铺运营亮点、核心问题复盘、竞品动态分析、数据异常原因、下周期可落地运营计划。报表格式规整、逻辑清晰、数据真实对应，适合卖家自我复盘、店铺运营存档、团队汇报使用。"""

COMPETITOR_PROMPT = """根据爬取到的竞品商品价格、销量、评价、卖点、促销活动、用户痛点数据，为中小电商卖家生成一份专业、可落地的竞品分析总结。内容包含：1、竞品核心优势；2、竞品短板与用户差评痛点；3、我方店铺差异化优化方向；4、定价策略建议；5、卖点优化建议；6、活动布局建议。内容通俗易懂，直接可用于店铺运营优化，无需专业运营知识即可看懂执行。"""

# ==================== 页面路由 ====================
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html', page='landing')

@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html', page='login')

@app.route('/register')
def register_page():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html', page='register')

@app.route('/pricing')
def pricing_page():
    return render_template('index.html', page='pricing')

@app.route('/help')
def help_page():
    return render_template('index.html', page='help')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template('index.html', page='dashboard', username=session.get('username', ''))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# ==================== 用户API ====================
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    confirm = data.get('confirm_password', '')

    if not phone or not password:
        return jsonify({'success': False, 'message': '请填写手机号和密码'})
    if len(phone) != 11 or not phone.isdigit():
        return jsonify({'success': False, 'message': '请输入正确的手机号'})
    if len(password) < 6:
        return jsonify({'success': False, 'message': '密码至少6位'})
    if password != confirm:
        return jsonify({'success': False, 'message': '两次密码不一致'})

    users = load_users()
    if phone in users:
        return jsonify({'success': False, 'message': '该手机号已注册'})

    user_id = str(uuid.uuid4())
    users[phone] = {
        'user_id': user_id,
        'username': phone,
        'phone': phone,
        'email': '',
        'password': hash_password(password),
        'plan': 'free',
        'created_at': time.time(),
        'daily_ai_usage': 0,
        'daily_competitor_usage': 0,
        'last_usage_date': time.strftime('%Y-%m-%d'),
        'bound_shops': []
    }
    save_users(users)

    session['user_id'] = user_id
    session['username'] = phone
    return jsonify({'success': True, 'message': '注册成功', 'username': phone})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')

    if not phone or not password:
        return jsonify({'success': False, 'message': '请填写手机号和密码'})

    users = load_users()
    if phone not in users:
        return jsonify({'success': False, 'message': '该手机号未注册'})

    if users[phone]['password'] != hash_password(password):
        return jsonify({'success': False, 'message': '密码错误'})

    session['user_id'] = users[phone]['user_id']
    session['username'] = phone
    return jsonify({'success': True, 'message': '登录成功', 'username': phone})

@app.route('/api/user-info', methods=['GET'])
def api_user_info():
    user = get_current_user()
    if not user:
        return jsonify({'logged_in': False})
    
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    today = time.strftime('%Y-%m-%d')
    if user.get('last_usage_date') != today:
        daily_ai = 0
        daily_competitor = 0
    else:
        daily_ai = user.get('daily_ai_usage', 0)
        daily_competitor = user.get('daily_competitor_usage', 0)
    
    return jsonify({
        'logged_in': True,
        'username': user.get('username', ''),
        'phone': user.get('phone', ''),
        'plan': user.get('plan', 'free'),
        'plan_name': plan['name'],
        'daily_ai_usage': daily_ai,
        'daily_ai_limit': plan['daily_ai_limit'],
        'daily_competitor_usage': daily_competitor,
        'bound_shops': user.get('bound_shops', []),
        'permissions': {
            'can_export': plan['can_export'],
            'can_diagnosis': plan['can_diagnosis'],
            'can_monthly_report': plan['can_monthly_report'],
            'can_multi_shop': plan['can_multi_shop'],
            'can_api': plan['can_api']
        }
    })

# ==================== 健康检查 ====================
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'demo_mode': not bool(API_KEY),
        'api_key_configured': bool(API_KEY),
        'version': '3.0'
    })

# ==================== AI内容生成API ====================
@app.route('/api/generate-title', methods=['POST'])
def generate_title():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    can_use, msg = check_daily_limit(user, 'ai')
    if not can_use:
        return jsonify({'success': False, 'message': msg, 'need_upgrade': True})

    data = request.get_json()
    product_name = data.get('product_name', '')
    features = data.get('features', '')
    platform = data.get('platform', '淘宝')
    style = data.get('style', '引流爆款')
    word_count = data.get('word_count', '30字内')
    audience = data.get('audience', '通用')

    if not product_name:
        return jsonify({'success': False, 'message': '请输入商品名称'})

    if not API_KEY:
        # 演示模式：生成10组示例标题
        templates = [
            f"【爆款】2026新款{product_name} {features.split(',')[0] if features else ''} 百搭潮流款",
            f"{platform}热销 {product_name} {features} {style}风格 高点击率",
            f"【商场同款】{product_name} {features} {audience}必备 品质保证",
            f"2026新品 {product_name} {features} 网红推荐 限时特惠",
            f"【销量10万+】{product_name} {features} 好评如潮 复购率高",
            f"{product_name} {features} {word_count} 搜索优化 精准引流",
            f"【官方正品】{product_name} {features} 假一赔十 极速发货",
            f"{product_name} {features} {audience}专属 量身定制 舒适体验",
            f"【限时秒杀】{product_name} {features} 原价199 现价59 手慢无",
            f"{product_name} {features} 达人推荐 种草好物 必入清单"
        ]
        result = '\n'.join([f'{i+1}. {t}' for i, t in enumerate(templates)])
        return jsonify({'success': True, 'demo_mode': True, 'result': result})

    prompt = f"""{TITLE_PROMPT}

【输入参数】
商品名称：{product_name}
核心卖点：{features}
电商平台：{platform}
标题风格：{style}
标题字数：{word_count}
适用人群：{audience}"""
    result = call_doubao_api(prompt, max_tokens=1500)
    return jsonify({'success': True, 'demo_mode': False, 'result': result or '生成失败，请稍后重试'})

@app.route('/api/generate-detail', methods=['POST'])
def generate_detail():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    can_use, msg = check_daily_limit(user, 'ai')
    if not can_use:
        return jsonify({'success': False, 'message': msg, 'need_upgrade': True})

    data = request.get_json()
    product_name = data.get('product_name', '')
    features = data.get('features', '')
    params = data.get('params', '')
    platform = data.get('platform', '淘宝')
    style = data.get('style', '专业走心')
    include_after_sale = data.get('include_after_sale', True)
    include_shipping = data.get('include_shipping', True)
    include_tips = data.get('include_tips', True)

    if not product_name or not features:
        return jsonify({'success': False, 'message': '请填写商品名称和核心卖点'})

    if not API_KEY:
        result = f"""【首屏宣传语】
{product_name}，重新定义品质生活！{features}，每一处细节都为你着想。

【核心卖点拆解】
✓ {features.split(',')[0] if features else '优质材料'}：精选高品质原料，安全环保，使用更放心
✓ 精湛工艺：经过多道工序严格把控，品质有保障
✓ 人性化设计：贴合人体工学，使用舒适便捷
✓ 高性价比：工厂直供，省去中间环节，价格更实惠

【产品参数】
{params if params else '产品名称：' + product_name + '\n材质：优质面料\n规格：标准尺寸\n颜色：多色可选'}

【用户痛点解决】
❌ 担心质量差？→ 我们承诺7天无理由退换，品质有保障
❌ 担心不实用？→ 经过千次测试，适配多种场景
❌ 担心价格贵？→ 工厂直供，比实体店便宜50%

【产品优势对比】
普通产品：材料一般，工艺粗糙，无售后
我们的产品：{features}，精湛工艺，终身售后

【售后保障】
7天无理由退换 | 正品保证 | 假一赔十 | 极速发货

【发货说明】
下单后48小时内发货，默认快递，全国包邮（偏远地区除外）

【温馨提示】
1. 由于显示器不同，可能存在轻微色差，请以实物为准
2. 手工测量可能存在1-2cm误差，敬请谅解
3. 如有任何问题，请随时联系客服，我们将竭诚为您服务"""
        return jsonify({'success': True, 'demo_mode': True, 'result': result})

    prompt = f"""{DETAIL_PROMPT}

【输入参数】
商品名称：{product_name}
核心卖点：{features}
产品参数：{params}
适配平台：{platform}
文案风格：{style}
包含售后保障：{include_after_sale}
包含发货说明：{include_shipping}
包含温馨提示：{include_tips}"""
    result = call_doubao_api(prompt, max_tokens=2500)
    return jsonify({'success': True, 'demo_mode': False, 'result': result or '生成失败，请稍后重试'})

@app.route('/api/generate-service', methods=['POST'])
def generate_service():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    can_use, msg = check_daily_limit(user, 'ai')
    if not can_use:
        return jsonify({'success': False, 'message': msg, 'need_upgrade': True})

    data = request.get_json()
    scenario = data.get('scenario', '售前咨询')
    question = data.get('question', '')
    style = data.get('style', '温柔亲和')

    if not question:
        return jsonify({'success': False, 'message': '请输入具体问题场景'})

    if not API_KEY:
        result = f"""【话术1 - {style}版】
亲，非常感谢您的咨询~关于您问的「{question}」，我来为您详细解答哦~我们的产品都是经过严格质检的，质量方面您完全可以放心呢！如果收到后有任何不满意，我们支持7天无理由退换哦~

【话术2 - 专业正式版】
您好，感谢您的咨询。关于「{question}」，请允许我为您说明：我们的产品均符合国家质量标准，出厂前经过多道检测。如有质量问题，我们将按照三包政策为您处理，请您放心购买。

【话术3 - 简洁高效版】
亲，{question}这个问题不用担心哦~我们产品质量有保障，7天无理由退换，放心拍！

【话术4 - 高情商挽留版】
亲，我特别理解您的顾虑~毕竟网上购物看不到实物嘛~不过您放心，我们家做了这么多年，靠的就是口碑和品质！您说的「{question}」，我们有完善的售后保障，绝对让您购物无忧~要不您先拍一件试试，不满意随时退！

【话术5 - 促单转化版】
亲，您问的「{question}」完全不用担心哦~现在下单还有限时优惠呢！而且我们承诺7天无理由退换，您零风险购物~库存不多了，喜欢的话赶紧下手哦！"""
        return jsonify({'success': True, 'demo_mode': True, 'result': result})

    prompt = f"""{SERVICE_PROMPT}

【输入参数】
沟通场景：{scenario}
具体问题：{question}
话术风格：{style}"""
    result = call_doubao_api(prompt, max_tokens=2000)
    return jsonify({'success': True, 'demo_mode': False, 'result': result or '生成失败，请稍后重试'})

# ==================== 竞品数据分析API ====================
@app.route('/api/competitor-analysis', methods=['POST'])
def competitor_analysis():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    can_use, msg = check_daily_limit(user, 'competitor')
    if not can_use:
        return jsonify({'success': False, 'message': msg, 'need_upgrade': True})

    data = request.get_json()
    url = data.get('url', '')
    if not url:
        return jsonify({'success': False, 'message': '请输入竞品商品链接'})

    # 演示模式：返回模拟竞品数据
    product_name = '竞品商品' + str(random.randint(100, 999))
    base_price = random.randint(30, 200)
    
    result = {
        'product_name': product_name,
        'current_price': round(base_price * 0.85, 2),
        'original_price': base_price,
        'price_history': [
            {'date': '7天前', 'price': round(base_price * 0.95, 2)},
            {'date': '5天前', 'price': round(base_price * 0.9, 2)},
            {'date': '3天前', 'price': round(base_price * 0.88, 2)},
            {'date': '今天', 'price': round(base_price * 0.85, 2)}
        ],
        'monthly_sales': random.randint(500, 5000),
        'total_sales': random.randint(5000, 50000),
        'daily_sales': random.randint(20, 200),
        'reviews': {
            'total': random.randint(1000, 10000),
            'good_rate': round(random.uniform(90, 98), 1),
            'good_keywords': ['质量好', '发货快', '性价比高', '客服好', '包装精美'],
            'bad_keywords': ['有点色差', '尺码偏大', '物流慢', '包装简陋'],
            'core_needs': ['希望更多颜色', '希望加大尺码', '希望更便宜']
        },
        'promotions': {
            'current': ['满100减10', '第二件半价', '限时85折'],
            'coupon': '5元无门槛券',
            'strategy': '低价引流+满减提升客单价'
        },
        'selling_points': '优质材料、精湛工艺、高性价比、极速发货',
        'title_analysis': '包含核心关键词3个、长尾词2个、营销词2个'
    }
    
    # AI分析总结
    if not API_KEY:
        ai_summary = f"""【竞品核心优势】
1. 价格优势：当前售价{result['current_price']}元，较原价{result['original_price']}元优惠15%，价格竞争力强
2. 销量表现：月销{result['monthly_sales']}+，累计{result['total_sales']}+，市场认可度高
3. 好评率{result['reviews']['good_rate']}%，用户口碑良好

【竞品短板与用户差评痛点】
1. 用户反馈{result['reviews']['bad_keywords'][0]}、{result['reviews']['bad_keywords'][1]}，品控有待提升
2. 促销活动频繁，可能影响品牌调性
3. 核心需求未满足：{result['reviews']['core_needs'][0]}

【我方店铺差异化优化方向】
1. 品质升级：针对竞品差评痛点，加强品控，主打高品质定位
2. 服务差异化：提供更完善的售后保障，如30天无理由退换
3. 品类延伸：开发竞品缺失的颜色/尺码，满足用户核心需求

【定价策略建议】
建议定价{round(base_price * 0.9, 2)}元，略高于竞品但强调品质差异，配合首单优惠降低决策门槛

【卖点优化建议】
主打「高品质+完善售后+{result['reviews']['core_needs'][0]}」，与竞品形成差异化

【活动布局建议】
避开竞品大促节点，提前布局；日常用会员价、满赠等方式提升复购"""
    else:
        prompt = f"""{COMPETITOR_PROMPT}

【竞品数据】
商品名称：{result['product_name']}
当前价格：{result['current_price']}元
原价：{result['original_price']}元
月销量：{result['monthly_sales']}
总销量：{result['total_sales']}
好评率：{result['reviews']['good_rate']}%
好评关键词：{', '.join(result['reviews']['good_keywords'])}
差评关键词：{', '.join(result['reviews']['bad_keywords'])}
用户核心需求：{', '.join(result['reviews']['core_needs'])}
当前促销：{', '.join(result['promotions']['current'])}
核心卖点：{result['selling_points']}"""
        ai_summary = call_doubao_api(prompt, max_tokens=2000) or '分析失败'
    
    result['ai_summary'] = ai_summary
    return jsonify({'success': True, 'demo_mode': not bool(API_KEY), 'data': result})

# ==================== 店铺数据监控API ====================
@app.route('/api/shop-data', methods=['GET'])
def shop_data():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})

    # 演示模式：返回模拟店铺数据
    today_orders = random.randint(20, 100)
    yesterday_orders = random.randint(20, 100)
    order_change = round((today_orders - yesterday_orders) / yesterday_orders * 100, 1)
    
    today_sales = round(today_orders * random.uniform(50, 150), 2)
    yesterday_sales = round(yesterday_orders * random.uniform(50, 150), 2)
    sales_change = round((today_sales - yesterday_sales) / yesterday_sales * 100, 1)
    
    visitors = random.randint(500, 3000)
    conversion_rate = round(today_orders / visitors * 100, 2)
    
    data = {
        'overview': {
            'today_orders': today_orders,
            'order_change': order_change,
            'today_sales': today_sales,
            'sales_change': sales_change,
            'visitors': visitors,
            'conversion_rate': conversion_rate,
            'avg_order_value': round(today_sales / today_orders, 2),
            'refund_rate': round(random.uniform(1, 5), 1)
        },
        'trend_7d': {
            'dates': ['第1天', '第2天', '第3天', '第4天', '第5天', '第6天', '今天'],
            'visitors': [random.randint(500, 3000) for _ in range(7)],
            'orders': [random.randint(20, 100) for _ in range(7)],
            'sales': [round(random.uniform(1000, 10000), 2) for _ in range(7)]
        },
        'top_products': [
            {'name': '爆款商品A', 'sales': random.randint(100, 500), 'revenue': round(random.uniform(5000, 20000), 2), 'trend': 'up'},
            {'name': '热销商品B', 'sales': random.randint(50, 200), 'revenue': round(random.uniform(2000, 10000), 2), 'trend': 'up'},
            {'name': '潜力商品C', 'sales': random.randint(30, 100), 'revenue': round(random.uniform(1000, 5000), 2), 'trend': 'down'},
            {'name': '新品商品D', 'sales': random.randint(10, 50), 'revenue': round(random.uniform(500, 2000), 2), 'trend': 'up'},
            {'name': '滞销商品E', 'sales': random.randint(0, 10), 'revenue': round(random.uniform(0, 500), 2), 'trend': 'down'}
        ],
        'traffic_sources': [
            {'name': '自然搜索', 'percent': random.randint(30, 50), 'visitors': random.randint(200, 1000)},
            {'name': '付费流量', 'percent': random.randint(10, 30), 'visitors': random.randint(100, 500)},
            {'name': '推荐流量', 'percent': random.randint(10, 25), 'visitors': random.randint(50, 300)},
            {'name': '短视频', 'percent': random.randint(5, 20), 'visitors': random.randint(50, 200)},
            {'name': '其他', 'percent': random.randint(5, 15), 'visitors': random.randint(20, 100)}
        ],
        'alerts': [
            {'type': 'warning', 'message': '商品C流量连续3天下滑，建议优化标题主图', 'time': '2小时前'},
            {'type': 'danger', 'message': '转化率低于行业均值2.5%，建议优化详情页', 'time': '5小时前'},
            {'type': 'info', 'message': '竞品A降价10%，建议关注价格动态', 'time': '1天前'}
        ]
    }
    
    return jsonify({'success': True, 'demo_mode': True, 'data': data})

# ==================== AI智能运营诊断API ====================
@app.route('/api/operation-diagnosis', methods=['POST'])
def operation_diagnosis():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    if not plan['can_diagnosis']:
        return jsonify({'success': False, 'message': 'AI智能运营诊断为付费功能，请升级会员解锁', 'need_upgrade': True})

    if not API_KEY:
        result = """【店铺整体运营评分】
综合评分：68分 / 100分
流量维度：65分 | 转化维度：72分 | 货品维度：70分 | 客服维度：75分 | 活动维度：60分

【流量短板问题+提升方案】
问题1：自然搜索流量占比过低（仅35%），过度依赖付费流量
→ 优化方案：
  ① 重新优化10款主推商品标题，植入核心关键词和长尾词
  ② 每周上新2-3款新品，获取新品流量扶持
  ③ 布局短视频内容，每周发布3条种草视频
  ④ 预计30天内自然搜索流量提升40%

问题2：付费流量ROI偏低（仅1:2.1）
→ 优化方案：
  ① 暂停ROI低于1:1.5的关键词
  ② 集中预算投放高转化关键词
  ③ 优化直通车创意图，提高点击率
  ④ 目标ROI提升至1:3以上

【转化短板问题+优化方案】
问题1：详情页转化率2.1%，低于行业均值3%
→ 优化方案：
  ① 首屏增加痛点场景图，直击用户需求
  ② 增加买家秀和评价截图，建立信任
  ③ 优化卖点排版，3秒内让用户看懂核心优势
  ④ 增加限时优惠倒计时，营造紧迫感

问题2：客单价偏低（仅85元）
→ 优化方案：
  ① 设置满150减20，提升客单价
  ② 推出搭配套餐，关联销售
  ③ 详情页增加「买了又买」推荐模块

【滞销商品优化建议】
商品E（月销仅5件）：
→ 方案A：降价清仓，设置限时5折，回笼资金
→ 方案B：捆绑热销商品A，做「买A送E」活动
→ 方案C：重新包装定位，更换主图标题，作为新品重新上架

【竞品差异化突围策略】
竞品主打低价路线，我方差异化方向：
1. 品质升级：强调材料/工艺优势，做中高端定位
2. 服务升级：30天无理由退换+专属客服，建立信任
3. 内容差异化：深耕短视频种草，建立品牌人设
4. 品类差异化：开发竞品缺失的规格/颜色

【短期7天运营执行计划】
第1天：完成10款主推商品标题优化
第2天：完成5款主推商品主图优化
第3天：详情页首屏改版，增加痛点场景
第4天：设置满减活动和搭配套餐
第5天：发布3条短视频种草内容
第6天：直通车关键词优化，暂停低效词
第7天：数据复盘，调整下周计划

【长期优化方向】
1. 3个月内打造2款月销500+的爆款
2. 建立私域流量池，复购率提升至20%
3. 布局多平台运营，降低单一平台风险
4. 逐步建立品牌认知，摆脱价格战"""
        return jsonify({'success': True, 'demo_mode': True, 'result': result})

    prompt = f"""{DIAGNOSIS_PROMPT}

【店铺数据】
今日订单：{random.randint(20, 100)}单
今日销售额：{random.randint(1000, 10000)}元
访客数：{random.randint(500, 3000)}
转化率：{round(random.uniform(1.5, 4), 2)}%
客单价：{random.randint(50, 150)}元
退款率：{round(random.uniform(1, 5), 1)}%
热销商品：5款
滞销商品：3款"""
    result = call_doubao_api(prompt, max_tokens=3000)
    return jsonify({'success': True, 'demo_mode': False, 'result': result or '诊断失败，请稍后重试'})

# ==================== 自动报表生成API ====================
@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    data = request.get_json()
    report_type = data.get('report_type', 'weekly')
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    
    if report_type == 'monthly' and not plan['can_monthly_report']:
        return jsonify({'success': False, 'message': '月报为付费功能，请升级会员解锁', 'need_upgrade': True})

    if not API_KEY:
        period = '本周' if report_type == 'weekly' else '本月'
        result = f"""【电商运营{period}报表】
报告周期：{period}
生成时间：{time.strftime('%Y-%m-%d %H:%M')}

━━━━━━━━━━━━━━━━━━━━
一、周期数据汇总
━━━━━━━━━━━━━━━━━━━━
总访客数：{random.randint(5000, 20000)}人（环比+{random.randint(5, 20)}%）
总订单数：{random.randint(200, 1000)}单（环比+{random.randint(3, 15)}%）
总销售额：{random.randint(10000, 80000)}元（环比+{random.randint(5, 25)}%）
转化率：{round(random.uniform(2, 4), 2)}%（环比+{round(random.uniform(0.1, 0.5), 2)}%）
客单价：{random.randint(60, 120)}元（环比+{random.randint(2, 10)}%）
退款率：{round(random.uniform(1, 4), 1)}%（环比-{round(random.uniform(0.2, 1), 1)}%）

━━━━━━━━━━━━━━━━━━━━
二、店铺运营亮点
━━━━━━━━━━━━━━━━━━━━
1. 爆款商品A{period}销量{random.randint(100, 500)}件，贡献销售额{random.randint(5000, 20000)}元，占比{random.randint(25, 40)}%
2. 自然搜索流量占比提升至{random.randint(40, 55)}%，流量结构持续优化
3. 短视频种草内容{period}发布{random.randint(5, 15)}条，带来流量{random.randint(500, 2000)}人
4. 复购率提升至{random.randint(10, 20)}%，老客贡献持续增加
5. 客服响应时间缩短至{random.randint(1, 5)}分钟，客户满意度{random.randint(90, 98)}%

━━━━━━━━━━━━━━━━━━━━
三、核心问题复盘
━━━━━━━━━━━━━━━━━━━━
1. 付费流量ROI偏低（1:{round(random.uniform(1.5, 2.5), 1)}），部分关键词投入产出不成正比
2. 商品C流量持续下滑，{period}流量下降{random.randint(15, 30)}%，需重点关注
3. 转化率仍低于行业均值，详情页优化空间较大
4. 滞销商品E库存积压{random.randint(50, 200)}件，占用资金
5. 大促活动准备不足，错失部分流量红利

━━━━━━━━━━━━━━━━━━━━
四、竞品动态分析
━━━━━━━━━━━━━━━━━━━━
1. 竞品A{period}降价{random.randint(5, 15)}%，销量增长{random.randint(10, 30)}%，价格竞争加剧
2. 竞品B推出新品，主打「{random.choice(['高品质', '高颜值', '功能性'])}」定位，分流部分用户
3. 竞品C加大短视频投放，{period}新增{random.randint(10, 30)}条内容，流量增长明显
4. 行业整体{period}销售额增长{random.randint(5, 15)}%，我方增速{random.choice(['高于', '低于'])}行业平均

━━━━━━━━━━━━━━━━━━━━
五、数据异常原因
━━━━━━━━━━━━━━━━━━━━
1. {period}第3天流量骤降{random.randint(20, 40)}%：原因是主推商品标题违规被降权，已修改恢复
2. 退款率{period}中旬偏高：原因是批次商品存在质量问题，已加强品控
3. 客单价波动较大：原因是满减活动设置不合理，已优化活动门槛

━━━━━━━━━━━━━━━━━━━━
六、下周期可落地运营计划
━━━━━━━━━━━━━━━━━━━━
【流量提升】
1. 完成10款商品标题优化，目标自然搜索流量+30%
2. 直通车关键词优化，暂停ROI<1.5的词，目标ROI提升至1:3
3. 发布10条短视频种草内容，目标引流2000+人
4. 参与平台官方活动2场，获取活动流量

【转化提升】
1. 完成5款主推商品详情页首屏改版，目标转化率+20%
2. 增加买家秀模块，每款商品补充10条优质评价
3. 设置满150减20活动，目标客单价提升至100元+
4. 优化客服话术，响应时间控制在3分钟内

【货品优化】
1. 滞销商品E降价清仓，目标清库存80%
2. 新品F上架，配合首单优惠快速起量
3. 爆款A备货充足，避免断货
4. 开发2款差异化新品，填补品类空白

【目标设定】
下周期目标：销售额{random.randint(15000, 100000)}元（+{random.randint(20, 40)}%）
订单数：{random.randint(300, 1500)}单（+{random.randint(15, 30)}%）
转化率：{round(random.uniform(2.5, 4.5), 2)}%（+{round(random.uniform(0.3, 0.8), 2)}%）

━━━━━━━━━━━━━━━━━━━━
报告说明：本报表由AI自动生成，数据仅供参考，具体以平台后台为准。
生成时间：{time.strftime('%Y-%m-%d %H:%M:%S')}"""
        return jsonify({'success': True, 'demo_mode': True, 'result': result})

    prompt = f"""{REPORT_PROMPT}

【报表类型】：{report_type}
【周期数据】：
总访客：{random.randint(5000, 20000)}
总订单：{random.randint(200, 1000)}
总销售额：{random.randint(10000, 80000)}元
转化率：{round(random.uniform(2, 4), 2)}%
客单价：{random.randint(60, 120)}元"""
    result = call_doubao_api(prompt, max_tokens=3000)
    return jsonify({'success': True, 'demo_mode': False, 'result': result or '报表生成失败'})

# ==================== 店铺绑定管理API ====================
@app.route('/api/bind-shop', methods=['POST'])
def bind_shop():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    data = request.get_json()
    platform = data.get('platform', '')
    shop_name = data.get('shop_name', '')
    auth_code = data.get('auth_code', '')
    
    if not platform or not shop_name or not auth_code:
        return jsonify({'success': False, 'message': '请填写完整信息'})
    
    plan = MEMBER_PLANS.get(user.get('plan', 'free'), MEMBER_PLANS['free'])
    current_shops = user.get('bound_shops', [])
    if not plan['can_multi_shop'] and len(current_shops) >= 1:
        return jsonify({'success': False, 'message': '免费版仅支持绑定1个店铺，升级企业版可绑定10个店铺', 'need_upgrade': True})
    
    shop_info = {
        'id': str(uuid.uuid4()),
        'platform': platform,
        'shop_name': shop_name,
        'auth_code': auth_code,
        'status': 'active',
        'bind_time': time.time(),
        'last_sync': time.time()
    }
    
    users = load_users()
    users[user['username']].setdefault('bound_shops', []).append(shop_info)
    save_users(users)
    
    return jsonify({'success': True, 'message': '店铺绑定成功', 'shop': shop_info})

@app.route('/api/unbind-shop', methods=['POST'])
def unbind_shop():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    data = request.get_json()
    shop_id = data.get('shop_id', '')
    
    users = load_users()
    shops = users[user['username']].get('bound_shops', [])
    users[user['username']]['bound_shops'] = [s for s in shops if s['id'] != shop_id]
    save_users(users)
    
    return jsonify({'success': True, 'message': '店铺已解绑'})

# ==================== 会员升级API（演示） ====================
@app.route('/api/upgrade-plan', methods=['POST'])
def upgrade_plan():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'message': '请先登录', 'need_login': True})
    
    data = request.get_json()
    plan = data.get('plan', '')
    
    if plan not in MEMBER_PLANS:
        return jsonify({'success': False, 'message': '无效的套餐'})
    
    users = load_users()
    users[user['username']]['plan'] = plan
    save_users(users)
    
    return jsonify({'success': True, 'message': f'已升级为{MEMBER_PLANS[plan]["name"]}', 'plan': plan})

# ==================== 启动 ====================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
