// =============================================
// OfferU Extension — 共享类型定义
// =============================================

export type JobSource = "boss" | "liepin" | "zhaopin" | "shixiseng" | "linkedin" | "unknown";

export type JobStatus = "draft_pending_jd" | "ready_to_sync";

/** 从 DOM 中提取的单个岗位数据（插件本地结构） */
export interface ExtractedJob {
  version?: number;
  title: string;
  company: string;
  location: string;
  salary_text: string;
  salary_min: number | null;
  salary_max: number | null;
  raw_description: string;
  posted_at?: string | null;
  url: string;
  apply_url: string;
  source: JobSource;
  source_page_meta: string; // JSON 字符串，记录页面来源与采集上下文
  education: string;
  experience: string;
  job_type: string;
  company_size: string;
  company_industry: string;
  hash_key: string;
  status: JobStatus;
  created_at: string;
}

/** 插件设置 */
export interface ExtensionSettings {
  serverUrl: string; // OfferU 后端地址，默认 http://127.0.0.1:8000
}

export interface StatusResponse {
  total: number;
  ready: number;
  draft: number;
  serverUrl: string;
}

export interface MergeResponse {
  added: number;
  upgraded: number;
  skipped: number;
}

export interface SyncResponse {
  ok: boolean;
  synced: number;
  skippedDraft: number;
  error?: string;
}

export interface RemoveResponse {
  ok: boolean;
  removed: number;
  remaining: number;
}

export interface ClipboardCopyResponse {
  ok: boolean;
  error?: string;
}

export interface ResumeListItem {
  id: number;
  user_name: string;
  title: string;
  photo_url?: string | null;
  source_mode?: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeDetailSection {
  section_type: string;
  title: string;
  visible: boolean;
  content_json: Array<Record<string, unknown>>;
}

export interface ResumeDetail {
  id: number;
  user_name: string;
  title: string;
  summary: string;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
  sections: ResumeDetailSection[];
}

/** 消息类型：content script ↔ background */
export type Message =
  | { type: "JOBS_COLLECTED"; jobs: ExtractedJob[] }
  | { type: "SYNC_TO_SERVER" }
  | { type: "GET_STATUS" }
  | { type: "GET_JOBS" }
  | { type: "COPY_IMAGE_TO_CLIPBOARD"; imageUrl: string }
  | { type: "OFFSCREEN_WRITE_IMAGE"; requestId: string; imageUrl: string }
  | { type: "OFFSCREEN_WRITE_IMAGE_RESULT"; requestId: string; ok: boolean; error?: string }
  | { type: "OPEN_DRAWER"; tab?: "cart" | "resumes" | "settings" }
  | { type: "REMOVE_JOB"; hashKey: string }
  | { type: "REMOVE_JOBS"; hashKeys: string[] }
  | { type: "CLEAR_JOBS" };

/** 后端 /api/jobs/ingest 单条岗位结构 */
export interface IngestJobPayload {
  title: string;
  company: string;
  location: string;
  url: string;
  apply_url: string;
  source: string;
  raw_description: string;
  posted_at?: string | null;
  hash_key: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_text: string;
  education: string;
  experience: string;
  job_type: string;
  company_size: string;
  company_industry: string;
}

/** 后端 /api/jobs/ingest 请求体 */
export interface IngestPayload {
  jobs: IngestJobPayload[];
  source: string;
  batch_id: string;
}
