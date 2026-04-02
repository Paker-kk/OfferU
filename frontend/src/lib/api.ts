// =============================================
// API 客户端 — 统一的后端请求封装
// =============================================
// 所有前端组件通过此模块与后端通信
// 基于 fetch API，支持 SWR 缓存
// =============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  list: (params?: { page?: number; period?: string; source?: string }) =>
    request(`/api/jobs/?${new URLSearchParams(params as any)}`),
  
  get: (id: number) => request(`/api/jobs/${id}`),
  
  stats: (period = "week") => request(`/api/jobs/stats?period=${period}`),
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
