/**
 * 太平洋房屋｜預售與新成屋聯銷平台
 * 核心業務規則引擎與純函式
 */

import {
  CustomerRegistration,
  FollowUp,
  Viewing,
  CommissionSnapshot,
  CommissionVersion,
  Role,
  User,
  TransactionStage,
  ReservationStatus,
} from '../types';

/**
 * 格式化新台幣金額 (元 / 萬元)
 * 內部運算與資料庫統一以「元」為儲存單位。
 * 缺少金額或 null/undefined 時顯示「尚未填寫／待確認」，不默認為 0 元。
 */
export function formatCurrencyNTD(
  amount?: number | null,
  showTenThousand: boolean = false,
  emptyText: string = '尚未填寫／待確認'
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return emptyText;
  }
  if (showTenThousand && Math.abs(amount) >= 10000) {
    const wan = (amount / 10000).toLocaleString('zh-TW', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    return `NT$ ${wan} 萬元`;
  }
  return `NT$ ${Math.round(amount).toLocaleString('zh-TW')} 元`;
}

/**
 * 將新台幣「元」轉換為「萬元」字串顯示 (例: 27000000 -> 2,700 萬)
 */
export function formatWan(amount?: number | null, unitSuffix: string = '萬'): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount <= 0) {
    return '未載';
  }
  const wan = amount / 10000;
  return `${wan.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} ${unitSuffix}`;
}

/**
 * 格式化棟別與戶號，避免「A棟棟」或「A棟 棟」等字眼重複
 */
export function formatBuildingName(building?: string): string {
  if (!building) return '';
  const trimmed = building.trim();
  if (trimmed.endsWith('棟') || trimmed.endsWith('區')) {
    return trimmed;
  }
  return `${trimmed}棟`;
}

export function formatBuildingUnit(building?: string, unitNumber?: string): string {
  const b = formatBuildingName(building);
  const u = (unitNumber || '').trim();
  if (!b) return u;
  if (!u) return b;
  return `${b} ${u}`;
}
export function formatDateTaipei(isoDateString?: string, includeTime: boolean = false): string {
  if (!isoDateString) return '-';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return '-';
    
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(includeTime
        ? {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }
        : {}),
    };
    return new Intl.DateTimeFormat('zh-TW', options).format(d);
  } catch {
    return isoDateString;
  }
}

/**
 * 規範化示範聯絡識別碼 (處理空白、連字號、括號及台灣國碼 +886 / 00886)
 */
export function normalizeContactPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\.\(\)\+]/g, '');

  if (cleaned.startsWith('00886')) {
    cleaned = cleaned.substring(5);
    if (!cleaned.startsWith('0')) {
      cleaned = '0' + cleaned;
    }
  } else if (cleaned.startsWith('886')) {
    cleaned = cleaned.substring(3);
    if (!cleaned.startsWith('0')) {
      cleaned = '0' + cleaned;
    }
  }

  return cleaned;
}

/**
 * 電話遮罩 (兼顧手機 0912-***-456 與市話 02-****-5678)
 */
export function maskPhone(phone?: string): string {
  if (!phone) return '-';
  const clean = normalizeContactPhone(phone);
  if (clean.length === 10 && clean.startsWith('09')) {
    return `${clean.substring(0, 4)}-***-${clean.substring(7)}`;
  }
  if (clean.length >= 9 && clean.startsWith('0')) {
    return `${clean.substring(0, 2)}-****-${clean.substring(clean.length - 4)}`;
  }
  if (clean.length > 6) {
    const start = Math.min(3, Math.floor(clean.length / 3));
    const end = Math.min(3, Math.floor(clean.length / 3));
    const stars = '*'.repeat(Math.max(3, clean.length - start - end));
    return `${clean.substring(0, start)}${stars}${clean.substring(clean.length - end)}`;
  }
  return clean.replace(/.(?=.{2})/g, '*');
}

/**
 * 計算客戶在特定建案保留期的剩餘天數與狀態
 * 規則：
 * - 成功登記時自動取得 30 天保留期
 * - 剩餘 > 7 天：一般狀態 (ACTIVE)
 * - 0 < 剩餘 <= 7 天：黃色警示 (EXPIRING_SOON)
 * - 剩餘 <= 0 天：紅色到期警示 (EXPIRED)
 * - 到期狀態依實際時間動態判斷，不可完全依賴排程
 */
export function calculateReservationStatus(
  registration: CustomerRegistration,
  now: Date = new Date()
): {
  daysLeft: number;
  status: ReservationStatus;
  statusLabel: string;
  badgeClass: string;
} {
  if (registration.status === 'REJECTED') {
    return {
      daysLeft: 0,
      status: 'REJECTED',
      statusLabel: '已駁回',
      badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
    };
  }

  if (registration.status === 'CONFLICT_PENDING') {
    return {
      daysLeft: 0,
      status: 'CONFLICT_PENDING',
      statusLabel: '歸屬待判定',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }

  if (registration.status === 'CONVERTED') {
    return {
      daysLeft: 0,
      status: 'CONVERTED',
      statusLabel: '已轉交易',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    };
  }

  const expiry = new Date(registration.reservationExpiryDate).getTime();
  const current = now.getTime();
  const diffMs = expiry - current;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return {
      daysLeft: 0,
      status: 'EXPIRED',
      statusLabel: '保留已到期',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }

  if (daysLeft <= 7) {
    return {
      daysLeft,
      status: 'EXPIRING_SOON',
      statusLabel: `即將到期 (剩 ${daysLeft} 天)`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }

  return {
    daysLeft,
    status: 'ACTIVE',
    statusLabel: `專屬保留中 (剩 ${daysLeft} 天)`,
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };
}

/**
 * 取得客戶登記狀態之對應標籤與樣式
 */
export function getRegistrationBadge(status: string): { label: string; color: string } {
  switch (status) {
    case 'ACTIVE':
      return { label: '專屬保留中', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'EXPIRING_SOON':
      return { label: '7天內即將到期', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'EXPIRED':
      return { label: '保留期滿失效', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    case 'CONFLICT_PENDING':
      return { label: '歸屬待判定', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'REJECTED':
      return { label: '已駁回 (不予保留)', color: 'bg-slate-200 text-slate-700 border-slate-300' };
    case 'DEAL_PENDING':
      return { label: '交易進度申報中', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    case 'DEAL_CLOSED':
    case 'CONVERTED':
      return { label: '已成交結案', color: 'bg-emerald-600 text-white font-bold' };
    default:
      return { label: status, color: 'bg-slate-100 text-slate-700' };
  }
}

/**
 * 判定單筆追蹤紀錄是否為「有效追蹤」
 * 規則：
 * 1. 須在 14 天內
 * 2. 須有客戶實際回應及下一步
 * 3. 僅建立待辦不算有效追蹤
 */
export function isFollowUpEffective(followUp: FollowUp, now: Date = new Date()): boolean {
  const contactDate = new Date(followUp.contactTime).getTime();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const isWithin14Days = now.getTime() - contactDate <= fourteenDaysMs && now.getTime() >= contactDate;

  const hasResponse = !!followUp.customerResponse && followUp.customerResponse.trim().length > 3;
  const hasNextStep = !!followUp.nextStep && followUp.nextStep.trim().length > 2;

  return isWithin14Days && hasResponse && hasNextStep;
}

/**
 * 判定單筆帶看是否為「有效帶看」
 * 規則：
 * 1. 狀態為 COMPLETED
 * 2. 在 14 天內
 * 3. 填寫有客戶回饋與結果
 */
export function isViewingEffective(viewing: Viewing, now: Date = new Date()): boolean {
  if (viewing.status !== 'COMPLETED') return false;
  const completedDate = new Date(viewing.completedAt || viewing.scheduledTime).getTime();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const isWithin14Days = now.getTime() - completedDate <= fourteenDaysMs;

  const hasFeedback = !!viewing.customerFeedback && viewing.customerFeedback.trim().length > 2;
  return isWithin14Days && hasFeedback;
}

/**
 * 續期資格判定
 * 規則：
 * 1. 最近 14 天內，至少有一筆包含實際客戶回應及下一步的有效追蹤，或一筆已完成帶看
 * 2. 同一登記不可同時有多筆待審續期
 */
export function checkRenewalEligibility(
  registrationId: string,
  followUps: FollowUp[],
  viewings: Viewing[],
  hasPendingRenewal: boolean,
  now: Date = new Date()
): {
  eligible: boolean;
  reason?: string;
  validRecord?: {
    type: 'followup' | 'viewing';
    id: string;
    date: string;
    summary: string;
  };
} {
  if (hasPendingRenewal) {
    return {
      eligible: false,
      reason: '此客戶登記已有待代銷中心審核的續期申請，無法重複送件。',
    };
  }

  // 尋找 14 天內符合條件的追蹤
  const validFollowUp = followUps
    .filter((f) => f.customerRegistrationId === registrationId && isFollowUpEffective(f, now))
    .sort((a, b) => new Date(b.contactTime).getTime() - new Date(a.contactTime).getTime())[0];

  if (validFollowUp) {
    return {
      eligible: true,
      validRecord: {
        type: 'followup',
        id: validFollowUp.id,
        date: validFollowUp.contactTime,
        summary: `追蹤紀錄 (${formatDateTaipei(validFollowUp.contactTime)})：${validFollowUp.customerResponse}`,
      },
    };
  }

  // 尋找 14 天內完成的帶看
  const validViewing = viewings
    .filter((v) => v.customerRegistrationId === registrationId && isViewingEffective(v, now))
    .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())[0];

  if (validViewing) {
    return {
      eligible: true,
      validRecord: {
        type: 'viewing',
        id: validViewing.id,
        date: validViewing.completedAt || validViewing.scheduledTime,
        summary: `帶看完成 (${formatDateTaipei(validViewing.completedAt || validViewing.scheduledTime)})：${validViewing.customerFeedback}`,
      },
    };
  }

  return {
    eligible: false,
    reason: '不符合續期資格：過去14天內無有效追蹤（需含客戶回應及下一步）或已完成帶看紀錄。',
  };
}

/**
 * 計算核准續期後的新到期日
 * 規則：「每次核准延長30天，以原到期日或核准日較晚者起算」
 */
export function calculateNewExpiryDate(
  originalExpiryDateStr: string,
  approvalDate: Date = new Date(),
  extendDays: number = 30
): string {
  const originalExpiry = new Date(originalExpiryDateStr).getTime();
  const approvalTime = approvalDate.getTime();
  const baseTime = Math.max(originalExpiry, approvalTime);
  const newDate = new Date(baseTime + extendDays * 24 * 60 * 60 * 1000);
  return newDate.toISOString();
}

/**
 * 重複登記衝突檢核
 * 規則：
 * - 相同客戶在不同建案可分別登記
 * - 同案已有有效保留時，新登記進入「歸屬待判定」，不得建立第二筆有效保留
 * - 若原紀錄已到期，亦需由中心判定或確認後啟用
 */
export function checkDuplicateRegistrationConflict(
  normalizedPhone: string,
  projectId: string,
  existingRegistrations: CustomerRegistration[],
  customerPhoneMap: Map<string, string> // customerId -> normalizedPhone
): {
  isConflict: boolean;
  conflictingRegistration?: CustomerRegistration;
} {
  const match = existingRegistrations.find((reg) => {
    if (reg.projectId !== projectId) return false;
    // 排除已轉交易或已駁回
    if (reg.status === 'CONVERTED') return false;

    const phone = customerPhoneMap.get(reg.customerId);
    return phone === normalizedPhone;
  });

  if (match) {
    return {
      isConflict: true,
      conflictingRegistration: match,
    };
  }

  return {
    isConflict: false,
  };
}

/**
 * 建立不可覆寫的分佣快照 (以客戶成功登記為唯一鎖定時點)
 */
export function createCommissionSnapshot(
  customerRegistrationId: string,
  version: CommissionVersion
): CommissionSnapshot {
  return {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    customerRegistrationId,
    projectId: version.projectId,
    versionId: version.id,
    versionNumber: version.versionNumber,
    lockedAt: new Date().toISOString(),
    formulaType: version.formulaType,
    percentage: version.percentage,
    fixedAmount: version.fixedAmount,
    centerPercentage: version.centerPercentage,
    storePercentage: version.storePercentage,
    basisDescription:
      version.formulaType === 'PERCENTAGE_TOTAL'
        ? `總價 ${version.percentage}% 獎勵 (中心 ${version.centerPercentage}% / 門店 ${version.storePercentage}%)`
        : `固定每戶 ${formatCurrencyNTD(version.fixedAmount || 0)} (中心 ${version.centerPercentage}% / 門店 ${version.storePercentage}%)`,
  };
}

/**
 * 依據分佣快照計算總佣金與中心/門店分配金額
 */
export function calculateCommissionFromSnapshot(
  dealPrice: number,
  snapshot: CommissionSnapshot
): {
  totalCommission: number;
  centerCommission: number;
  storeCommission: number;
} {
  let totalCommission = 0;

  if (snapshot.formulaType === 'PERCENTAGE_TOTAL' && snapshot.percentage) {
    totalCommission = Math.round(dealPrice * (snapshot.percentage / 100));
  } else if (snapshot.formulaType === 'FIXED_AMOUNT' && snapshot.fixedAmount) {
    totalCommission = Math.round(snapshot.fixedAmount);
  }

  const centerCommission = Math.round(totalCommission * (snapshot.centerPercentage / 100));
  // 門店分配採用相減，確保合計剛好 100% 且無四捨五入落差
  const storeCommission = totalCommission - centerCommission;

  return {
    totalCommission,
    centerCommission,
    storeCommission,
  };
}

/**
 * 交易狀態合法轉換規則
 */
export function canTransitionTransactionStage(
  currentStage: TransactionStage,
  targetStage: TransactionStage
): boolean {
  if (currentStage === targetStage) return true;
  if (currentStage === 'DEAL_CONFIRMED') return false; // 成交後不可再轉
  if (targetStage === 'CANCELLED') return true; // 任何進行中階段均可申請取消/退訂

  const transitions: Record<TransactionStage, TransactionStage[]> = {
    NEGOTIATING: ['BARGAINING', 'DEPOSIT_REPORTED', 'CANCELLED'],
    BARGAINING: ['DEPOSIT_REPORTED', 'CANCELLED'],
    DEPOSIT_REPORTED: ['DEPOSIT_CONFIRMED', 'CANCELLED'],
    DEPOSIT_CONFIRMED: ['CONTRACT_REPORTED', 'CANCELLED'],
    CONTRACT_REPORTED: ['CONTRACT_CONFIRMED', 'CANCELLED'],
    CONTRACT_CONFIRMED: ['DEAL_REPORTED', 'CANCELLED'],
    DEAL_REPORTED: ['DEAL_CONFIRMED', 'CANCELLED'],
    DEAL_CONFIRMED: [],
    CANCELLED: [],
  };

  const allowed = transitions[currentStage];
  return Array.isArray(allowed) ? allowed.includes(targetStage) : false;
}

/**
 * 角色功能權限檢查
 */
export function checkPermission(
  user: User,
  action:
    | 'MANAGE_ALL_PROJECTS'
    | 'VIEW_BOTTOM_PRICE'
    | 'APPROVE_RENEWAL'
    | 'RESOLVE_CONFLICT'
    | 'PUBLISH_COMMISSION'
    | 'CONFIRM_TRANSACTION'
    | 'ASSIGN_AGENT_IN_STORE'
    | 'CREATE_CUSTOMER_REG'
    | 'APPLY_RENEWAL'
    | 'REPORT_TRANSACTION'
): boolean {
  if (user.role === 'center_admin') {
    return true; // 代銷中心具備全域管理權限
  }

  if (user.role === 'store_manager') {
    switch (action) {
      case 'MANAGE_ALL_PROJECTS':
      case 'VIEW_BOTTOM_PRICE':
      case 'APPROVE_RENEWAL':
      case 'RESOLVE_CONFLICT':
      case 'PUBLISH_COMMISSION':
      case 'CONFIRM_TRANSACTION':
        return false;
      case 'ASSIGN_AGENT_IN_STORE':
      case 'CREATE_CUSTOMER_REG':
      case 'APPLY_RENEWAL':
      case 'REPORT_TRANSACTION':
        return true;
      default:
        return false;
    }
  }

  if (user.role === 'agent') {
    switch (action) {
      case 'MANAGE_ALL_PROJECTS':
      case 'VIEW_BOTTOM_PRICE':
      case 'APPROVE_RENEWAL':
      case 'RESOLVE_CONFLICT':
      case 'PUBLISH_COMMISSION':
      case 'CONFIRM_TRANSACTION':
      case 'ASSIGN_AGENT_IN_STORE':
        return false;
      case 'CREATE_CUSTOMER_REG':
      case 'APPLY_RENEWAL':
      case 'REPORT_TRANSACTION':
        return true;
      default:
        return false;
    }
  }

  return false;
}
