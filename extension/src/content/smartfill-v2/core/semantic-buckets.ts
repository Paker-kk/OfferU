// Semantic bucket classification — prevents nonsense matches (e.g. family name -> project name)
// 85+ semantic buckets for type-level field classification

export enum SemanticBucket {
  PERSON_NAME = "person_name",
  SURNAME = "surname",
  GIVEN_NAME = "given_name",
  PHONE = "phone",
  EMAIL = "email",
  ADDRESS = "address",
  CITY = "city",
  PROVINCE = "province",
  DISTRICT = "district",
  POSTAL_CODE = "postal_code",
  STREET_ADDRESS = "street_address",
  BIRTH_DATE = "birth_date",
  AGE = "age",
  GENDER = "gender",
  ID_NUMBER = "id_number",
  SCHOOL_NAME = "school_name",
  MAJOR = "major",
  DEGREE = "degree",
  EDUCATION_LEVEL = "education_level",
  GPA = "gpa",
  GRADUATION_DATE = "graduation_date",
  EDUCATION_DATE_RANGE = "education_date_range",
  EDUCATION_DESCRIPTION = "education_description",
  COMPANY_NAME = "company_name",
  JOB_TITLE = "job_title",
  WORK_DATE_RANGE = "work_date_range",
  WORK_DESCRIPTION = "work_description",
  WORK_INDUSTRY = "work_industry",
  WORK_DEPARTMENT = "work_department",
  INTERNSHIP_COMPANY = "internship_company",
  INTERNSHIP_TITLE = "internship_title",
  INTERNSHIP_DATE_RANGE = "internship_date_range",
  PROJECT_NAME = "project_name",
  PROJECT_ROLE = "project_role",
  PROJECT_DATE_RANGE = "project_date_range",
  PROJECT_DESCRIPTION = "project_description",
  SKILL = "skill",
  LANGUAGE = "language",
  CERTIFICATE = "certificate",
  AWARD_NAME = "award_name",
  AWARD_DATE = "award_date",
  SOCIAL_URL = "social_url",
  LINKEDIN_URL = "linkedin_url",
  GITHUB_URL = "github_url",
  WEBSITE = "website",
  PORTFOLIO_URL = "portfolio_url",
  DESCRIPTION = "description",
  SELF_INTRODUCTION = "self_introduction",
  FAMILY_MEMBER_NAME = "family_member_name",
  FAMILY_RELATION = "family_relation",
  FAMILY_PHONE = "family_phone",
  FAMILY_COMPANY = "family_company",
  FAMILY_POSITION = "family_position",
  NATIVE_PLACE = "native_place",
  HOUSEHOLD = "household",
  POLITICAL_STATUS = "political_status",
  MARITAL_STATUS = "marital_status",
  NATIONALITY = "nationality",
  ETHNICITY = "ethnicity",
  BLOOD_TYPE = "blood_type",
  HEIGHT = "height",
  WEIGHT = "weight",
  SALARY = "salary",
  EXPECTED_SALARY = "expected_salary",
  CURRENT_SALARY = "current_salary",
  JOB_TYPE = "job_type",
  WORK_LOCATION = "work_location",
  AVAILABLE_DATE = "available_date",
  CURRENT_STATUS = "current_status",
  QQ = "qq",
  WECHAT = "wechat",
  EXPECTED_CITY = "expected_city",
  EXPECTED_INDUSTRY = "expected_industry",
  EXPECTED_POSITION = "expected_position",
  TRAINING_EXPERIENCE = "training_experience",
  PROFESSIONAL_TITLE = "professional_title",
  HOMETOWN = "hometown",
  RELIGION = "religion",
  HEALTH_STATUS = "health_status",
  DISABILITY_STATUS = "disability_status",
  DRIVING_LICENSE = "driving_license",
  HOBBIES = "hobbies",
  EMERGENCY_CONTACT = "emergency_contact",
  EMERGENCY_PHONE = "emergency_phone",
  REFERENCE_NAME = "reference_name",
  REFERENCE_PHONE = "reference_phone",
  REFERENCE_COMPANY = "reference_company",
  CUSTOM = "custom",
}

// ===== Pattern definitions (ordered by priority — more specific first) =====

interface BucketPattern {
  bucket: SemanticBucket;
  // Keyword patterns that must ALL be present in the label (AND mode)
  mustContainAll?: string[];
  // Keyword patterns where ANY match triggers the bucket (OR mode)
  keywords: string[];
  // Negative patterns — if any match, this bucket is rejected
  exclude?: string[];
  // Control type restriction (only match if controlType matches)
  controlTypes?: string[];
  // Context boost — if context matches, this bucket gets priority
  contextMatch?: string[];
  // Priority within same-context matching (higher = more specific)
  priority: number;
}

const PATTERNS: BucketPattern[] = [
  // ===== Personal identity =====
  {
    bucket: SemanticBucket.PERSON_NAME,
    keywords: ["姓名", "名字", "全名", "中文名", "英文名", "name", "full name", "姓名(中文)", "中文姓名", "姓名(英文)"],
    exclude: ["家庭成员", "紧急联系", "联系人", "推荐人", "项目", "project", "family", "emergency", "reference"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.SURNAME,
    keywords: ["姓", "姓氏", "surname", "last name", "family name"],
    exclude: ["百姓"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.GIVEN_NAME,
    keywords: ["名", "given name", "first name"],
    exclude: ["百姓", "项目名", "公司名", "名称"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.PHONE,
    keywords: ["手机", "电话", "手机号", "电话号", "联系电话", "联系手机", "phone", "mobile", "cell", "tel", "telephone", "联系方式", "手机号码", "电话号码"],
    exclude: ["紧急联系电话", "emergency"],
    controlTypes: ["input", "tel"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.EMAIL,
    keywords: ["邮箱", "邮件", "电子邮箱", "email", "e-mail", "mail", "电子邮件", "信箱"],
    exclude: ["企业邮箱", "公司邮箱"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.ID_NUMBER,
    keywords: ["身份证", "身份证号", "证件号", "id number", "id card", "national id", "身份证号码", "证件号码", "公民身份号码"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.GENDER,
    keywords: ["性别", "gender", "sex"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.BIRTH_DATE,
    keywords: ["出生日期", "出生年月", "生日", "出生", "birth", "dob", "birthday", "date of birth", "出生年月日"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.AGE,
    keywords: ["年龄", "周岁", "age"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.NATIONALITY,
    keywords: ["国籍", "nationality", "citizenship"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.ETHNICITY,
    keywords: ["民族", "ethnicity", "ethnic", "race"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.NATIVE_PLACE,
    keywords: ["籍贯", "native place", "origin"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.HOMETOWN,
    keywords: ["家乡", "出生地", "hometown"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.HOUSEHOLD,
    keywords: ["户籍", "户口", "户别", "household", "户籍所在地", "户籍类型", "户口所在地", "户口性质"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.POLITICAL_STATUS,
    keywords: ["政治面貌", "政治", "political", "党派", "党员", "团员", "party"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.MARITAL_STATUS,
    keywords: ["婚姻", "marital", "marriage", "婚姻状况", "婚否", "已婚", "未婚"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.BLOOD_TYPE,
    keywords: ["血型", "blood type", "blood"],
    exclude: ["血压"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.HEIGHT,
    keywords: ["身高", "height"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.WEIGHT,
    keywords: ["体重", "weight"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.RELIGION,
    keywords: ["宗教", "信仰", "religion"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.HEALTH_STATUS,
    keywords: ["健康", "health", "健康状况", "健康状态"],
    exclude: ["心理健康"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.DISABILITY_STATUS,
    keywords: ["残疾", "disability", "残障"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.DRIVING_LICENSE,
    keywords: ["驾照", "驾驶证", "driving license", "driver license", "驾照类型"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.HOBBIES,
    keywords: ["爱好", "兴趣", "hobby", "hobbies", "特长", "兴趣爱好"],
    priority: 70,
  },

  // ===== Address =====
  {
    bucket: SemanticBucket.ADDRESS,
    keywords: ["地址", "通讯地址", "现住址", "address", "居住地址", "家庭地址", "联系地址", "所在地"],
    exclude: ["邮箱", "email"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.CITY,
    keywords: ["城市", "所在城市", "市", "city"],
    exclude: ["省市", "省市区", "籍贯"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.PROVINCE,
    keywords: ["省份", "省", "province", "state", "自治区"],
    exclude: ["省市", "省市区"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.DISTRICT,
    keywords: ["区", "区域", "district", "region", "县"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.POSTAL_CODE,
    keywords: ["邮编", "邮政编码", "zip", "postal", "postcode"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.STREET_ADDRESS,
    keywords: ["详细地址", "街道", "street", "门牌号", "小区"],
    priority: 90,
  },

  // ===== Education =====
  {
    bucket: SemanticBucket.SCHOOL_NAME,
    keywords: ["学校", "院校", "毕业院校", "school", "university", "college", "institution", "就读学校", "毕业学校", "所在院校", "高校"],
    contextMatch: ["education"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.MAJOR,
    keywords: ["专业", "major", "specialty", "specialization", "所学专业", "就读专业"],
    contextMatch: ["education"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.DEGREE,
    keywords: ["学位", "degree", "bachelor", "master", "doctor", "phd", "学士", "硕士", "博士", "学历学位", "授予学位"],
    contextMatch: ["education"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.EDUCATION_LEVEL,
    keywords: ["学历", "学历层次", "文化程度", "education level", "education background", "最高学历", "学历类型", "教育程度"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.GPA,
    keywords: ["gpa", "绩点", "平均分", "grade point", "平均绩点", "成绩", "加权平均"],
    contextMatch: ["education"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.GRADUATION_DATE,
    keywords: ["毕业时间", "毕业日期", "graduation", "毕业年月", "预计毕业", "毕业年份", "离校时间"],
    contextMatch: ["education"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.EDUCATION_DATE_RANGE,
    keywords: ["教育时间", "在校时间", "就读时间", "education period", "education duration", "学习起止", "在校期间", "起止时间", "时间段", "开始", "结束"],
    contextMatch: ["education"],
    mustContainAll: [],
    priority: 85,
  },
  {
    bucket: SemanticBucket.EDUCATION_DESCRIPTION,
    keywords: ["教育描述", "学习描述", "在校经历", "education description", "学习内容"],
    contextMatch: ["education"],
    priority: 70,
  },

  // ===== Work =====
  {
    bucket: SemanticBucket.COMPANY_NAME,
    keywords: ["公司", "公司名", "单位", "企业", "company", "employer", "organization", "corporation", "工作单位", "所在单位", "企业名称", "公司名称", "雇主"],
    exclude: ["家庭成员", "family", "推荐人", "reference", "实习"],
    contextMatch: ["work"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.JOB_TITLE,
    keywords: ["职位", "职务", "岗位", "job title", "title", "position", "担任职务", "现任职位", "职位名称", "岗位名称", "角色", "职称"],
    exclude: ["家庭成员", "family", "推荐人", "reference", "实习", "project role"],
    contextMatch: ["work"],
    priority: 100,
  },
  {
    bucket: SemanticBucket.WORK_DATE_RANGE,
    keywords: ["工作起止", "工作时间", "work duration", "work period", "在职时间", "开始时间", "结束时间", "入职时间", "离职时间", "起止时间", "时间段"],
    contextMatch: ["work"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.WORK_DESCRIPTION,
    keywords: ["工作描述", "工作内容", "job description", "responsibilities", "主要职责", "工作职责", "工作业绩", "工作概述"],
    contextMatch: ["work"],
    priority: 75,
  },
  {
    bucket: SemanticBucket.WORK_INDUSTRY,
    keywords: ["行业", "industry", "所属行业", "工作行业"],
    contextMatch: ["work"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.WORK_DEPARTMENT,
    keywords: ["部门", "department", "所在部门", "工作部门"],
    contextMatch: ["work"],
    priority: 80,
  },

  // ===== Internship =====
  {
    bucket: SemanticBucket.INTERNSHIP_COMPANY,
    keywords: ["实习公司", "实习单位", "internship company", "实习企业"],
    contextMatch: ["internship"],
    priority: 95,
  },
  {
    bucket: SemanticBucket.INTERNSHIP_TITLE,
    keywords: ["实习职位", "实习岗位", "internship title", "internship position", "实习角色"],
    contextMatch: ["internship"],
    priority: 95,
  },
  {
    bucket: SemanticBucket.INTERNSHIP_DATE_RANGE,
    keywords: ["实习时间", "internship period", "internship duration", "实习起止"],
    contextMatch: ["internship"],
    priority: 90,
  },

  // ===== Project =====
  {
    bucket: SemanticBucket.PROJECT_NAME,
    keywords: ["项目", "项目名称", "project", "project name", "课题"],
    exclude: ["家庭成员", "推荐人"],
    contextMatch: ["project"],
    priority: 95,
  },
  {
    bucket: SemanticBucket.PROJECT_ROLE,
    keywords: ["项目角色", "担任角色", "project role", "role in project", "本人角色", "负责内容"],
    contextMatch: ["project"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.PROJECT_DATE_RANGE,
    keywords: ["项目时间", "project period", "project duration", "项目起止", "项目开始", "项目结束"],
    contextMatch: ["project"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.PROJECT_DESCRIPTION,
    keywords: ["项目描述", "project description", "项目简介", "项目成果", "项目内容"],
    contextMatch: ["project"],
    priority: 75,
  },

  // ===== Skills & Certifications =====
  {
    bucket: SemanticBucket.SKILL,
    keywords: ["技能", "skill", "专业技能", "技术栈", "个人技能", "掌握技能", "技能特长", "专业能力", "职业能力"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.LANGUAGE,
    keywords: ["语言", "外语", "language", "语言能力", "外语水平", "语种", "外语能力", "英语水平"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.CERTIFICATE,
    keywords: ["证书", "资格证书", "certificate", "certification", "资格证", "执业资格", "认证", "职业证书"],
    exclude: ["语言证书", "language cert"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.AWARD_NAME,
    keywords: ["获奖", "奖项", "award", "prize", "荣誉", "获奖名称", "奖励", "荣誉称号", "获奖情况"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.AWARD_DATE,
    keywords: ["获奖时间", "award date", "获奖日期", "颁奖时间"],
    contextMatch: ["award"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.TRAINING_EXPERIENCE,
    keywords: ["培训", "培训经历", "training", "培训课程", "进修"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.PROFESSIONAL_TITLE,
    keywords: ["专业职称", "技术职称", "professional title", "职称等级"],
    priority: 80,
  },

  // ===== Social & Contact =====
  {
    bucket: SemanticBucket.SOCIAL_URL,
    keywords: ["社交", "社交链接", "social", "个人主页"],
    exclude: ["linkedin", "github"],
    priority: 75,
  },
  {
    bucket: SemanticBucket.LINKEDIN_URL,
    keywords: ["linkedin", "linked in", "领英"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.GITHUB_URL,
    keywords: ["github", "git hub"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.WEBSITE,
    keywords: ["个人网站", "网站", "website", "主页"],
    exclude: ["linkedin", "github"],
    priority: 75,
  },
  {
    bucket: SemanticBucket.PORTFOLIO_URL,
    keywords: ["作品链接", "portfolio", "作品集", "作品"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.QQ,
    keywords: ["qq", "QQ号", "qq号码"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.WECHAT,
    keywords: ["微信", "wechat", "weixin", "微信号"],
    priority: 85,
  },

  // ===== Description & Introduction =====
  {
    bucket: SemanticBucket.SELF_INTRODUCTION,
    keywords: ["自我介绍", "self intro", "introduction", "about me", "个人介绍", "自我评价", "个人简介", "个人总结", "自我描述"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.DESCRIPTION,
    keywords: ["描述", "简介", "description", "summary", "概述", "备注", "补充说明", "其他说明"],
    priority: 60,
  },

  // ===== Family =====
  {
    bucket: SemanticBucket.FAMILY_MEMBER_NAME,
    keywords: ["家庭成员姓名", "family member name", "家人姓名", "亲属姓名", "联系人姓名"],
    contextMatch: ["family"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.FAMILY_RELATION,
    keywords: ["与本人关系", "家庭成员关系", "family relation", "亲属关系"],
    contextMatch: ["family"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.FAMILY_PHONE,
    keywords: ["家庭成员电话", "family phone", "亲属电话", "联系人电话"],
    contextMatch: ["family"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.FAMILY_COMPANY,
    keywords: ["家庭成员单位", "family company", "亲属单位", "联系人单位"],
    contextMatch: ["family"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.FAMILY_POSITION,
    keywords: ["家庭成员职务", "family position", "亲属职务", "联系人职务"],
    contextMatch: ["family"],
    priority: 85,
  },

  // ===== Emergency Contact =====
  {
    bucket: SemanticBucket.EMERGENCY_CONTACT,
    keywords: ["紧急联系人", "emergency contact", "紧急联系人姓名"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.EMERGENCY_PHONE,
    keywords: ["紧急联系电话", "emergency phone", "紧急电话"],
    priority: 90,
  },

  // ===== Reference =====
  {
    bucket: SemanticBucket.REFERENCE_NAME,
    keywords: ["推荐人", "reference", "referrer", "证明人", "介绍人"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.REFERENCE_PHONE,
    keywords: ["推荐人电话", "reference phone", "证明人电话"],
    priority: 80,
  },
  {
    bucket: SemanticBucket.REFERENCE_COMPANY,
    keywords: ["推荐人单位", "reference company", "证明人单位"],
    priority: 80,
  },

  // ===== Salary =====
  {
    bucket: SemanticBucket.SALARY,
    keywords: ["薪资", "工资", "salary", "wage", "收入", "薪酬"],
    exclude: ["期望", "expected", "目前", "current", "现有"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.EXPECTED_SALARY,
    keywords: ["期望薪资", "expected salary", "期望薪酬", "薪资要求", "期望待遇", "期望收入", "薪资期望", "要求薪资", "待遇要求"],
    priority: 90,
  },
  {
    bucket: SemanticBucket.CURRENT_SALARY,
    keywords: ["目前薪资", "当前薪资", "current salary", "现有薪资", "现在薪资", "目前收入"],
    priority: 90,
  },

  // ===== Job preferences =====
  {
    bucket: SemanticBucket.JOB_TYPE,
    keywords: ["工作类型", "job type", "全职", "兼职", "实习", "full-time", "part-time", "工作性质", "用工形式"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.WORK_LOCATION,
    keywords: ["工作地点", "工作地", "work location", "工作城市", "就职地点", "办公地点"],
    exclude: ["期望", "expected", "意向"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.AVAILABLE_DATE,
    keywords: ["到岗时间", "available date", "入职时间", "可到岗", "上岗时间", "报到时间", "最快到岗"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.CURRENT_STATUS,
    keywords: ["目前状态", "求职状态", "current status", "在职状态", "就业状态", "工作状态", "就职状态"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.EXPECTED_CITY,
    keywords: ["期望城市", "expected city", "意向城市", "目标城市", "期望工作城市"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.EXPECTED_INDUSTRY,
    keywords: ["期望行业", "expected industry", "意向行业", "目标行业"],
    priority: 85,
  },
  {
    bucket: SemanticBucket.EXPECTED_POSITION,
    keywords: ["期望职位", "expected position", "意向职位", "目标职位", "求职意向", "应聘职位", "应聘岗位"],
    priority: 85,
  },

  // ===== Fallback =====
  {
    bucket: SemanticBucket.CUSTOM,
    keywords: [],
    priority: 0,
  },
];

// ===== Normalization helper =====

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[\s*★●◆▸►■:\-：\-（）()【】\[\]<>《》"'""''、，。,\.·•|\\/]+/g, "")
    .replace(/^(请输入|请选择|请填写|上传文件|点击选择|请确认|请提供)\s*/g, "")
    .trim();
}

// ===== Public API =====

export function classifyFieldBucket(label: string, controlType: string, context: string): SemanticBucket {
  const normalized = normalizeLabel(label);
  if (!normalized || normalized.length < 1) return SemanticBucket.CUSTOM;

  const ctx = (context ?? "").toLowerCase();
  let bestMatch: { bucket: SemanticBucket; priority: number } = { bucket: SemanticBucket.CUSTOM, priority: 0 };

  for (const pattern of PATTERNS) {
    // Control type restriction
    if (pattern.controlTypes && pattern.controlTypes.length > 0) {
      const ctLower = controlType.toLowerCase();
      if (!pattern.controlTypes.some((ct) => ctLower === ct || ctLower.includes(ct))) {
        continue;
      }
    }

    // Exclusion check
    if (pattern.exclude && pattern.exclude.length > 0) {
      if (pattern.exclude.some((ex) => normalized.includes(normalizeLabel(ex)))) {
        continue;
      }
    }

    // Keyword match (OR mode — at least one keyword must be present)
    let keywordMatched = pattern.keywords.length === 0; // Empty keywords means catch-all
    if (!keywordMatched) {
      keywordMatched = pattern.keywords.some((kw) => {
        const kwNorm = normalizeLabel(kw);
        if (!kwNorm) return false;
        return normalized.includes(kwNorm) || normalized === kwNorm;
      });
    }

    if (!keywordMatched) continue;

    // ALL-match constraint
    if (pattern.mustContainAll && pattern.mustContainAll.length > 0) {
      const allMatch = pattern.mustContainAll.every((m) => normalized.includes(normalizeLabel(m)));
      if (!allMatch) continue;
    }

    // Context bonus — multiply priority by 1.5 if context matches
    let effectivePriority = pattern.priority;
    if (pattern.contextMatch && pattern.contextMatch.length > 0 && ctx) {
      if (pattern.contextMatch.some((cm) => ctx.includes(cm.toLowerCase()))) {
        effectivePriority = Math.round(pattern.priority * 1.5);
      }
    }

    if (effectivePriority > bestMatch.priority) {
      bestMatch = { bucket: pattern.bucket, priority: effectivePriority };
    }
  }

  return bestMatch.bucket;
}

export function getEligibleIntents(bucket: SemanticBucket): string[] {
  return BUCKET_TO_INTENTS[bucket] ?? [];
}

export function isBucketCompatible(intent: string, bucket: SemanticBucket): boolean {
  const eligible = getEligibleIntents(bucket);
  if (eligible.length === 0) return true; // No restriction means compatible
  return eligible.some((ei) => intent === ei || intent.startsWith(ei) || ei.startsWith(intent));
}

// ===== Bucket-to-Intent mapping =====

const BUCKET_TO_INTENTS: Record<SemanticBucket, string[]> = {
  [SemanticBucket.PERSON_NAME]: ["basic_name"],
  [SemanticBucket.SURNAME]: ["basic_surname"],
  [SemanticBucket.GIVEN_NAME]: ["basic_givenName"],
  [SemanticBucket.PHONE]: ["basic_phone", "family_phone", "emergency_phone", "reference_phone"],
  [SemanticBucket.EMAIL]: ["basic_email"],
  [SemanticBucket.ADDRESS]: ["basic_address"],
  [SemanticBucket.CITY]: ["basic_city", "expected_city", "work_location"],
  [SemanticBucket.PROVINCE]: ["basic_province"],
  [SemanticBucket.DISTRICT]: ["basic_district"],
  [SemanticBucket.POSTAL_CODE]: ["basic_postalCode"],
  [SemanticBucket.STREET_ADDRESS]: ["basic_streetAddress"],
  [SemanticBucket.BIRTH_DATE]: ["basic_birthDate"],
  [SemanticBucket.AGE]: ["basic_age"],
  [SemanticBucket.GENDER]: ["basic_gender"],
  [SemanticBucket.ID_NUMBER]: ["basic_idNumber"],
  [SemanticBucket.SCHOOL_NAME]: ["education_schoolName"],
  [SemanticBucket.MAJOR]: ["education_major"],
  [SemanticBucket.DEGREE]: ["education_degree"],
  [SemanticBucket.EDUCATION_LEVEL]: ["education_educationLevel", "basic_educationLevel"],
  [SemanticBucket.GPA]: ["education_gpa"],
  [SemanticBucket.GRADUATION_DATE]: ["education_graduationDate"],
  [SemanticBucket.EDUCATION_DATE_RANGE]: ["education_startDate", "education_endDate", "education_dateRange"],
  [SemanticBucket.EDUCATION_DESCRIPTION]: ["education_description"],
  [SemanticBucket.COMPANY_NAME]: ["work_companyName"],
  [SemanticBucket.JOB_TITLE]: ["work_jobTitle"],
  [SemanticBucket.WORK_DATE_RANGE]: ["work_startDate", "work_endDate", "work_dateRange"],
  [SemanticBucket.WORK_DESCRIPTION]: ["work_description"],
  [SemanticBucket.WORK_INDUSTRY]: ["work_industry"],
  [SemanticBucket.WORK_DEPARTMENT]: ["work_department"],
  [SemanticBucket.INTERNSHIP_COMPANY]: ["internship_companyName"],
  [SemanticBucket.INTERNSHIP_TITLE]: ["internship_jobTitle"],
  [SemanticBucket.INTERNSHIP_DATE_RANGE]: ["internship_startDate", "internship_endDate"],
  [SemanticBucket.PROJECT_NAME]: ["project_projectName"],
  [SemanticBucket.PROJECT_ROLE]: ["project_role"],
  [SemanticBucket.PROJECT_DATE_RANGE]: ["project_startDate", "project_endDate"],
  [SemanticBucket.PROJECT_DESCRIPTION]: ["project_description"],
  [SemanticBucket.SKILL]: ["skill_list", "skill_name"],
  [SemanticBucket.LANGUAGE]: ["language_name", "language_proficiency"],
  [SemanticBucket.CERTIFICATE]: ["certificate_name"],
  [SemanticBucket.AWARD_NAME]: ["award_awardName"],
  [SemanticBucket.AWARD_DATE]: ["award_date"],
  [SemanticBucket.SOCIAL_URL]: ["basic_socialUrl"],
  [SemanticBucket.LINKEDIN_URL]: ["basic_linkedinUrl"],
  [SemanticBucket.GITHUB_URL]: ["basic_githubUrl"],
  [SemanticBucket.WEBSITE]: ["basic_website"],
  [SemanticBucket.PORTFOLIO_URL]: ["basic_portfolioUrl"],
  [SemanticBucket.DESCRIPTION]: ["basic_selfIntro", "work_description", "education_description"],
  [SemanticBucket.SELF_INTRODUCTION]: ["basic_selfIntro"],
  [SemanticBucket.FAMILY_MEMBER_NAME]: ["family_name"],
  [SemanticBucket.FAMILY_RELATION]: ["family_relation"],
  [SemanticBucket.FAMILY_PHONE]: ["family_phone"],
  [SemanticBucket.FAMILY_COMPANY]: ["family_company"],
  [SemanticBucket.FAMILY_POSITION]: ["family_position"],
  [SemanticBucket.NATIVE_PLACE]: ["basic_nativePlace"],
  [SemanticBucket.HOUSEHOLD]: ["basic_household"],
  [SemanticBucket.POLITICAL_STATUS]: ["basic_politicalStatus"],
  [SemanticBucket.MARITAL_STATUS]: ["basic_maritalStatus"],
  [SemanticBucket.NATIONALITY]: ["basic_nationality"],
  [SemanticBucket.ETHNICITY]: ["basic_ethnicity"],
  [SemanticBucket.BLOOD_TYPE]: ["basic_bloodType"],
  [SemanticBucket.HEIGHT]: ["basic_height"],
  [SemanticBucket.WEIGHT]: ["basic_weight"],
  [SemanticBucket.SALARY]: ["basic_salary"],
  [SemanticBucket.EXPECTED_SALARY]: ["basic_expectedSalary"],
  [SemanticBucket.CURRENT_SALARY]: ["basic_currentSalary"],
  [SemanticBucket.JOB_TYPE]: ["basic_jobType"],
  [SemanticBucket.WORK_LOCATION]: ["work_location"],
  [SemanticBucket.AVAILABLE_DATE]: ["basic_availableDate"],
  [SemanticBucket.CURRENT_STATUS]: ["basic_currentStatus"],
  [SemanticBucket.QQ]: ["basic_qq"],
  [SemanticBucket.WECHAT]: ["basic_wechat"],
  [SemanticBucket.EXPECTED_CITY]: ["expected_city"],
  [SemanticBucket.EXPECTED_INDUSTRY]: ["expected_industry"],
  [SemanticBucket.EXPECTED_POSITION]: ["expected_position"],
  [SemanticBucket.TRAINING_EXPERIENCE]: ["training_name"],
  [SemanticBucket.PROFESSIONAL_TITLE]: ["basic_professionalTitle"],
  [SemanticBucket.HOMETOWN]: ["basic_nativePlace"],
  [SemanticBucket.RELIGION]: ["basic_religion"],
  [SemanticBucket.HEALTH_STATUS]: ["basic_healthStatus"],
  [SemanticBucket.DISABILITY_STATUS]: ["basic_disabilityStatus"],
  [SemanticBucket.DRIVING_LICENSE]: ["basic_drivingLicense"],
  [SemanticBucket.HOBBIES]: ["basic_hobbies"],
  [SemanticBucket.EMERGENCY_CONTACT]: ["basic_emergencyContact"],
  [SemanticBucket.EMERGENCY_PHONE]: ["basic_emergencyPhone"],
  [SemanticBucket.REFERENCE_NAME]: ["reference_name"],
  [SemanticBucket.REFERENCE_PHONE]: ["reference_phone"],
  [SemanticBucket.REFERENCE_COMPANY]: ["reference_company"],
  [SemanticBucket.CUSTOM]: [],
};

// ===== Internals for testing =====

export const __SemanticBucketsInternals = {
  normalizeLabel,
  PATTERNS,
  BUCKET_TO_INTENTS,
};
