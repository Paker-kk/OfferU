// =============================================
// API 客户端 — 统一的后端请求封装
// =============================================
// 所有前端组件通过此模块与后端通信
// 基于 fetch API，支持 SWR 缓存
// =============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function buildQuery(params?: Record<string, unknown>) {
  const sp = new URLSearchParams();
  if (!params) return sp.toString();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    sp.set(key, String(value));
  }
  return sp.toString();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ---- Jobs API ----
export const jobsApi = {
  list: (params?: {
    page?: number;
    page_size?: number;
    period?: string;
    source?: string;
    triage_status?: "inbox" | "picked" | "ignored";
    pool_id?: number | "ungrouped";
    batch_id?: string;
    keyword?: string;
    job_type?: string;
    education?: string;
    is_campus?: boolean;
  }) =>
    request(`/api/jobs/?${buildQuery(params as any)}`),
  
  get: (id: number) => request(`/api/jobs/${id}`),

  batches: (limit = 30) => request(`/api/jobs/batches?limit=${limit}`),

  patch: (
    id: number,
    data: { triage_status?: "inbox" | "picked" | "ignored"; pool_id?: number; clear_pool?: boolean }
  ) =>
    request(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  patchBatch: (data: {
    job_ids: number[];
    triage_status?: "inbox" | "picked" | "ignored";
    pool_id?: number;
    clear_pool?: boolean;
  }) =>
    request("/api/jobs/batch-update", { method: "PATCH", body: JSON.stringify(data) }),
  
  stats: (period = "week") => request(`/api/jobs/stats?period=${period}`),
};

// ---- Pools API ----
export const poolsApi = {
  list: (scope?: "inbox" | "picked" | "ignored") =>
    request(`/api/pools/?${buildQuery({ scope })}`),

  create: (data: { name: string; scope?: "inbox" | "picked" | "ignored" }) =>
    request("/api/pools/", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: { name: string }, scope?: "inbox" | "picked" | "ignored") =>
    request(`/api/pools/${id}?${buildQuery({ scope })}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: number, scope?: "inbox" | "picked" | "ignored") =>
    request(`/api/pools/${id}?${buildQuery({ scope })}`, { method: "DELETE" }),
};

// ---- Resume API ----
export const resumeApi = {
  list: () => request("/api/resume/"),

  get: (id: number) => request(`/api/resume/${id}`),

  create: (data: any) =>
    request("/api/resume/", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: any) =>
    request(`/api/resume/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: number) =>
    request(`/api/resume/${id}`, { method: "DELETE" }),

  // 段落管理
  createSection: (resumeId: number, data: any) =>
    request(`/api/resume/${resumeId}/sections`, { method: "POST", body: JSON.stringify(data) }),

  updateSection: (resumeId: number, sectionId: number, data: any) =>
    request(`/api/resume/${resumeId}/sections/${sectionId}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteSection: (resumeId: number, sectionId: number) =>
    request(`/api/resume/${resumeId}/sections/${sectionId}`, { method: "DELETE" }),

  reorderSections: (resumeId: number, items: { id: number; sort_order: number }[]) =>
    request(`/api/resume/${resumeId}/sections/reorder`, { method: "PUT", body: JSON.stringify({ items }) }),

  // 文件上传
  uploadPhoto: async (resumeId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/resume/${resumeId}/photo`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },

  // 导出
  exportPdf: (id: number) =>
    fetch(`${API_BASE}/api/resume/${id}/export/pdf`, { method: "POST" }),

  // 模板
  templates: () => request("/api/resume/templates"),
};

// ---- Calendar API ----
export const calendarApi = {
  events: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return request(`/api/calendar/events?${params}`);
  },
  
  createEvent: (data: any) =>
    request("/api/calendar/events", { method: "POST", body: JSON.stringify(data) }),
  
  autoFill: () =>
    request("/api/calendar/auto-fill", { method: "POST" }),
};

// ---- Email API ----
export const emailApi = {
  auth: () => request("/api/email/auth", { method: "POST" }),
  
  notifications: () => request("/api/email/notifications"),
  
  sync: () => request("/api/email/sync", { method: "POST" }),
};

// ---- Config API ----
export const configApi = {
  get: () => request("/api/config/"),
  
  update: (data: any) =>
    request("/api/config/", { method: "PUT", body: JSON.stringify(data) }),
};

// ---- Profile API ----
export const profileApi = {
  get: () => request("/api/profile/"),

  update: (data: any) =>
    request("/api/profile/", { method: "PUT", body: JSON.stringify(data) }),

  listTargetRoles: () => request("/api/profile/target-roles"),

  createTargetRole: (data: { role_name: string; role_level?: string; fit?: string }) =>
    request("/api/profile/target-roles", { method: "POST", body: JSON.stringify(data) }),

  deleteTargetRole: (id: number) =>
    request(`/api/profile/target-roles/${id}`, { method: "DELETE" }),

  createSection: (data: any) =>
    request("/api/profile/sections", { method: "POST", body: JSON.stringify(data) }),

  updateSection: (id: number, data: any) =>
    request(`/api/profile/sections/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteSection: (id: number) =>
    request(`/api/profile/sections/${id}`, { method: "DELETE" }),

  chat: async (data: { topic: string; message: string; session_id?: number }) => {
    const res = await fetch(`${API_BASE}/api/profile/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res;
  },

  importResume: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/profile/import-resume`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },

  listChatSessions: (limit = 20) =>
    request(`/api/profile/chat/sessions?limit=${limit}`),

  getChatSession: (sessionId: number) =>
    request(`/api/profile/chat/sessions/${sessionId}`),

  confirmBullet: (data: { session_id: number; bullet_index: number; edits?: Record<string, any> }) =>
    request("/api/profile/chat/confirm", { method: "POST", body: JSON.stringify(data) }),

  generateNarrative: () =>
    request("/api/profile/generate-narrative", { method: "POST" }),
};
