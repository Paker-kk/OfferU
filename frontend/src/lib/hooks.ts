// =============================================
// SWR 数据请求 Hooks — OfferU 前端统一数据获取层
// =============================================
// 封装 SWR + API 客户端，提供类型安全的 React Hooks
// 所有页面组件通过这些 hooks 获取后端数据
// 自动缓存、重验证、错误处理
// =============================================

import useSWR from "swr";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * 通用 fetcher：SWR 默认请求函数
 * 自动处理 JSON 解析和错误码
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
};

// ---- 类型定义 ----

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  posted_at: string | null;
  summary: string;
  keywords: string[];
  created_at: string;
}

export interface JobsListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Job[];
}

export interface JobStats {
  period: string;
  total_jobs: number;
  source_distribution: Record<string, number>;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  event_type: string;
  start_time: string;
  end_time: string | null;
  location: string;
  related_job_id: number | null;
  related_notification_id: number | null;
}

export interface Notification {
  id: number;
  email_subject: string;
  email_from: string;
  company: string;
  position: string;
  interview_time: string | null;
  location: string;
  parsed_at: string;
}

// ---- Hooks ----

/**
 * 获取岗位列表
 * @param page 页码
 * @param period 时间范围: today / week / month
 * @param source 数据源筛选
 */
export function useJobs(page = 1, period = "week", source?: string) {
  const params = new URLSearchParams({
    page: String(page),
    period,
    ...(source ? { source } : {}),
  });
  return useSWR<JobsListResponse>(
    `${API_BASE}/api/jobs/?${params}`,
    fetcher
  );
}

/** 获取单个岗位详情 */
export function useJob(id: number | null) {
  return useSWR<Job>(
    id ? `${API_BASE}/api/jobs/${id}` : null,
    fetcher
  );
}

/** 获取岗位统计数据 */
export function useJobStats(period = "week") {
  return useSWR<JobStats>(
    `${API_BASE}/api/jobs/stats?period=${period}`,
    fetcher
  );
}

/** 获取每日趋势数据 */
export interface TrendPoint { date: string; count: number; }
export function useJobTrend(period = "week") {
  return useSWR<TrendPoint[]>(
    `${API_BASE}/api/jobs/trend?period=${period}`,
    fetcher
  );
}

/** 获取周报分析数据 */
export interface WeeklyReport {
  this_week: { total: number };
  last_week: { total: number };
  source_distribution: { name: string; value: number }[];
  top_keywords: { keyword: string; count: number }[];
}
export function useWeeklyReport() {
  return useSWR<WeeklyReport>(`${API_BASE}/api/jobs/weekly-report`, fetcher);
}

/** 获取日历事件 */
export function useCalendarEvents(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return useSWR<CalendarEvent[]>(
    `${API_BASE}/api/calendar/events?${params}`,
    fetcher
  );
}

/** 获取面试通知列表 */
export function useNotifications() {
  return useSWR<Notification[]>(
    `${API_BASE}/api/email/notifications`,
    fetcher
  );
}

/** 获取系统配置 */
export function useConfig() {
  return useSWR(
    `${API_BASE}/api/config/`,
    fetcher
  );
}

// ---- 写操作（非 SWR，直接 fetch） ----

/** 更新系统配置 */
export async function updateConfig(data: any) {
  const res = await fetch(`${API_BASE}/api/config/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 创建日历事件 */
export async function createCalendarEvent(data: any) {
  const res = await fetch(`${API_BASE}/api/calendar/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 触发邮件同步 */
export async function syncEmails() {
  const res = await fetch(`${API_BASE}/api/email/sync`, { method: "POST" });
  return res.json();
}

/** 获取 Gmail 授权链接 */
export async function getEmailAuthUrl(): Promise<{ auth_url?: string; message?: string }> {
  const res = await fetch(`${API_BASE}/api/email/auth-url`);
  return res.json();
}

/** 获取邮箱授权状态 */
export interface EmailStatus { connected: boolean; has_refresh: boolean; }
export function useEmailStatus() {
  return useSWR<EmailStatus>(`${API_BASE}/api/email/status`, fetcher);
}

/** 创建简历 */
export async function createResume(data: any) {
  const res = await fetch(`${API_BASE}/api/resume/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 更新简历主信息 */
export async function updateResume(id: number, data: any) {
  const res = await fetch(`${API_BASE}/api/resume/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 删除简历 */
export async function deleteResume(id: number) {
  const res = await fetch(`${API_BASE}/api/resume/${id}`, { method: "DELETE" });
  return res.json();
}

/** 获取简历列表 */
export function useResumes() {
  return useSWR(`${API_BASE}/api/resume/`, fetcher);
}

/** 获取完整简历详情（含段落） */
export function useResume(id: number | null) {
  return useSWR(id ? `${API_BASE}/api/resume/${id}` : null, fetcher);
}

/** 更新段落 */
export async function updateSection(resumeId: number, sectionId: number, data: any) {
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/sections/${sectionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 创建段落 */
export async function createSection(resumeId: number, data: any) {
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 删除段落 */
export async function deleteSection(resumeId: number, sectionId: number) {
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/sections/${sectionId}`, {
    method: "DELETE",
  });
  return res.json();
}

// ---- AI 简历优化 ----

/** AI 优化类型定义 */
export interface AiSuggestion {
  type: "bullet_rewrite" | "keyword_add" | "section_reorder";
  section_title?: string;
  item_label?: string;
  original: any;
  suggested: any;
  reason: string;
  // 前端追加的状态
  accepted?: boolean;
}

export interface AiOptimizeResult {
  keyword_match: {
    matched: string[];
    missing: string[];
    score: number;
  };
  suggestions: AiSuggestion[];
  summary: string;
}

/** AI 优化简历（基于已有简历 ID） */
export async function aiOptimizeResume(
  resumeId: number,
  data: { jd_text?: string; job_id?: number }
): Promise<AiOptimizeResult> {
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/ai/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `AI 优化失败 (${res.status})`);
  }
  return res.json();
}

/** AI 优化简历（纯文本粘贴） */
export async function aiOptimizeText(
  data: { resume_text: string; jd_text: string }
): Promise<AiOptimizeResult> {
  const res = await fetch(`${API_BASE}/api/resume/ai/optimize-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `AI 优化失败 (${res.status})`);
  }
  return res.json();
}

/** 应用单条 AI 建议到简历 */
export async function aiApplySuggestion(
  resumeId: number,
  suggestion: any
) {
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/ai/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(suggestion),
  });
  return res.json();
}

/** 上传 PDF/Word 简历文件并解析为文本 */
export async function parseResumeFile(file: File): Promise<{ filename: string; text: string; length: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/resume/parse`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `文件解析失败 (${res.status})`);
  }
  return res.json();
}

/** 段落排序 */
export async function reorderSections(resumeId: number, items: { id: number; sort_order: number }[]) {
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/sections/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return res.json();
}

/** 上传头像 */
export async function uploadResumePhoto(resumeId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/photo`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export interface ResumeTemplate {
  id: number;
  name: string;
  thumbnail_url: string;
  css_variables: Record<string, string>;
  is_builtin: boolean;
}

/** 获取模板列表 */
export function useResumeTemplates() {
  return useSWR<ResumeTemplate[]>(`${API_BASE}/api/resume/templates`, fetcher);
}

// ---- AI Skill Pipeline 深度分析 ----

/** JD 分析结果（Skill 1 输出） */
export interface JdAnalysis {
  job_title: string;
  company: string;
  is_campus: boolean;
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  experience_level: string;
  industry_tags: string[];
  culture_keywords: string[];
}

/** 段落评分明细 */
export interface SectionScore {
  section: string;
  score: number;
  feedback: string;
}

/** 匹配分析结果（Skill 2 输出） */
export interface MatchAnalysis {
  ats_score: number;
  matched_skills: string[];
  missing_skills: string[];
  section_scores: SectionScore[];
  risk_items: string[];
  summary: string;
}

/** Pipeline 聚合结果 */
export interface SkillAnalyzeResult {
  jd_analysis: JdAnalysis;
  match_analysis: MatchAnalysis;
  content_rewrite?: ContentRewriteResult;
  section_reorder?: SectionReorderResult;
}

/** 内容改写建议（Skill 3 输出） */
export interface RewriteSuggestion {
  type: "rewrite" | "inject";
  section_title: string;
  item_label: string;
  original: string;
  suggested: string;
  reason: string;
  injected_keywords: string[];
}

export interface ContentRewriteResult {
  suggestions: RewriteSuggestion[];
}

/** 模块重排建议（Skill 4 输出） */
export interface ReorderChange {
  section: string;
  action: "move_up" | "move_down" | "keep";
  reason: string;
}

export interface SectionReorderResult {
  current_order: string[];
  suggested_order: string[];
  reason: string;
  changes: ReorderChange[];
  error?: string;
}

/** Skill Pipeline 深度分析（基于已有简历 ID） */
export async function aiAnalyzeResume(
  resumeId: number,
  data: { jd_text?: string; job_id?: number }
): Promise<SkillAnalyzeResult> {
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/ai/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `AI 分析失败 (${res.status})`);
  }
  return res.json();
}

/** Skill Pipeline 深度分析（纯文本粘贴） */
export async function aiAnalyzeText(
  data: { resume_text: string; jd_text: string }
): Promise<SkillAnalyzeResult> {
  const res = await fetch(`${API_BASE}/api/resume/ai/analyze-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `AI 分析失败 (${res.status})`);
  }
  return res.json();
}

// ---- 投递管理 ----

export interface ApplicationItem {
  id: number;
  job_id: number;
  job_title: string;
  job_company: string;
  status: string;
  cover_letter: string;
  apply_url: string;
  notes: string;
  submitted_at: string | null;
  created_at: string;
}

export interface ApplicationsResponse {
  total: number;
  page: number;
  page_size: number;
  items: ApplicationItem[];
}

/** 获取投递记录列表 */
export function useApplications(page = 1, status?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set("status", status);
  return useSWR<ApplicationsResponse>(
    `${API_BASE}/api/applications/?${params}`, fetcher
  );
}

/** 获取投递统计 */
export function useApplicationStats() {
  return useSWR<Record<string, number>>(
    `${API_BASE}/api/applications/stats`, fetcher
  );
}

/** 创建投递记录 */
export async function createApplication(jobId: number, notes = "") {
  const res = await fetch(`${API_BASE}/api/applications/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, notes }),
  });
  return res.json();
}

/** 更新投递状态 */
export async function updateApplication(id: number, data: { status?: string; notes?: string; cover_letter?: string }) {
  const res = await fetch(`${API_BASE}/api/applications/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** AI 生成求职信 */
export async function generateCoverLetter(jobId: number, resumeId: number) {
  const res = await fetch(`${API_BASE}/api/applications/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, resume_id: resumeId }),
  });
  return res.json();
}

// ---- 简历模板 ----

/** 将模板应用到简历（覆盖 style_config） */
export async function applyTemplate(resumeId: number, templateId: number) {
  const res = await fetch(`${API_BASE}/api/resume/${resumeId}/apply-template/${templateId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Apply template failed: ${res.status}`);
  return res.json();
}
