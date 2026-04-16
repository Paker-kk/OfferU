// =============================================
// OfferU Extension — 共享类型定义
// =============================================

/** 从 DOM 中提取的单个岗位数据 */
export interface ExtractedJob {
  title: string;
  company: string;
  location: string;
  salary_text: string;
  salary_min: number | null;
  salary_max: number | null;
  raw_description: string;
  url: string;
  source: string;
  education: string;
  experience: string;
  job_type: string;
  company_size: string;
  company_industry: string;
  hash_key: string;
}

/** 插件设置 */
export interface ExtensionSettings {
  serverUrl: string; // OfferU 后端地址，默认 http://localhost:8000
}

/** 消息类型：content script ↔ background */
export type Message =
  | { type: "JOBS_COLLECTED"; jobs: ExtractedJob[] }
  | { type: "SYNC_TO_SERVER" }
  | { type: "GET_STATUS" }
  | { type: "CLEAR_JOBS" }
  | { type: "STATUS"; count: number; lastSync: string | null };

/** 后端 /api/jobs/ingest 请求体 */
export interface IngestPayload {
  jobs: ExtractedJob[];
  source: string;
  batch_id: string;
}
