/**
 * 太平洋房屋｜預售與新成屋聯銷平台
 * 核心資料型別與列舉定義
 */

export type Role = 'center_admin' | 'store_manager' | 'agent';

// 人員狀態：待綁定、待開通、啟用、停用
export type UserStatus = 'PENDING_BINDING' | 'PENDING_APPROVAL' | 'ACTIVE' | 'DISABLED';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  storeId?: string; // center_admin 為空，門店人員綁定穩定 storeId
  storeName?: string;
  title: string;
  phone: string;
  mobilePhone?: string; // 公務手機
  licenseNumber?: string; // 營業員/經紀人證照字號
  notes?: string; // 人員內部備註
  email: string;
  lineId?: string;
  status?: UserStatus;
  isDemo?: boolean;
  authProvider?: 'google' | 'demo' | 'system' | 'none';
  authUid?: string; // 登入身分唯一識別碼 (如 Google sub)
  boundEmail?: string; // 已綁定之 Google 驗證 Email
  isBound?: boolean; // 是否已完成身分驗證綁定
  picture?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 門店狀態：待啟用、啟用、停用
export type StoreStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'INACTIVE';

export interface Store {
  id: string; // 穩定 storeId 關聯鍵
  name: string; // 門店名稱，必填
  code: string; // 門店代碼，必填且唯一
  companyName?: string; // 公司名稱，選填
  taxId?: string; // 統一編號，選填
  city?: string; // 縣市
  district?: string; // 行政區
  address: string; // 完整地址
  phone: string; // 門店電話
  contactPerson?: string; // 聯絡人
  contactPhone?: string; // 聯絡方式 / 手機
  contactEmail?: string; // 聯絡信箱
  managerName?: string; // 現任店長姓名
  managerId?: string; // 現任店長使用者 ID
  serviceAreas?: string[]; // 主要服務區域，可複選
  specialties?: string[]; // 擅長產品類型，可複選 (如 PRE_SALE, NEW_CONSTRUCTION, SURPLUS_HOUSE, LUXURY 等)
  internalNotes?: string; // 內部備註，僅代銷中心可見
  status: StoreStatus; // 狀態：待啟用 PENDING、啟用 ACTIVE、停用 DISABLED
  isDemo?: boolean;
  // 動態統計 (可由後端動態附帶)
  totalPersonnel?: number; // 實際計算的人員總數
  activeManagers?: number; // 啟用店長數
  activeAgents?: number; // 啟用業務數
  createdAt: string;
  updatedAt: string;
}

// 產品類型：預售屋、新成屋、餘屋
export type ProjectType = 'PRE_SALE' | 'NEW_CONSTRUCTION' | 'SURPLUS_HOUSE';

// 建物型態：大樓、華廈、透天、其他
export type BuildingType = 'BUILDING' | 'MANSION' | 'TOWNHOUSE' | 'OTHER';

// 完工狀態：實際完工、預計完工
export type CompletionDateType = 'ACTUAL' | 'ESTIMATED';

// 公開狀態：草稿、上架、暫停、結案
export type ProjectStatus = 'DRAFT' | 'ON_SALE' | 'PAUSED' | 'CLOSED';

export interface Project {
  id: string;
  name: string;
  developer: string;
  builderName?: string; // 建商名稱別名
  priceRange?: string; // 價格區間別名 (例：1500~2800萬)
  productType: ProjectType;
  buildingType?: BuildingType; // 建物型態
  city: string;
  district: string;
  address: string; // 基地地址
  receptionAddress?: string; // 接待中心地址
  receptionContact: string; // 案場現場聯絡方式
  description: string;
  highlights: string[];
  baseAreaPings?: number; // 基地面積 (坪)
  totalUnits: number; // 總戶數
  availableUnits: number; // 可售戶數 (由戶別資料動態計算)
  floorPlanInfo?: string; // 樓層規劃 (如 地上15層、地下3層)
  roomTypes?: string; // 房型規劃 (如 2~4房)
  pingRange?: string; // 坪數範圍 (如 25~55坪)
  parkingType?: string; // 車位類型 (平面式、機械式等)
  completionDateType?: CompletionDateType; // 實際完工或預計完工
  completionDate?: string; // 完工日期 (如 2026-12)
  centerContactPerson?: string; // 代銷中心承辦人
  centerContactPhone?: string; // 代銷中心電話
  centerContactEmail?: string; // 代銷中心信箱
  internalNotes?: string; // 內部備註 (僅代銷中心可見)
  status: ProjectStatus; // 草稿、上架、暫停、結案
  // 銷售素材
  coverImage?: string; // 封面照片
  exteriorImages?: string[]; // 外觀照片
  realImages?: string[]; // 實景照片
  amenityImages?: string[]; // 公設照片
  sampleHouseImages?: string[]; // 樣品屋照片
  floorPlans?: string[]; // 格局圖
  layoutPlans?: string[]; // 樓層配置圖
  specifications?: string; // 建材設備說明
  salesBrochure?: string; // 銷售說明 / 文宣要點
  attachmentUrls?: string[];
  currentCommissionVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

// 戶別狀態：可售、洽談中、已下訂、已簽約、已成交、暫停銷售、停用
export type UnitStatus =
  | 'AVAILABLE'
  | 'NEGOTIATING'
  | 'RESERVED_DEPOSIT'
  | 'SIGNED'
  | 'DEAL_CLOSED'
  | 'PAUSED'
  | 'DISABLED';

export interface Unit {
  id: string;
  projectId: string;
  building: string; // 棟別，如 A 棟
  unitNumber: string; // 戶號，如 A1-12F
  floor: number; // 樓層
  // 格局與格局拆分
  pattern?: string; // 格局描述，如 3房2廳2衛
  bedrooms?: number; // 房數
  livingRooms?: number; // 廳數
  bathrooms?: number; // 衛浴數
  // 面積 (坪)
  areaPings?: number; // 建物總坪數 (相容欄位)
  totalPing?: number; // 建物登記總坪數 (坪)
  includesParking?: boolean; // 總坪數是否含車位
  mainPing?: number; // 主建物坪數 (坪)
  subPing?: number; // 附屬建物坪數 (坪)
  commonPing?: number; // 共有部分坪數 (坪)
  parkingPing?: number; // 車位坪數 (坪)
  // 車位資訊
  parkingInfo?: string; // 車位描述 (相容欄位)
  parkingNumber?: string; // 車位編號 (如 B2-108)
  parkingType?: string; // 車位類型 (平面式、機械式等)
  // 金額 (萬元，單位明確標示)
  housePrice?: number; // 房屋開價 (萬元)
  parkingPrice?: number; // 車位開價 (萬元)
  listPrice: number; // 總開價 (萬元)
  bottomPrice?: number; // 底價 (萬元，僅代銷中心可見)
  status: UnitStatus;
  notes?: string; // 戶別備註
  createdAt: string;
  updatedAt: string;
}

export type AssignmentStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED';

export interface AssignmentHistoryItem {
  id: string;
  action: 'ASSIGN' | 'PAUSE' | 'RESUME' | 'REVOKE';
  timestamp?: string;
  changedAt?: string;
  operatorId: string;
  operatorName: string;
  reason: string;
  fromStatus?: AssignmentStatus;
  toStatus?: AssignmentStatus;
  salesNotesForStore?: string;
  internalNotes?: string;
}

export interface ProjectAssignment {
  id: string;
  projectId: string;
  projectName?: string;
  storeId: string;
  storeName?: string;
  storeCode?: string;
  storeCity?: string;
  storeDistrict?: string;
  storeSpecialties?: string[];
  contactPerson?: string;
  contactPhone?: string;
  assignedAt: string;
  assignedBy: string;
  assignedByName?: string;
  status: AssignmentStatus;
  reason?: string;
  salesNotesForStore?: string; // 門店可見的銷售說明
  internalNotes?: string; // 中心內部備註
  changeReason?: string;
  history?: AssignmentHistoryItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BatchAssignStoreItemResult {
  storeId: string;
  storeName: string;
  success: boolean;
  message: string;
}

export interface AssignmentImpactInfo {
  storeId: string;
  storeName: string;
  projectId: string;
  projectName: string;
  activeRegistrationsCount: number;
  activeReservedCustomersCount?: number;
  pendingRenewalsCount: number;
  pendingExtensionCount?: number;
  pendingTransactionsCount: number;
  inProgressTransactionsCount?: number;
  activeRegistrations: Array<{
    id: string;
    customerName: string;
    phone: string;
    agentName: string;
    createdAt: string;
    expiresAt: string;
  }>;
  pendingTransactions: Array<{
    id: string;
    customerName: string;
    agentName: string;
    stage: string;
    reportedAt: string;
  }>;
}

export interface StoreVisibleProject {
  id: string;
  name: string;
  developer: string;
  productType: ProjectType;
  buildingType?: BuildingType;
  city: string;
  district: string;
  address: string;
  receptionAddress?: string;
  receptionContact?: string;
  coverImage?: string;
  exteriorImages?: string[];
  floorPlans?: string[];
  salesBrochure?: string;
  specifications?: string;
  description?: string;
  highlights?: string[];
  priceRange?: string; // 門店可見價格區間
  status: ProjectStatus;
  totalAvailableUnits: number;
  totalUnits: number;
  updatedAt: string;
  // 門店指派專屬欄位
  assignmentId?: string;
  assignmentStatus: AssignmentStatus;
  assignedAt: string;
  salesNotesForStore?: string;
  // 當前生效分佣方案 (門店可見條件)
  commissionCondition?: {
    versionNumber: string;
    percentage: number;
    storePercentage: number;
    effectiveDate: string;
  };
}

// 客戶基本資料
export interface Customer {
  id: string;
  name: string;
  phone: string; // 示範用虛擬聯絡識別碼
  email?: string;
  source: string; // 來源：展場自然客、網路預約、門店在地轉介等
  requirementNote: string;
  budgetMin: number; // 萬元
  budgetMax: number; // 萬元
  createdAt: string;
}

// 保留狀態
export type ReservationStatus =
  | 'ACTIVE' // 有效保留（剩餘>7天）
  | 'EXPIRING_SOON' // 7天內到期警示
  | 'EXPIRED' // 已到期
  | 'CONFLICT_PENDING' // 歸屬待判定（重複登記）
  | 'REJECTED' // 已駁回（代銷中心裁定駁回，不予保留）
  | 'CONVERTED'; // 已轉下訂成交或結案

// 客戶建案登記 (核心單位：客戶 + 建案)
export interface CustomerRegistration {
  id: string;
  customerId: string;
  phone?: string; // 正規化電話
  projectId: string;
  intendedUnitId?: string;
  storeId: string;
  agentId: string;
  status: ReservationStatus;
  reservationStartDate: string; // ISO 8601
  reservationExpiryDate: string; // ISO 8601
  notes: string;
  // 購屋專屬需求（與建案登記綁定，不覆寫其他門店資料）
  budgetMin?: number; // 萬元
  budgetMax?: number; // 萬元
  roomsRequired?: string; // 房型需求 (如 1房/2房/3房/4房以上/不拘)
  parkingRequired?: string; // 車位需求 (如 不需要/平面車位/機械車位/車位不拘)
  preferredDistricts?: string; // 區域需求
  purchasePurpose?: 'SELF_USE' | 'CHANGE' | 'INVESTMENT' | 'OTHER' | string; // 購屋目的
  expectedPurchaseTime?: string; // 預計購屋時間
  source?: string; // 客戶來源
  commissionSnapshotId: string;
  conflictOriginalRegId?: string; // 若為重複登記，記錄原始衝突登記ID (僅代銷中心可見)
  conflictResolutionNote?: string;
  conflictHistory?: Array<{
    action: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    timestamp: string;
    operatorId: string;
    operatorName: string;
    reason: string;
  }>;
  isActiveReservation?: boolean; // 是否為有效保留期（用於資料庫唯一約束）
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

// 分佣計算方式
export type CommissionFormulaType = 'PERCENTAGE_TOTAL' | 'FIXED_AMOUNT';

export interface CommissionVersion {
  id: string;
  projectId: string;
  versionNumber: string; // 如 "V1.0", "V2.0"
  effectiveDate: string;
  formulaType: CommissionFormulaType;
  percentage?: number; // 如 3.0 代表總價 3%
  fixedAmount?: number; // 固定獎金 (元)
  centerPercentage: number; // 代銷中心分配比率 (如 30 代表 30%)
  storePercentage: number; // 門店分配比率 (如 70 代表 70%，兩者合計100)
  applicableConditions?: string; // 適用條件
  note: string;
  publishedBy: string;
  createdAt: string;
}

// 客戶登記時建立的不可覆寫分佣快照
export interface CommissionSnapshot {
  id: string;
  customerRegistrationId: string;
  projectId: string;
  versionId: string;
  versionNumber: string;
  lockedAt: string;
  effectiveDate?: string;
  formulaType: CommissionFormulaType;
  percentage?: number;
  fixedAmount?: number;
  calculationBase?: string;
  centerPercentage: number;
  storePercentage: number;
  applicableConditions?: string;
  status?: 'ACTIVE' | 'PENDING_APPROVAL' | 'REJECTED';
  basisDescription: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 聯絡方式
export type ContactMethod = 'PHONE' | 'LINE' | 'ON_SITE' | 'ONLINE_MEETING';

// 追蹤紀錄
export interface FollowUp {
  id: string;
  customerRegistrationId: string;
  storeId: string;
  agentId: string;
  contactTime: string;
  method: ContactMethod;
  summary: string;
  customerResponse: string; // 客戶實際回應
  nextStep: string; // 明確下一步
  nextFollowUpDate: string;
  recordedBy: string;
  isEffectiveFollowUp: boolean; // 是否符合有效追蹤規範
  createdAt: string;
}

export type RenewalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// 續期申請
export interface RenewalRequest {
  id: string;
  customerRegistrationId: string;
  storeId: string;
  agentId: string;
  originalExpiryDate: string;
  requestedDays: number; // 預設 30 天
  reason: string;
  linkedRecordType: 'followup' | 'viewing';
  linkedRecordId: string;
  status: RenewalStatus;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewReason?: string;
  newExpiryDate?: string;
  createdAt: string;
}

// 帶看狀態
export type ViewingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

// 帶看紀錄
export interface Viewing {
  id: string;
  customerRegistrationId: string;
  projectId: string;
  unitId?: string;
  scheduledTime: string;
  status: ViewingStatus;
  receptionistName: string;
  customerFeedback?: string;
  objections?: string; // 客戶主要抗性
  nextStep?: string;
  completedAt?: string;
  createdAt: string;
}

// 交易階段
export type TransactionStage =
  | 'NEGOTIATING' // 洽談中
  | 'BARGAINING' // 議價中
  | 'DEPOSIT_REPORTED' // 下訂申報中（門店提出）
  | 'DEPOSIT_CONFIRMED' // 已下訂（中心確認生效）
  | 'CONTRACT_REPORTED' // 簽約申報中
  | 'CONTRACT_CONFIRMED' // 已簽約（中心確認生效）
  | 'DEAL_REPORTED' // 成交申報中
  | 'DEAL_CONFIRMED' // 已成交（中心確認生效）
  | 'CANCELLED'; // 已取消/退訂

export interface Transaction {
  id: string;
  customerRegistrationId: string;
  projectId: string;
  unitId: string;
  storeId: string;
  agentId: string;
  stage: TransactionStage; // 正式交易階段 (如 DEPOSIT_CONFIRMED, CONTRACT_CONFIRMED, DEAL_CONFIRMED, CANCELLED)
  reviewStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'; // 審核狀態
  pendingReportType?: 'DEPOSIT' | 'CONTRACT' | 'DEAL'; // 目前待審核之申報類型
  pendingDealPrice?: number; // 待審申報之成交價
  pendingDepositAmount?: number; // 待審申報之訂金
  pendingReportNote?: string; // 待審申報備註
  dealPrice: number; // 正式生效成交總價 (元)
  depositAmount: number; // 正式生效訂金金額 (元)
  transactionDate: string;
  reportNote: string;
  centerConfirmNote?: string;
  centerConfirmedAt?: string;
  centerConfirmedBy?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  cancellationReason?: string;
  // 分佣試算/結算
  commissionSnapshotId: string;
  totalCommission: number;
  centerCommission: number;
  storeCommission: number;
  isSettled: boolean; // 是否為實際結算 (已成交確認才是，其餘為估算)
  createdAt: string;
  updatedAt: string;
}

// 操作稽核日誌
export interface AuditLog {
  id: string;
  timestamp: string;
  operatorId: string;
  operatorName: string;
  role: Role;
  storeId?: string;
  storeName?: string;
  actionType: string;
  entityType: 'PROJECT' | 'UNIT' | 'ASSIGNMENT' | 'CUSTOMER_REG' | 'RENEWAL' | 'TRANSACTION' | 'COMMISSION' | 'CONFLICT_RESOLUTION' | 'STORE' | 'USER' | 'PERSONNEL' | 'ISSUE_TICKET';
  entityId: string;
  summary: string;
  beforeValue?: string;
  afterValue?: string;
  reason?: string;
}

// 問題回報模組型別
export type IssueType =
  | 'OPERATION_FAILED' // 無法操作
  | 'DATA_ANOMALY'     // 資料異常
  | 'PERMISSION_ISSUE' // 權限問題
  | 'UI_DISPLAY'       // 畫面問題
  | 'FEATURE_REQUEST'; // 功能建議

export type IssueStatus =
  | 'PENDING'    // 待處理
  | 'IN_PROGRESS'// 處理中
  | 'WAITING_CONFIRM' // 待確認
  | 'CLOSED'     // 已結案
  | 'POSTPONED'; // 暫緩

export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface IssueComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  authorStoreId?: string;
  authorStoreName?: string;
  content: string;
  createdAt: string;
  isCenterInternal?: boolean; // 若為中心內部備註，門店/業務端不可見
}

export interface IssueStatusHistoryItem {
  id: string;
  fromStatus: IssueStatus;
  toStatus: IssueStatus;
  operatorId: string;
  operatorName: string;
  operatorRole: Role;
  reason?: string;
  createdAt: string;
}

export interface IssueTicket {
  id: string; // 回報編號 (例如 TKT-20260923-001)
  ticketNumber: string;
  type: IssueType;
  title: string;
  description: string;
  reproductionSteps?: string;
  expectedResult?: string;
  actualResult?: string;
  pagePath?: string; // 清理後的頁面路徑，不得包含參數或機敏個資
  appVersion?: string;

  // 回報人資料 (後端自動注入)
  reporterId: string;
  reporterName: string;
  reporterRole: Role;
  reporterStoreId?: string;
  reporterStoreName?: string;

  // 狀態與優先級
  status: IssueStatus;
  priority: IssuePriority;
  postponeReason?: string; // 暫緩原因

  // 中心處理與回覆
  resolutionSummary?: string; // 對回報者公開之處理結果
  verificationResult?: string; // 結案驗證結果
  centerInternalNotes?: string; // 中心內部備註 (門店端API過濾不回傳)

  // 歷程紀錄與討論
  comments: IssueComment[];
  statusHistory: IssueStatusHistoryItem[];

  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

