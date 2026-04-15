"""
用李凯风的简历信息填充 Profile，通过 HTTP API 调用后端。
"""
import json
import urllib.request

BASE = "http://localhost:8000"

def api(method, path, data=None):
    body = json.dumps(data, ensure_ascii=False).encode() if data else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"} if body else {},
        method=method,
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

# ======== 1. 更新 Profile 基本信息 ========
print("=== 1. 更新 Profile 基本信息 ===")
profile = api("PUT", "/api/profile/", {
    "name": "李凯风",
    "headline": "华南师范大学 · 软件工程 · 中国电信研发工程师",
    "exit_story": "在中国电信开创了AI视频解决方案，但希望进入更前沿的AI/AIGC创业公司，发挥技术产品双栖优势",
    "cross_cutting_advantage": "软件工程科班 + AIGC视频制作实战经验 + 社交媒体运营（小红书5.1万赞/B站100万播放）+ 企业级项目交付经验",
    "base_info_json": {
        "full_name": "李凯风",
        "phone": "188****5466",
        "email": "example@qq.com",
        "birth_date": "2003-02",
        "gender": "male",
        "location": "广东省深圳市",
        "current_status": "在职",
        "education_level": "本科",
        "university": "华南师范大学",
        "major": "软件工程",
        "gpa": "3.8",
        "english_level": "CET-6 532分"
    },
})
print(f"  Profile ID: {profile['id']}, Name: {profile['name']}")

# ======== 2. 添加目标岗位 ========
print("\n=== 2. 添加目标岗位 ===")
roles = [
    {"role_name": "AIGC产品经理", "role_level": "初级", "fit": "primary"},
    {"role_name": "AI应用研发工程师", "role_level": "初级", "fit": "primary"},
    {"role_name": "视频技术产品经理", "role_level": "初级", "fit": "secondary"},
]
for r in roles:
    resp = api("POST", "/api/profile/target-roles", r)
    print(f"  Created role: {resp['role_name']} ({resp['fit']})")

# ======== 3. 添加教育经历 ========
print("\n=== 3. 添加教育经历 ===")
api("POST", "/api/profile/sections", {
    "section_type": "education",
    "title": "华南师范大学 - 软件工程（全日制本科）",
    "sort_order": 1,
    "content_json": {
        "field_values": {
            "school": "华南师范大学",
            "degree": "本科",
            "major": "软件工程",
            "start_date": "2021-09",
            "end_date": "2025-06",
            "gpa": "3.8",
            "tags": ["211", "双一流", "全日制"],
            "highlights": "大学英语六级532分"
        }
    },
    "source": "manual",
    "confidence": 1.0,
})
print("  Education added")

# ======== 4. 添加工作经历 ========
print("\n=== 4. 添加工作经历 ===")
api("POST", "/api/profile/sections", {
    "section_type": "experience",
    "title": "中国电信佛山分公司 - 云中台软研中心研发工程师",
    "sort_order": 2,
    "content_json": {
        "field_values": {
            "company": "中国电信股份有限公司佛山分公司",
            "position": "云中台软研中心研发工程师",
            "start_date": "2025-07",
            "end_date": "至今",
            "entry_method": "校招",
            "department": "云中台软研中心",
            "bullets": [
                "40+员工绩效考核中获最高等级（Top 2），入职不到半年成为多个项目骨干技术人员",
                "独立负责佛山某电视台主持人AIGC数字人项目，中途接手并成功交付，获甲方好评",
                "作为技术负责人主导公司年会领导宣传片AI视频项目（3分钟古装短片），年会播出引起巨大反响，被邀请到广东省公司交流",
                "宣传片现于佛山公司大堂每日循环播放，各兄弟单位交流频繁，为此总结技术规范流程形成标准解决方案",
                "利用春节假期完成公司电话彩铃AI视频项目，配合总公司要求",
                "受邀为佛山某镇制作文化旅游宣传AI视频短片，运用自研解决方案一周内交付",
            ]
        }
    },
    "source": "manual",
    "confidence": 1.0,
})
print("  Experience added")

# ======== 5. 添加技术方案项目 ========
print("\n=== 5. 添加AI视频解决方案项目 ===")
api("POST", "/api/profile/sections", {
    "section_type": "project",
    "title": "企业级AI视频制作解决方案",
    "sort_order": 3,
    "content_json": {
        "field_values": {
            "project_name": "企业级AI视频制作解决方案",
            "role": "技术负责人 & 项目执行人",
            "start_date": "2025-11",
            "end_date": "至今",
            "bullets": [
                "设计「L1资产增强-L2动作迁移-L3首尾衔接」分层技术栈，摒弃单一模型依赖",
                "L1层：MidJourney出图 + Nano Banana Pro二次编辑，建立可复用数字人资产库",
                "L2层：Wan Animate + Scail骨架驱动与动作迁移，实现素人到专业动作的精准映射",
                "L3层：Wan 2.2+Qwen3 + Google Veo3生成超现实场景，首尾帧技术控制时空连贯性",
                "RLHF思维迭代：基于反馈调整负向提示词和工作流，修正AI幻觉行为，实现高人物一致性",
                "将3分钟AI视频制作周期从数周压缩到1周（含前期影像采集和后期剪辑）",
            ]
        }
    },
    "source": "manual",
    "confidence": 1.0,
})
print("  Project added")

# ======== 6. 添加个人项目 - AI短剧SaaS ========
print("\n=== 6. 添加AI短剧SaaS平台项目 ===")
api("POST", "/api/profile/sections", {
    "section_type": "project",
    "title": "AI短剧垂直创作SaaS平台（个人探索项目）",
    "sort_order": 4,
    "content_json": {
        "field_values": {
            "project_name": "AI短剧垂直创作SaaS平台",
            "role": "产品设计者 & 技术架构师",
            "bullets": [
                "针对AI短剧赛道「门槛高」与「二次编辑难」的痛点，设计垂直SaaS平台方案",
                "创新设计「一键图层拆分」的剧情白板，将生成画面自动解构为人物/背景/道具独立图层",
                "支持用户像拼积木一样拖拽替换，将单镜头修改从「抽卡半小时」降低至「拖拽3秒」",
                "设计「制作流封装」共享交易社区：创作者打包提示词+参数+图层逻辑为「剧情模版」流通",
                "生态策略：大神造模版 + 小白用模版的共生生态，抹平技术鸿沟",
            ]
        }
    },
    "source": "manual",
    "confidence": 1.0,
})
print("  Side project added")

# ======== 7. 添加技能 ========
print("\n=== 7. 添加技能 ===")
api("POST", "/api/profile/sections", {
    "section_type": "skill",
    "title": "专业技能",
    "sort_order": 5,
    "content_json": {
        "field_values": {
            "skills": [
                {"name": "ComfyUI工作流", "level": "熟练", "category": "AIGC"},
                {"name": "Dify智能体编排", "level": "熟练", "category": "AI"},
                {"name": "Cursor Vibe Coding", "level": "熟练", "category": "开发"},
                {"name": "LLM/MCP/Skill应用", "level": "熟悉", "category": "AI"},
                {"name": "Prompt Engineering", "level": "丰富经验", "category": "AI"},
                {"name": "剪映/Photoshop", "level": "熟练", "category": "创作"},
                {"name": "产品需求文档(PRD)", "level": "良好", "category": "产品"},
                {"name": "WAN/Veo/MidJourney", "level": "熟练", "category": "AIGC"},
            ],
            "achievements": [
                "小红书累计获赞5.1万，1000+粉丝",
                "B站累计播放量100万+",
                "曾获小红书官方创作者激励金2400余元",
                "Reddit三次前1%发帖者评级，单帖最高37.5万点击",
            ]
        }
    },
    "source": "manual",
    "confidence": 1.0,
})
print("  Skills added")

# ======== 验证 ========
print("\n=== 验证 Profile 完整性 ===")
full = api("GET", "/api/profile/")
print(f"  Name: {full['name']}")
print(f"  Headline: {full['headline']}")
print(f"  Target Roles: {len(full.get('target_roles', []))}")
print(f"  Sections: {len(full.get('sections', []))}")
for s in full.get("sections", []):
    print(f"    - [{s['section_type']}] {s['title']}")

print("\n✅ Profile 创建完成!")
