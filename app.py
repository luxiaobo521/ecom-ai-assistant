# -*- coding: utf-8 -*-
"""
电商运营AI助手 - SaaS后端
功能：商品标题生成、详情页文案生成、客服话术生成、运营建议
"""
from flask import Flask, render_template, request, jsonify
import requests
import json
import os
import re

app = Flask(__name__)

# ========== 配置 ==========
# 豆包API配置（用户需自行填入）
# 获取地址：https://www.volcengine.com/product/doubao
API_KEY = os.environ.get("DOUBAO_API_KEY", "")
API_BASE = "https://ark.cn-beijing.volces.com/api/v3"
MODEL_ID = os.environ.get("DOUBAO_MODEL_ID", "doubao-1-5-pro-32k-250115")

# 演示模式（没有API密钥时自动开启，返回示例数据）
DEMO_MODE = (API_KEY == "")

# ========== AI调用核心函数 ==========
def call_ai(system_prompt, user_prompt, max_tokens=2000):
    """调用豆包API生成内容"""
    if DEMO_MODE:
        return get_demo_response(system_prompt, user_prompt)

    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "model": MODEL_ID,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": max_tokens,
            "temperature": 0.7
        }
        response = requests.post(
            f"{API_BASE}/chat/completions",
            headers=headers,
            json=data,
            timeout=60
        )
        result = response.json()
        if "choices" in result and len(result["choices"]) > 0:
            return result["choices"][0]["message"]["content"]
        else:
            return f"API调用失败：{json.dumps(result, ensure_ascii=False)}"
    except Exception as e:
        return f"调用出错：{str(e)}"

# ========== 演示模式返回示例数据 ==========
def get_demo_response(system_prompt, user_prompt):
    """演示模式：根据不同功能返回示例数据"""
    if "标题" in system_prompt or "title" in system_prompt.lower():
        return """1. 【爆款】2026新款夏季纯棉T恤男 宽松百搭短袖 潮流印花半袖上衣
2. 男士短袖T恤2026夏季新款 纯棉宽松打底衫 潮流ins风百搭半袖
3. 【商场同款】夏季男士纯棉T恤 宽松透气短袖 潮流印花百搭上衣
4. 2026夏装新款男士短袖T恤 纯棉宽松版型 潮流印花百搭半袖衫
5. 【热销10万+】夏季男士纯棉短袖T恤 宽松百搭潮流印花半袖上衣"""

    elif "详情页" in system_prompt or "detail" in system_prompt.lower():
        return """【产品卖点】
✅ 100%纯棉面料，亲肤透气，夏季穿着不闷热
✅ 宽松版型设计，不挑身材，80-200斤都能穿
✅ 潮流印花图案，时尚百搭，日常出街必备
✅ 精密走线工艺，耐洗耐穿，不易变形不起球

【产品参数】
品牌：XXX
材质：100%纯棉
风格：潮流百搭
适用季节：夏季
适用人群：男士
颜色：黑色/白色/灰色/藏青
尺码：M/L/XL/XXL/XXXL

【尺码建议】
M码：建议体重80-100斤
L码：建议体重100-120斤
XL码：建议体重120-140斤
XXL码：建议体重140-160斤
XXXL码：建议体重160-200斤

【洗涤说明】
1. 建议冷水手洗或机洗，水温不超过30℃
2. 请勿使用漂白剂，以免褪色
3. 反面晾晒，避免阳光直射
4. 中温熨烫，请勿直接熨烫印花部位"""

    elif "客服" in system_prompt or "customer" in system_prompt.lower():
        return """【常见问题客服话术】

Q：这件衣服尺码标准吗？偏大还是偏小？
A：亲，这款是宽松版型哦，尺码标准的呢~建议按照平时穿的尺码选购就可以啦。如果喜欢宽松一点可以拍大一码，具体可以参考详情页的尺码表哦，有疑问随时联系我~

Q：面料是什么材质的？穿着闷热吗？
A：亲，这款是100%纯棉面料哦，亲肤透气，夏季穿着非常舒适不闷热的呢~纯棉面料吸汗性好，是夏季T恤的首选材质哦，放心购买~

Q：可以退换货吗？
A：亲，支持7天无理由退换货哦~收到商品后如果不满意，在不影响二次销售的情况下，7天内都可以申请退换货的呢，运费险已经为您买好啦，放心购买~

Q：什么时候发货？发什么快递？
A：亲，当天16点前下单当天发货，16点后下单次日发货哦~默认发中通/圆通快递，偏远地区发邮政，一般3-5天可以送达，急用可以备注发顺丰（需补运费）哦~"""

    elif "运营" in system_prompt or "operation" in system_prompt.lower():
        return """【店铺运营诊断与优化建议】

一、流量分析
当前店铺日均访客500+，主要来源于自然搜索（占比60%）和推荐流量（占比25%）。
问题：自然搜索流量占比偏高，推荐流量有提升空间；付费流量占比仅5%，直通车投放不足。
建议：
1. 增加直通车投放预算，重点投放高转化关键词
2. 优化商品主图，提升点击率，获取更多推荐流量
3. 参与平台活动，获取活动流量扶持

二、转化分析
当前店铺转化率2.5%，低于行业均值3.2%。
问题：详情页转化率偏低，客服响应时间较长，缺乏促销活动刺激。
建议：
1. 优化详情页，增加买家秀和评价展示，提升信任感
2. 设置满减、优惠券等促销活动，提升转化
3. 客服响应时间控制在30秒内，设置自动回复

三、客单价分析
当前客单价85元，低于行业均值120元。
建议：
1. 设置满减门槛（如满150减20），引导凑单
2. 推出搭配套餐，提升连带率
3. 增加中高价位商品，优化价格带结构

四、爆款打造
当前店铺无明显爆款，销量最高商品月销200+。
建议：
1. 选择1-2款潜力商品，集中资源打造爆款
2. 优化标题和主图，提升搜索排名
3. 通过直通车+淘宝客快速起量
4. 爆款带动店铺整体流量和销量

五、本周行动计划
1. 周一：完成3款商品标题优化
2. 周二：更新详情页，增加买家秀模块
3. 周三：设置满减活动和优惠券
4. 周四：直通车关键词优化，增加预算
5. 周五：客服话术培训，提升响应速度
6. 周末：数据复盘，调整下周策略"""

    else:
        return "【演示模式】这是示例返回内容。配置API密钥后将返回真实AI生成内容。"

# ========== 路由：首页 ==========
@app.route("/")
def index():
    return render_template("index.html", demo_mode=DEMO_MODE)

# ========== API：商品标题生成 ==========
@app.route("/api/generate-title", methods=["POST"])
def generate_title():
    data = request.json
    product_name = data.get("product_name", "")
    category = data.get("category", "")
    features = data.get("features", "")
    target_platform = data.get("platform", "淘宝")

    system_prompt = """你是一位资深电商运营专家，擅长撰写高点击率的商品标题。
请根据用户提供的商品信息，生成5个符合平台规则的优质商品标题。
要求：
1. 标题包含核心关键词、属性词、营销词
2. 符合平台标题字数限制（淘宝30字/60字符）
3. 避免违规词和极限词
4. 标题要有吸引力，能提升点击率
5. 每个标题单独一行，编号1-5"""

    user_prompt = f"""商品名称：{product_name}
商品类目：{category}
商品卖点/特征：{features}
目标平台：{target_platform}

请生成5个优质商品标题。"""

    result = call_ai(system_prompt, user_prompt)
    return jsonify({"result": result, "demo_mode": DEMO_MODE})

# ========== API：详情页文案生成 ==========
@app.route("/api/generate-detail", methods=["POST"])
def generate_detail():
    data = request.json
    product_name = data.get("product_name", "")
    category = data.get("category", "")
    features = data.get("features", "")
    price = data.get("price", "")
    target_audience = data.get("target_audience", "")

    system_prompt = """你是一位资深电商文案策划专家，擅长撰写高转化率的商品详情页文案。
请根据用户提供的商品信息，生成完整的详情页文案。
要求：
1. 包含产品卖点、产品参数、尺码/规格说明、使用场景、洗涤/保养说明、售后保障等模块
2. 文案要有说服力，能打动目标用户
3. 使用emoji和符号增强可读性
4. 避免违规词和极限词
5. 结构清晰，分模块展示"""

    user_prompt = f"""商品名称：{product_name}
商品类目：{category}
商品卖点/特征：{features}
商品价格：{price}
目标用户：{target_audience}

请生成完整的商品详情页文案。"""

    result = call_ai(system_prompt, user_prompt)
    return jsonify({"result": result, "demo_mode": DEMO_MODE})

# ========== API：客服话术生成 ==========
@app.route("/api/generate-customer-service", methods=["POST"])
def generate_customer_service():
    data = request.json
    product_name = data.get("product_name", "")
    category = data.get("category", "")
    common_questions = data.get("common_questions", "")
    style = data.get("style", "亲切热情")

    system_prompt = """你是一位资深电商客服培训专家，擅长撰写高转化率的客服话术。
请根据用户提供的商品信息，生成常见问题的客服回复话术。
要求：
1. 覆盖售前、售中、售后常见问题
2. 话术亲切自然，有温度，不机械
3. 包含自动回复、常见问题解答、催付话术、售后处理话术
4. 避免违规承诺
5. 每个问题用Q&A格式展示"""

    user_prompt = f"""商品名称：{product_name}
商品类目：{category}
常见问题（用户补充）：{common_questions}
话术风格：{style}

请生成完整的客服话术库，包含至少10个常见问题的回复。"""

    result = call_ai(system_prompt, user_prompt)
    return jsonify({"result": result, "demo_mode": DEMO_MODE})

# ========== API：运营建议 ==========
@app.route("/api/generate-operation-advice", methods=["POST"])
def generate_operation_advice():
    data = request.json
    shop_name = data.get("shop_name", "")
    platform = data.get("platform", "淘宝")
    daily_visitors = data.get("daily_visitors", "")
    conversion_rate = data.get("conversion_rate", "")
    avg_order_value = data.get("avg_order_value", "")
    monthly_sales = data.get("monthly_sales", "")
    main_products = data.get("main_products", "")
    problems = data.get("problems", "")

    system_prompt = """你是一位资深电商运营顾问，擅长店铺诊断和运营策略制定。
请根据用户提供的店铺数据，生成完整的运营诊断报告和优化建议。
要求：
1. 从流量、转化、客单价、爆款、内容、活动等维度进行分析
2. 指出当前存在的问题和原因
3. 给出具体可执行的优化建议
4. 制定本周/本月行动计划
5. 数据驱动，有理有据，不空谈"""

    user_prompt = f"""店铺名称：{shop_name}
所在平台：{platform}
日均访客：{daily_visitors}
转化率：{conversion_rate}
客单价：{avg_order_value}
月销售额：{monthly_sales}
主营商品：{main_products}
当前遇到的问题：{problems}

请生成完整的店铺运营诊断报告和优化建议。"""

    result = call_ai(system_prompt, user_prompt)
    return jsonify({"result": result, "demo_mode": DEMO_MODE})

# ========== API：健康检查 ==========
@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "demo_mode": DEMO_MODE,
        "api_key_configured": not DEMO_MODE
    })

if __name__ == "__main__":
    print("=" * 50)
    print("电商运营AI助手 - SaaS服务启动")
    print("=" * 50)
    if DEMO_MODE:
        print("⚠️  当前为演示模式（未配置API密钥）")
        print("   配置方式：设置环境变量 DOUBAO_API_KEY 和 DOUBAO_MODEL_ID")
        print("   或直接修改 app.py 中的 API_KEY 和 MODEL_ID")
    else:
        print("✅ API密钥已配置，使用真实AI生成")
    print("=" * 50)
    print("访问地址：http://127.0.0.1:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
