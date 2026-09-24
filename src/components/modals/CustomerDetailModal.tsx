import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomerRegistration } from '../../types';
import {
  formatDateTaipei,
  formatCurrencyNTD,
  getRegistrationBadge,
  checkRenewalEligibility,
  calculateReservationStatus,
  maskPhone,
  formatBuildingUnit,
} from '../../rules';
import {
  User,
  Clock,
  Building,
  Home,
  Percent,
  CheckCircle2,
  CalendarCheck,
  MessageSquareText,
  BadgeDollarSign,
  AlertTriangle,
  X,
  Phone,
  Mail,
  Store,
  UserCheck,
  Shield,
  FileCheck2,
  Plus,
  History,
  Info,
} from 'lucide-react';

interface CustomerDetailModalProps {
  isOpen?: boolean;
  onClose: () => void;
  registration: CustomerRegistration | null;
  onOpenFollowUp: (reg: CustomerRegistration) => void;
  onOpenViewing: (reg: CustomerRegistration) => void;
  onOpenRenewal: (reg: CustomerRegistration) => void;
  onOpenReportTransaction: (reg: CustomerRegistration) => void;
  onOpenResolveConflict?: (reg: CustomerRegistration) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen = true,
  onClose,
  registration,
  onOpenFollowUp,
  onOpenViewing,
  onOpenRenewal,
  onOpenReportTransaction,
  onOpenResolveConflict,
}) => {
  const { currentUser, scopedData, allUsers } = useApp();
  const [activeTab, setActiveTab] = useState<'requirements' | 'followups' | 'viewings' | 'renewals' | 'transactions' | 'conflicts'>('requirements');

  if (!isOpen || !registration) return null;

  const customer = scopedData.customers.find((c) => c.id === registration.customerId);
  const project = scopedData.projects.find((p) => p.id === registration.projectId);
  const unit = scopedData.units.find((u) => u.id === registration.intendedUnitId);
  const store = scopedData.stores.find((s) => s.id === registration.storeId);
  const agent = allUsers.find((u) => u.id === registration.agentId);
  const snapshot = scopedData.commissionSnapshots.find((s) => s.id === registration.commissionSnapshotId);

  // 關聯紀錄
  const followUps = scopedData.followUps
    .filter((f) => f.customerRegistrationId === registration.id)
    .sort((a, b) => new Date(b.contactTime).getTime() - new Date(a.contactTime).getTime());

  const viewings = scopedData.viewings
    .filter((v) => v.customerRegistrationId === registration.id)
    .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());

  const renewals = scopedData.renewals
    .filter((r) => r.customerRegistrationId === registration.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const transactions = scopedData.transactions
    .filter((t) => t.customerRegistrationId === registration.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const badge = getRegistrationBadge(registration.status);
  const resStatus = calculateReservationStatus(registration);
  const approvedRenewalCount = renewals.filter((r) => r.status === 'APPROVED').length;

  // 電話遮罩保護 (僅限 Center Admin 或 本門店人員檢視完整電話)
  const canViewFullPhone = currentUser.role === 'center_admin' || currentUser.storeId === registration.storeId;
  const rawPhone = customer?.phone || registration.phone || '';
  const displayPhone = canViewFullPhone ? rawPhone : maskPhone(rawPhone);

  // 續期資格檢查
  const hasPendingRenewal = renewals.some((r) => r.status === 'PENDING');
  const eligibility = checkRenewalEligibility(
    registration.id,
    scopedData.followUps,
    scopedData.viewings,
    hasPendingRenewal
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-lg sm:text-xl font-bold text-slate-900">{customer?.name}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.color}`}>
                {badge.label}
              </span>
              {registration.status !== 'EXPIRED' && registration.status !== 'CONVERTED' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  保留剩餘 {resStatus.daysLeft} 天
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              聯絡識別：<span className="font-mono text-slate-800 font-semibold">{displayPhone}</span> · 來源：{customer?.source || registration.source} · 登記時間：{formatDateTaipei(registration.createdAt, true)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 衝突警示 (若是待判定) */}
        {registration.status === 'CONFLICT_PENDING' && (
          <div className="p-3 sm:px-6 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>代銷中心歸屬待判定：</strong>
                此客戶於該建案有跨門店重疊登記。代銷中心審核判定前，暫不建立正式保留期。
              </span>
            </div>
            {currentUser.role === 'center_admin' && onOpenResolveConflict && (
              <button
                onClick={() => onOpenResolveConflict(registration)}
                className="px-3 py-1 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 shrink-0 shadow-xs"
              >
                處理爭議歸屬
              </button>
            )}
          </div>
        )}

        {/* 內容區塊 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* 案源與門店資訊橫幅 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block text-[11px]">意向建案</span>
              <strong className="text-slate-800 text-xs sm:text-sm mt-0.5 block truncate">
                {project?.name}
              </strong>
              <span className="text-[10px] text-slate-500">
                {project?.city}{project?.district}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">意向戶別</span>
              <strong className="text-slate-800 text-xs sm:text-sm mt-0.5 block truncate">
                {unit ? formatBuildingUnit(unit.building, unit.unitNumber) : '尚未指定'}
              </strong>
              <span className="text-[10px] text-slate-500">
                {unit ? `${unit.pattern} · 開價 ${(unit.listPrice / 10000).toLocaleString('zh-TW')} 萬元` : '（不鎖定戶別）'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">承辦門店</span>
              <strong className="text-slate-800 text-xs sm:text-sm mt-0.5 block truncate">
                {store?.name}
              </strong>
              <span className="text-[10px] text-slate-500">
                業務：{agent?.name}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">保留期到期日</span>
              <strong className="text-rose-600 text-xs sm:text-sm mt-0.5 block truncate">
                {formatDateTaipei(registration.reservationExpiryDate)}
              </strong>
              <span className="text-[10px] text-slate-500">
                已核准續期 {approvedRenewalCount} 次
              </span>
            </div>
          </div>

          {/* 鎖定分佣快照 (保障說明) */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-700" />
                登記時鎖定之分佣快照 (不可覆寫)
              </span>
              <span className="text-[11px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 font-semibold">
                版本：{snapshot?.versionNumber || snapshot?.versionId || 'V1.0'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-slate-400 block">計佣基礎說明</span>
                <strong className="text-slate-800 mt-0.5 block">{snapshot?.basisDescription}</strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-slate-400 block">門店分潤比例</span>
                <strong className="text-emerald-700 mt-0.5 block">
                  {snapshot?.formulaType === 'PERCENTAGE_TOTAL'
                    ? `成交總價 ${snapshot.storePercentage}% (佔總佣 ${(
                        (snapshot.storePercentage / (snapshot.percentage || 1)) *
                        100
                      ).toFixed(0)}%)`
                    : `每戶 ${snapshot?.fixedAmount ? Number(snapshot.fixedAmount).toLocaleString('zh-TW') : '待確認'} 元`}
                </strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-slate-400 block">代銷中心分配</span>
                <strong className="text-slate-600 mt-0.5 block">
                  {snapshot?.formulaType === 'PERCENTAGE_TOTAL'
                    ? `總價 ${snapshot.centerPercentage}%`
                    : '由代銷中心統籌'}
                </strong>
              </div>
            </div>
          </div>

          {/* 快捷操作工具列 */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={() => onOpenFollowUp(registration)}
              className="px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-rose-400" />
              新增追蹤紀錄
            </button>

            <button
              onClick={() => onOpenViewing(registration)}
              className="px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-sky-400" />
              預約/回報帶看
            </button>

            <button
              onClick={() => onOpenRenewal(registration)}
              className="px-3 py-1.5 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-300" />
              申請保留續期 (+30天)
            </button>

            <button
              onClick={() => onOpenReportTransaction(registration)}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold flex items-center gap-1.5 transition-colors ml-auto shadow-xs"
            >
              <BadgeDollarSign className="w-3.5 h-3.5" />
              申報交易進度
            </button>
          </div>

          {/* 紀錄標籤頁切換 */}
          <div className="border-b border-slate-200 flex gap-4 pt-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('requirements')}
              className={`pb-2 font-semibold text-xs border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
                activeTab === 'requirements'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              登記需求與條件
            </button>

            <button
              onClick={() => setActiveTab('followups')}
              className={`pb-2 font-semibold text-xs border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
                activeTab === 'followups'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              追蹤歷程 ({followUps.length})
            </button>

            <button
              onClick={() => setActiveTab('viewings')}
              className={`pb-2 font-semibold text-xs border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
                activeTab === 'viewings'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              帶看行程 ({viewings.length})
            </button>

            <button
              onClick={() => setActiveTab('renewals')}
              className={`pb-2 font-semibold text-xs border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
                activeTab === 'renewals'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              保留續期審查 ({renewals.length})
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-2 font-semibold text-xs border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
                activeTab === 'transactions'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BadgeDollarSign className="w-3.5 h-3.5" />
              交易申報 ({transactions.length})
            </button>

            {(registration.conflictHistory && registration.conflictHistory.length > 0) || registration.status === 'CONFLICT_PENDING' ? (
              <button
                onClick={() => setActiveTab('conflicts')}
                className={`pb-2 font-semibold text-xs border-b-2 flex items-center gap-1.5 shrink-0 transition-colors ${
                  activeTab === 'conflicts'
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-600" />
                重複判定歷程 ({registration.conflictHistory?.length || 0})
              </button>
            ) : null}
          </div>

          {/* 標籤頁內容 */}
          <div>
            {/* 登記需求與條件 */}
            {activeTab === 'requirements' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[11px]">購屋預算範圍</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block">
                      {(customer?.budgetMin || registration.budgetMin) && (customer?.budgetMax || registration.budgetMax)
                        ? `${customer?.budgetMin || registration.budgetMin} ~ ${customer?.budgetMax || registration.budgetMax} 萬元`
                        : customer?.budgetMax || registration.budgetMax
                        ? `${customer?.budgetMax || registration.budgetMax} 萬元以內`
                        : customer?.budgetMin || registration.budgetMin
                        ? `${customer?.budgetMin || registration.budgetMin} 萬元以上`
                        : '尚未填寫／待確認'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">房型需求</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block">
                      {registration.roomsRequired || '3房'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">車位需求</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block">
                      {registration.parkingRequired || '需要平面車位'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">購屋目的</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block">
                      {registration.purchasePurpose || '自住'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">預計購屋時間</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block">
                      {registration.expectedPurchaseTime || '3個月內'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">偏好區域</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block">
                      {registration.preferredDistricts || `${project?.city}${project?.district}`}
                    </strong>
                  </div>
                </div>

                {unit && (
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>戶別意向提醒：</strong>本登記選擇意向戶別「{unit.building} {unit.unitNumber}」。客戶保留不等於戶別保留，戶別僅供意向記錄，不鎖定戶別亦不影響他人看屋。
                    </div>
                  </div>
                )}

                {registration.notes && (
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                    <span className="font-bold text-slate-700 block">備註說明與初次聯繫重點</span>
                    <p className="text-slate-600 whitespace-pre-wrap">{registration.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* 追蹤歷程 */}
            {activeTab === 'followups' && (
              <div className="space-y-2.5">
                {followUps.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">尚無追蹤紀錄，請點擊上方按鈕建立。</p>
                ) : (
                  followUps.map((fu) => (
                    <div key={fu.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{fu.method}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">{formatDateTaipei(fu.contactTime, true)}</span>
                          <span className="text-slate-500">by {fu.recordedBy}</span>
                        </div>
                        {fu.isEffectiveFollowUp && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                            ✓ 符合有效追蹤 (14天內)
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700"><strong>洽談：</strong>{fu.summary}</p>
                      <p className="text-slate-700"><strong>客戶反饋：</strong>{fu.customerResponse}</p>
                      <p className="text-slate-700"><strong>下一步：</strong>{fu.nextStep}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 帶看行程 */}
            {activeTab === 'viewings' && (
              <div className="space-y-2.5">
                {viewings.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">尚無帶看行程。</p>
                ) : (
                  viewings.map((vw) => (
                    <div key={vw.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          時間：{formatDateTaipei(vw.scheduledTime, true)} · 接待：{vw.receptionistName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            vw.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : vw.status === 'SCHEDULED'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {vw.status === 'COMPLETED' ? '已完成帶看' : vw.status === 'SCHEDULED' ? '已預約' : '已取消'}
                        </span>
                      </div>
                      {vw.customerFeedback && <p className="text-slate-700"><strong>客戶回饋：</strong>{vw.customerFeedback}</p>}
                      {vw.objections && <p className="text-slate-600"><strong>抗性分析：</strong>{vw.objections}</p>}
                      {vw.nextStep && <p className="text-slate-700"><strong>下一步：</strong>{vw.nextStep}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 續期歷程 */}
            {activeTab === 'renewals' && (
              <div className="space-y-2.5">
                {renewals.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">尚未有續期申請紀錄。</p>
                ) : (
                  renewals.map((rn) => (
                    <div key={rn.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          申請時間：{formatDateTaipei(rn.createdAt, true)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rn.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rn.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rn.status === 'APPROVED' ? '核准展延' : rn.status === 'PENDING' ? '待代銷中心審核' : '駁回'}
                        </span>
                      </div>
                      <p className="text-slate-700"><strong>門店事由：</strong>{rn.reason}</p>
                      {rn.reviewReason && (
                        <p className="text-slate-700">
                          <strong>中心審核意見 ({rn.reviewerId || '代銷中心'})：</strong>{rn.reviewReason}
                        </p>
                      )}
                      {rn.newExpiryDate && (
                        <p className="text-emerald-700 font-semibold">
                          新保留到期日：{formatDateTaipei(rn.newExpiryDate)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 交易申報 */}
            {activeTab === 'transactions' && (
              <div className="space-y-2.5">
                {transactions.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">尚無交易申報紀錄。</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          總價：{formatCurrencyNTD(tx.dealPrice, true)} · 訂金：{formatCurrencyNTD(tx.depositAmount || 0)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          {tx.stage}
                        </span>
                      </div>
                      <p className="text-slate-600">申報備註：{tx.reportNote}</p>
                      {tx.centerConfirmNote && (
                        <p className="text-emerald-700">
                          <strong>中心覆核意見 ({tx.centerConfirmedBy || '代銷中心'})：</strong>{tx.centerConfirmNote}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 重複判定歷程 */}
            {activeTab === 'conflicts' && (
              <div className="space-y-2.5">
                {(!registration.conflictHistory || registration.conflictHistory.length === 0) ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800">
                    <p className="font-bold">當前正處於跨門店重複登記待判定狀態</p>
                    <p className="text-[11px] mt-1">代銷中心管理者將進行雙方接觸紀錄查核並裁定歸屬。</p>
                  </div>
                ) : (
                  registration.conflictHistory.map((ch: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          裁定結果：{ch.action === 'APPROVED' ? '核准改派並生效新保留' : ch.action === 'SUPERSEDED' ? '裁定終止原保留' : ch.action === 'SUBMITTED' ? '送件申請待判定' : '駁回重複申請'}
                        </span>
                        <span className="text-[11px] text-slate-500">{formatDateTaipei(ch.timestamp, true)}</span>
                      </div>
                      <p className="text-slate-700"><strong>裁定人員：</strong>{ch.operatorName || ch.operatorId}</p>
                      <p className="text-slate-700"><strong>裁定理由與判斷依據：</strong>{ch.reason}</p>
                      {ch.previousStoreId && (
                        <p className="text-[11px] text-slate-500">
                          原所屬門店代號：{ch.previousStoreId}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部 */}
        <div className="p-3 sm:px-6 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};

