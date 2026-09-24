/**
 * 太平洋房屋｜預售與新成屋聯銷平台
 * 統一資料倉儲 (Repository) - 連接後端 Node.js MongoDB API
 * UI 全面維持相同的呼叫介面，底層經由 apiClient 送至 Express 後端進行 MongoDB 存取
 */

import {
  User,
  Store,
  Project,
  Unit,
  ProjectAssignment,
  Customer,
  CustomerRegistration,
  CommissionVersion,
  CommissionSnapshot,
  FollowUp,
  RenewalRequest,
  Viewing,
  Transaction,
  AuditLog,
} from '../types';
import { apiClient } from './apiClient';
import { generateInitialMockData } from './mockData';

export interface ScopedDataState {
  projects: Project[];
  units: Unit[];
  stores: Store[];
  assignments: ProjectAssignment[];
  customers: Customer[];
  registrations: CustomerRegistration[];
  commissionVersions: CommissionVersion[];
  commissionSnapshots: CommissionSnapshot[];
  followUps: FollowUp[];
  viewings: Viewing[];
  renewals: RenewalRequest[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
}

class FullStackRepository {
  private initialMock = generateInitialMockData();
  private cachedScopedData: ScopedDataState | null = null;

  // 使用者清單
  public getUsers(): User[] {
    return this.initialMock.users;
  }

  // 重設為初始示範資料（經由後端操作 MongoDB）
  public async resetToInitialMockData(): Promise<void> {
    try {
      await apiClient.resetDemoData();
      this.cachedScopedData = null;
    } catch (err) {
      console.error('Failed to reset MongoDB via backend API:', err);
      throw err;
    }
  }

  // 取得角色範圍資料（由後端 Express + MongoDB 提供）
  public async fetchScopedData(user: User): Promise<ScopedDataState> {
    const data = await apiClient.getScopedData(user.username);
    this.cachedScopedData = data;
    return data;
  }

  // 快捷同步取得快取資料 (給純同步讀取 fallback)
  public getScopedData(_user: User): ScopedDataState {
    if (this.cachedScopedData) {
      return this.cachedScopedData;
    }
    return {
      projects: [],
      units: [],
      stores: [],
      assignments: [],
      customers: [],
      registrations: [],
      commissionVersions: [],
      commissionSnapshots: [],
      followUps: [],
      viewings: [],
      renewals: [],
      transactions: [],
      auditLogs: [],
    };
  }

  // ================= 案源指派 =================
  public async assignStoreToProject(
    projectId: string,
    storeId: string,
    _operator: User,
    changeReason: string
  ): Promise<any> {
    return apiClient.assignStoreToProject(projectId, storeId, changeReason);
  }

  public async assignProjectToStore(
    projectId: string,
    storeId: string,
    operator: User,
    changeReason: string
  ): Promise<any> {
    return this.assignStoreToProject(projectId, storeId, operator, changeReason);
  }

  public async revokeStoreAssignment(
    projectId: string,
    storeId: string,
    _operator: User,
    changeReason: string
  ): Promise<any> {
    return apiClient.revokeStoreAssignment(projectId, storeId, changeReason);
  }

  // ================= 客戶登記 =================
  public async registerCustomer(params: {
    customerName: string;
    phone: string;
    email?: string;
    source?: string;
    budgetMin?: number;
    budgetMax?: number;
    roomsRequired?: string;
    parkingRequired?: string;
    preferredDistricts?: string;
    purchasePurpose?: string;
    expectedPurchaseTime?: string;
    requirementNote?: string;
    projectId: string;
    intendedUnitId?: string;
    storeId?: string;
    agentId?: string;
    notes?: string;
    operator?: User;
  }): Promise<any> {
    return apiClient.registerCustomer(params);
  }

  // ================= 衝突裁定 =================
  public async resolveConflict(params: {
    conflictRegId: string;
    action?: 'APPROVE' | 'REJECT';
    assignToStoreId?: string;
    assignToAgentId?: string;
    resolutionReason: string;
    operator?: User;
  }): Promise<any> {
    return apiClient.resolveConflict(params);
  }

  // ================= 業務追蹤 =================
  public async addFollowUp(params: {
    customerRegistrationId: string;
    storeId: string;
    agentId: string;
    method: any;
    summary: string;
    customerResponse: string;
    nextStep: string;
    nextFollowUpDate: string;
    recordedBy: string;
    operator: User;
  }): Promise<any> {
    return apiClient.addFollowUp(params);
  }

  // ================= 續期保留申請與審核 =================
  public async applyRenewal(params: {
    registrationId: string;
    storeId: string;
    agentId: string;
    reason: string;
    operator: User;
  }): Promise<any> {
    return apiClient.applyRenewal(params);
  }

  public async reviewRenewal(params: {
    renewalId: string;
    approved: boolean;
    reviewReason: string;
    operator: User;
  }): Promise<any> {
    return apiClient.reviewRenewal(params.renewalId, params);
  }

  // ================= 帶看排程與回報 =================
  public async addViewing(params: {
    customerRegistrationId: string;
    projectId: string;
    unitId?: string;
    scheduledTime: string;
    status: any;
    receptionistName: string;
    customerFeedback?: string;
    objections?: string;
    nextStep?: string;
    operator: User;
  }): Promise<any> {
    return apiClient.addViewing(params);
  }

  public async updateViewingReport(params: {
    viewingId: string;
    status: any;
    customerFeedback: string;
    objections: string;
    nextStep: string;
    receptionistName: string;
    operator: User;
  }): Promise<any> {
    return apiClient.updateViewing(params.viewingId, params);
  }

  // ================= 交易申報與確認 =================
  public async reportTransactionStage(params: {
    customerRegistrationId: string;
    unitId: string;
    stage: any;
    totalPrice: number;
    depositAmount?: number;
    contractAmount?: number;
    note?: string;
    operator: User;
  }): Promise<any> {
    return apiClient.reportTransaction(params);
  }

  public async confirmTransactionStage(params: {
    transactionId: string;
    nextStage: any;
    note?: string;
    operator: User;
  }): Promise<any> {
    return apiClient.confirmTransaction(params.transactionId, params);
  }

  public async rejectTransactionStage(params: {
    transactionId: string;
    rejectionReason: string;
    note?: string;
    operator: User;
  }): Promise<any> {
    return apiClient.rejectTransaction(params.transactionId, params);
  }

  // ================= 發布新分佣方案 =================
  public async publishCommissionVersion(params: {
    projectId: string;
    versionNumber: string;
    effectiveDate: string;
    formulaType: any;
    percentage: number;
    fixedAmount?: number;
    centerPercentage: number;
    storePercentage: number;
    note: string;
    operator: User;
  }): Promise<any> {
    return apiClient.publishCommissionVersion(params.projectId, params);
  }

  // ================= 建案與戶別 =================
  public async saveProject(project: Partial<Project>, _operator?: User): Promise<any> {
    return apiClient.saveProject(project);
  }

  public async updateProject(projectId: string, project: Partial<Project>, _operator?: User): Promise<any> {
    return apiClient.updateProject(projectId, project);
  }

  public async updateProjectStatus(projectId: string, status: string, _operator?: User): Promise<any> {
    return apiClient.updateProjectStatus(projectId, status);
  }

  public async saveUnit(unit: Partial<Unit>, _operator?: User): Promise<any> {
    return apiClient.saveUnit(unit);
  }

  public async updateUnit(unitId: string, unit: Partial<Unit>, _operator?: User): Promise<any> {
    return apiClient.updateUnit(unitId, unit);
  }

  public async deleteUnit(unitId: string, _operator?: User): Promise<any> {
    return apiClient.deleteUnit(unitId);
  }
}

export const repository = new FullStackRepository();
