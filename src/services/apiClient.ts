/**
 * 前端 API 客戶端服務
 * 嚴格遵循：前端絕對不連線 MongoDB，一律透過呼叫自身 Node.js 後端 API (/api/*)
 * 自動攜帶 Session Token 進行身分驗證與角色隔離
 */

import {
  User,
  ProjectAssignment,
  BatchAssignStoreItemResult,
  AssignmentImpactInfo,
  StoreVisibleProject,
  AssignmentStatus,
} from '../types';

const TOKEN_STORAGE_KEY = 'pacific_realty_session_token';

let memoryToken: string | null = null;
try {
  memoryToken = localStorage.getItem(TOKEN_STORAGE_KEY);
} catch {
  memoryToken = null;
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  const token = memoryToken || localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err: any = new Error(errorData.error || `伺服器回應錯誤 (${res.status})`);
    err.status = res.status;
    err.code = errorData.code;
    if (res.status === 401) {
      // 若 Session Token 已失效、過期或使用者已不存在，清除本機殘留 Token
      apiClient.clearToken();
    }
    throw err;
  }
  return res.json();
}

export const apiClient = {
  // Session Token 管理
  setToken(token: string | null) {
    memoryToken = token;
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  },

  getToken(): string | null {
    return memoryToken || localStorage.getItem(TOKEN_STORAGE_KEY);
  },

  clearToken() {
    this.setToken(null);
  },

  // 登入相關 API
  async authWithGoogle(credential: string): Promise<{
    success: boolean;
    token: string;
    user: User;
    expiresAt: string;
    isPending: boolean;
  }> {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await handleResponse<any>(res);
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  async authDemo(username: string): Promise<{
    success: boolean;
    token: string;
    user: User;
    expiresAt: string;
    isPending: boolean;
  }> {
    const res = await fetch('/api/auth/demo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await handleResponse<any>(res);
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  async getMe(): Promise<{ success: boolean; user: User; isDemo: boolean }> {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // 管理者審核與帳號管理 API (代銷中心專屬)
  async getAdminUsers(): Promise<{ success: boolean; users: User[] }> {
    const res = await fetch('/api/admin/users', {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async approveUser(userId: string, role: string, storeId?: string, storeName?: string, title?: string, phone?: string): Promise<any> {
    const res = await fetch(`/api/admin/users/${userId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role, storeId, storeName, title, phone }),
    });
    return handleResponse(res);
  },

  async toggleUserStatus(userId: string, status: 'ACTIVE' | 'DISABLED', reason?: string, handoverUserId?: string): Promise<any> {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, reason, handoverUserId }),
    });
    return handleResponse(res);
  },

  async updateUser(userId: string, payload: Partial<User>): Promise<any> {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 人員管理 API (新增、綁定帳號、調店、刪除)
  async createUser(payload: Partial<User>): Promise<{ success: boolean; user: User }> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async bindUserAccount(userId: string, boundEmail: string): Promise<any> {
    const res = await fetch(`/api/users/${userId}/bind-account`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ boundEmail }),
    });
    return handleResponse(res);
  },

  async transferUserStore(userId: string, payload: { targetStoreId: string; reason: string; handoverUserId?: string }): Promise<any> {
    const res = await fetch(`/api/users/${userId}/transfer-store`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async deleteUser(userId: string): Promise<any> {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // 門店管理 API (查詢、新增、編輯、狀態變更、刪除、異動紀錄)
  async getStores(params?: { q?: string; status?: string; city?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.status) query.set('status', params.status);
    if (params?.city) query.set('city', params.city);
    const queryString = query.toString();
    const url = queryString ? `/api/stores?${queryString}` : '/api/stores';
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getStore(storeId: string): Promise<{ success: boolean; store: any; personnel: User[] }> {
    const res = await fetch(`/api/stores/${storeId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async createStore(payload: any): Promise<{ success: boolean; store: any }> {
    const res = await fetch('/api/stores', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async updateStore(storeId: string, payload: any): Promise<any> {
    const res = await fetch(`/api/stores/${storeId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async updateStoreStatus(storeId: string, status: string, reason?: string): Promise<any> {
    const res = await fetch(`/api/stores/${storeId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    return handleResponse(res);
  },

  async deleteStore(storeId: string): Promise<any> {
    const res = await fetch(`/api/stores/${storeId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getStoreAuditLogs(storeId: string): Promise<{ success: boolean; auditLogs: any[] }> {
    const res = await fetch(`/api/stores/${storeId}/audit-logs`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // 檢查後端與 MongoDB 連線狀態
  async getHealth(): Promise<{ status: string; database: string; ping: boolean; timestamp: string }> {
    const res = await fetch('/api/health');
    return handleResponse(res);
  },

  // 取得系統所有使用者 (示範列表)
  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/users');
    return handleResponse<User[]>(res);
  },

  // 取得目前使用者的 Scoped Data (由 Session Token 自動隔離)
  async getScopedData(username?: string): Promise<any> {
    const url = username
      ? `/api/scoped-data?username=${encodeURIComponent(username)}`
      : '/api/scoped-data';
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // 重設示範資料庫至初始示範資料
  async resetDemoData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/reset-demo-data', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // 授權門店聯銷權 (向下相容)
  async assignStoreToProject(projectId: string, storeId: string, changeReason: string) {
    const res = await fetch(`/api/projects/${projectId}/assign-store`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ storeId, changeReason }),
    });
    return handleResponse(res);
  },

  // 撤銷門店聯銷權 (向下相容)
  async revokeStoreAssignment(projectId: string, storeId: string, changeReason: string) {
    const res = await fetch(`/api/projects/${projectId}/revoke-store`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ storeId, changeReason }),
    });
    return handleResponse(res);
  },

  // 取得建案指派門店清單 (中心端專用，含完整門店資訊與歷程)
  async getProjectAssignments(projectId: string): Promise<ProjectAssignment[]> {
    const res = await fetch(`/api/projects/${projectId}/assignments`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ProjectAssignment[]>(res);
  },

  // 批次指派門店 (中心端)
  async batchAssignStores(
    projectId: string,
    payload: {
      storeIds: string[];
      reason: string;
      salesNotesForStore?: string;
      internalNotes?: string;
    }
  ): Promise<{ success: boolean; results: BatchAssignStoreItemResult[] }> {
    const res = await fetch(`/api/projects/${projectId}/batch-assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; results: BatchAssignStoreItemResult[] }>(res);
  },

  // 變更指派狀態 (暫停 PAUSED / 恢復 ACTIVE / 撤銷 REVOKED)
  async updateAssignmentStatus(
    projectId: string,
    assignmentId: string,
    payload: {
      status: AssignmentStatus;
      reason: string;
      salesNotesForStore?: string;
      internalNotes?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/projects/${projectId}/assignments/${assignmentId}/status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // 檢查指派變更影響評估
  async getAssignmentImpact(projectId: string, assignmentId: string): Promise<AssignmentImpactInfo> {
    const res = await fetch(`/api/projects/${projectId}/assignments/${assignmentId}/impact-check`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<AssignmentImpactInfo>(res);
  },

  // 門店「我的建案」專用清單 (後端嚴格過濾與白名單)
  async getStoreMyProjects(): Promise<StoreVisibleProject[]> {
    const res = await fetch('/api/store/my-projects', {
      headers: getAuthHeaders(),
    });
    return handleResponse<StoreVisibleProject[]>(res);
  },

  // 門店「建案詳情」專用 (嚴格白名單，徹底剝除底價)
  async getStoreProjectDetail(projectId: string): Promise<any> {
    const res = await fetch(`/api/store/projects/${projectId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(res);
  },

  // 門店「歷史案源入口」專用 (唯讀)
  async getStoreHistoricalProjects(): Promise<any[]> {
    const res = await fetch('/api/store/historical-projects', {
      headers: getAuthHeaders(),
    });
    return handleResponse<any[]>(res);
  },

  // 客戶登記 (含防連點、跨門店衝突判定與不可變分佣快照鎖定)
  async registerCustomer(payload: {
    customerName: string;
    phone: string;
    email?: string;
    source?: string;
    requirementNote?: string;
    budgetMin?: number;
    budgetMax?: number;
    roomsRequired?: string;
    parkingRequired?: string;
    preferredDistricts?: string;
    purchasePurpose?: string;
    expectedPurchaseTime?: string;
    projectId: string;
    intendedUnitId?: string;
    storeId?: string;
    agentId?: string;
    notes?: string;
  }) {
    const res = await fetch('/api/customers/register', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 裁定重複登記衝突 (核准或駁回)
  async resolveConflict(payload: {
    conflictRegId: string;
    action?: 'APPROVE' | 'REJECT';
    assignToStoreId?: string;
    assignToAgentId?: string;
    resolutionReason: string;
  }) {
    const res = await fetch('/api/registrations/resolve-conflict', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 新增追蹤紀錄
  async addFollowUp(payload: {
    customerRegistrationId: string;
    method: string;
    summary: string;
    customerResponse: string;
    nextStep: string;
    nextFollowUpDate: string;
  }) {
    const res = await fetch('/api/follow-ups', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 申請展期
  async applyRenewal(payload: {
    registrationId: string;
    reason: string;
  }) {
    const res = await fetch('/api/renewals/apply', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 審核展期
  async reviewRenewal(renewalId: string, payload: {
    approved: boolean;
    reviewReason: string;
  }) {
    const res = await fetch(`/api/renewals/${renewalId}/review`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 預約 / 登記帶看
  async addViewing(payload: {
    customerRegistrationId: string;
    projectId: string;
    unitId?: string;
    scheduledTime: string;
    status: string;
    receptionistName: string;
    customerFeedback?: string;
    objections?: string;
    nextStep?: string;
  }) {
    const res = await fetch('/api/viewings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 更新帶看回報
  async updateViewing(viewingId: string, payload: {
    status: string;
    customerFeedback?: string;
    objections?: string;
    nextStep?: string;
    receptionistName: string;
  }) {
    const res = await fetch(`/api/viewings/${viewingId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 申報交易階段
  async reportTransaction(payload: {
    customerRegistrationId: string;
    unitId: string;
    stage: string;
    totalPrice: number;
    depositAmount?: number;
    contractAmount?: number;
    note?: string;
  }) {
    const res = await fetch('/api/transactions/report', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 代銷中心確認交易階段
  async confirmTransaction(transactionId: string, payload: {
    nextStage: string;
    note?: string;
  }) {
    const res = await fetch(`/api/transactions/${transactionId}/confirm`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 代銷中心駁回交易申報
  async rejectTransaction(transactionId: string, payload: {
    rejectionReason: string;
    note?: string;
  }) {
    const res = await fetch(`/api/transactions/${transactionId}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 發布新分佣方案版本
  async publishCommissionVersion(projectId: string, payload: {
    versionNumber: string;
    effectiveDate: string;
    formulaType: string;
    percentage: number;
    fixedAmount?: number;
    centerPercentage: number;
    storePercentage: number;
    note: string;
  }) {
    const res = await fetch(`/api/projects/${projectId}/commission-versions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // 建立建案
  async saveProject(project: any) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ project }),
    });
    return handleResponse(res);
  },

  // 編輯更新建案
  async updateProject(projectId: string, project: any) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ project }),
    });
    return handleResponse(res);
  },

  // 快速變更建案狀態 (草稿、上架、暫停、結案)
  async updateProjectStatus(projectId: string, status: string) {
    const res = await fetch(`/api/projects/${projectId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  // 新增戶別
  async saveUnit(unit: any) {
    const res = await fetch('/api/units', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ unit }),
    });
    return handleResponse(res);
  },

  // 編輯更新戶別
  async updateUnit(unitId: string, unit: any) {
    const res = await fetch(`/api/units/${unitId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ unit }),
    });
    return handleResponse(res);
  },

  // 刪除或停用戶別 (若具關聯歷程後端自動轉為停用)
  async deleteUnit(unitId: string) {
    const res = await fetch(`/api/units/${unitId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ==================== 問題回報 API ====================

  async getIssues(params?: { status?: string; type?: string; storeId?: string; priority?: string }): Promise<{ success: boolean; tickets: any[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.storeId) query.set('storeId', params.storeId);
    if (params?.priority) query.set('priority', params.priority);
    const qs = query.toString();
    const url = qs ? `/api/issues?${qs}` : '/api/issues';
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async createIssue(payload: {
    type: string;
    title: string;
    description: string;
    reproductionSteps?: string;
    expectedResult?: string;
    actualResult?: string;
    pagePath?: string;
    appVersion?: string;
  }): Promise<{ success: boolean; ticket: any; duplicatePrevented?: boolean; ticketId: string }> {
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async updateIssueStatus(ticketId: string, payload: {
    status?: string;
    priority?: string;
    postponeReason?: string;
    resolutionSummary?: string;
    verificationResult?: string;
    centerInternalNotes?: string;
    rollbackReason?: string;
  }): Promise<{ success: boolean; fromStatus: string; toStatus: string }> {
    const res = await fetch(`/api/issues/${ticketId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async addIssueComment(ticketId: string, payload: {
    content: string;
    isCenterInternal?: boolean;
  }): Promise<{ success: boolean; comment: any }> {
    const res = await fetch(`/api/issues/${ticketId}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
};

