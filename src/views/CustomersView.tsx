import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CustomerRegistration, ReservationStatus } from '../types';
import {
  formatDateTaipei,
  formatCurrencyNTD,
  getRegistrationBadge,
  calculateReservationStatus,
  maskPhone,
  formatBuildingUnit,
} from '../rules';
import { repository } from '../services/repository';
import {
  Users,
  Clock,
  AlertTriangle,
  UserPlus,
  MessageSquareText,
  CalendarCheck,
  BadgeDollarSign,
  Search,
  Filter,
  Percent,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface CustomersViewProps {
  onOpenRegisterModal: () => void;
  onSelectCustomer: (reg: CustomerRegistration) => void;
  onOpenFollowUp: (reg: CustomerRegistration) => void;
  onOpenViewing: (reg: CustomerRegistration) => void;
  onOpenRenewal: (reg: CustomerRegistration) => void;
  onOpenReportTransaction: (reg: CustomerRegistration) => void;
  onOpenResolveConflict: (reg: CustomerRegistration) => void;
  onOpenReviewRenewal?: (req: any) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onOpenRegisterModal,
  onSelectCustomer,
  onOpenFollowUp,
  onOpenViewing,
  onOpenRenewal,
  onOpenReportTransaction,
  onOpenResolveConflict,
  onOpenReviewRenewal,
}) => {
  const {
    scopedData,
    currentUser,
    allUsers,
    customerFilterStatus,
    setCustomerFilterStatus,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedStoreId, setSelectedStoreId] = useState('ALL');

  const filteredRegistrations = scopedData.registrations.filter((reg) => {
    // 狀態過濾
    if (customerFilterStatus && customerFilterStatus !== 'ALL') {
      if (reg.status !== customerFilterStatus) return false;
    }
    // 建案過濾
    if (selectedProjectId !== 'ALL' && reg.projectId !== selectedProjectId) return false;
    // 門店過濾
    if (selectedStoreId !== 'ALL' && reg.storeId !== selectedStoreId) return false;
    // 關鍵字搜尋
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const customer = scopedData.customers.find((c) => c.id === reg.customerId);
      const matchName = customer?.name ? customer.name.toLowerCase().includes(q) : false;
      const matchPhone = customer?.phone ? customer.phone.toLowerCase().includes(q) : false;
      const matchNotes = reg.notes ? reg.notes.toLowerCase().includes(q) : false;
      return matchName || matchPhone || matchNotes;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 標題與新增按鈕 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-rose-600" />
            客戶登記與 30 天專屬保留管理
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            歸屬以「客戶＋建案」為單位。登記即享 30 天排他專屬保護，並立即鎖定不可覆寫分佣快照。
          </p>
        </div>

        <button
          onClick={onOpenRegisterModal}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" /> 登記新客戶 (起算30天)
        </button>
      </div>

      {/* 狀態標籤頁籤切換 */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setCustomerFilterStatus('ALL')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            !customerFilterStatus || customerFilterStatus === 'ALL'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          全數客戶 ({scopedData.registrations.length})
        </button>
        <button
          onClick={() => setCustomerFilterStatus('ACTIVE')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            customerFilterStatus === 'ACTIVE'
              ? 'bg-emerald-600 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          專屬保留中 ({scopedData.registrations.filter((r) => r.status === 'ACTIVE').length})
        </button>
        <button
          onClick={() => setCustomerFilterStatus('EXPIRING_SOON')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
            customerFilterStatus === 'EXPIRING_SOON'
              ? 'bg-rose-600 text-white font-semibold'
              : 'text-rose-600 hover:bg-rose-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          7天內即將到期 ({scopedData.registrations.filter((r) => r.status === 'EXPIRING_SOON').length})
        </button>
        <button
          onClick={() => setCustomerFilterStatus('CONFLICT_PENDING')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
            customerFilterStatus === 'CONFLICT_PENDING'
              ? 'bg-amber-500 text-white font-semibold'
              : 'text-amber-700 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          重複待判定 ({scopedData.registrations.filter((r) => r.status === 'CONFLICT_PENDING').length})
        </button>
        <button
          onClick={() => setCustomerFilterStatus('EXPIRED')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            customerFilterStatus === 'EXPIRED'
              ? 'bg-slate-700 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          已逾期失效 ({scopedData.registrations.filter((r) => r.status === 'EXPIRED').length})
        </button>
        <button
          onClick={() => setCustomerFilterStatus('CONVERTED')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            customerFilterStatus === 'CONVERTED'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          已成交結案 ({scopedData.registrations.filter((r) => r.status === 'CONVERTED').length})
        </button>
        <button
          onClick={() => setCustomerFilterStatus('RENEWALS_TAB' as any)}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
            (customerFilterStatus as string) === 'RENEWALS_TAB'
              ? 'bg-purple-600 text-white font-semibold'
              : 'text-purple-700 hover:bg-purple-50'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          {currentUser.role === 'center_admin' ? '展期審核待辦' : '展期申請追蹤'} (
          {scopedData.renewals.filter((rn) => rn.status === 'PENDING').length})
        </button>
      </div>

      {/* 搜尋與篩選列 */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-xs">
        <div className="flex-1 min-w-[220px]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋客戶姓名或示範電話識別碼 (如 0912)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        <div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
          >
            <option value="ALL">全部建案 ({scopedData.projects.length})</option>
            {scopedData.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {currentUser.role === 'center_admin' && (
          <div>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
            >
              <option value="ALL">全部門店 ({scopedData.stores.length})</option>
              {scopedData.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 客戶登記清單表格 或 展期申請專屬審核/追蹤清單 */}
      {(customerFilterStatus as string) === 'RENEWALS_TAB' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-purple-900 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-purple-600" />
                {currentUser.role === 'center_admin' ? '30 天專屬保留展期審核待辦' : '展期申請追蹤與進度'}
              </h2>
              <p className="text-[11px] text-purple-700 mt-0.5">
                規範要求：申請續期需檢附 14 天內之有效追蹤或實地帶看紀錄。由代銷中心總部審核並留存稽核紀錄。
              </p>
            </div>
            <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2.5 py-1 rounded-full">
              共 {scopedData.renewals.length} 筆展期歷程
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">客戶／建案</th>
                  <th className="py-3 px-4">申請門店／業務</th>
                  <th className="py-3 px-4">原到期日</th>
                  <th className="py-3 px-4">申請展期天數</th>
                  <th className="py-3 px-4">展期事由與檢附紀錄</th>
                  <th className="py-3 px-4 text-center">審核狀態</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {scopedData.renewals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      目前無任何展期申請紀錄。
                    </td>
                  </tr>
                ) : (
                  scopedData.renewals.map((rn) => {
                    const reg = scopedData.registrations.find((r) => r.id === rn.customerRegistrationId);
                    const customer = scopedData.customers.find((c) => c.id === reg?.customerId);
                    const project = scopedData.projects.find((p) => p.id === reg?.projectId);
                    const store = scopedData.stores.find((s) => s.id === rn.storeId);
                    const agent = allUsers.find((u) => u.id === rn.agentId);

                    return (
                      <tr key={rn.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{customer?.name || '客戶'}</span>
                          <span className="text-[11px] text-slate-500">{project?.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-800 font-medium block">{store?.name}</span>
                          <span className="text-[11px] text-slate-500">{agent?.name || rn.agentId}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-600 font-mono">
                            {formatDateTaipei(rn.originalExpiryDate)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-purple-700">+{rn.requestedDays || 30} 天</span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-slate-800 line-clamp-1">{rn.reason}</p>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            檢附：{rn.linkedRecordType === 'viewing' ? '實地帶看回報' : '有效追蹤紀錄'} ({rn.linkedRecordId})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {rn.status === 'PENDING' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              待中心審核
                            </span>
                          )}
                          {rn.status === 'APPROVED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              已核准展期
                            </span>
                          )}
                          {rn.status === 'REJECTED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              已駁回
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {rn.status === 'PENDING' && currentUser.role === 'center_admin' ? (
                            <button
                              onClick={() => onOpenReviewRenewal?.(rn)}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                            >
                              審核
                            </button>
                          ) : (
                            <button
                              onClick={() => reg && onSelectCustomer(reg)}
                              className="text-slate-500 hover:text-slate-900 font-medium hover:underline text-[11px]"
                            >
                              查看客戶
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">客戶姓名</th>
                <th className="py-3 px-4">示範聯絡識別碼</th>
                <th className="py-3 px-4">意向建案／戶別</th>
                <th className="py-3 px-4">承辦門店／業務</th>
                <th className="py-3 px-4">30天保留到期日</th>
                <th className="py-3 px-4 text-center">保留狀態</th>
                <th className="py-3 px-4">鎖定分佣快照</th>
                <th className="py-3 px-4 text-right">作業</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    目前無符合篩選條件之客戶登記資料。
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg) => {
                  const customer = scopedData.customers.find((c) => c.id === reg.customerId);
                  const project = scopedData.projects.find((p) => p.id === reg.projectId);
                  const unit = scopedData.units.find((u) => u.id === reg.intendedUnitId);
                  const store = scopedData.stores.find((s) => s.id === reg.storeId);
                  const agent = allUsers.find((u) => u.id === reg.agentId);
                  const snapshot = scopedData.commissionSnapshots.find(
                    (s) => s.id === reg.commissionSnapshotId
                  );
                  const resStatus = calculateReservationStatus(reg);
                  const renewalCount = scopedData.renewals.filter(
                    (r) => r.customerRegistrationId === reg.id && r.status === 'APPROVED'
                  ).length;
                  const badge = getRegistrationBadge(reg.status);
                  const canViewFullPhone = currentUser.role === 'center_admin' || currentUser.storeId === reg.storeId;
                  const rawPhone = customer?.phone || reg.phone || '';
                  const displayPhone = canViewFullPhone ? rawPhone : maskPhone(rawPhone);

                  return (
                    <tr
                      key={reg.id}
                      onClick={() => onSelectCustomer(reg)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{customer?.name}</div>
                        <span className="text-[10px] text-slate-400">{customer?.source}</span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600">
                        {displayPhone}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{project?.name}</div>
                        <span className="text-[10px] text-slate-400">
                          {unit ? formatBuildingUnit(unit.building, unit.unitNumber) : '全案洽談'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-800">{store?.name}</div>
                        <span className="text-[10px] text-slate-500">{agent?.name}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {formatDateTaipei(reg.reservationExpiryDate)}
                        </div>
                        {reg.status !== 'EXPIRED' && reg.status !== 'CONVERTED' && (
                          <span
                            className={`text-[10px] font-bold ${
                              resStatus.daysLeft <= 7 ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            剩餘 {resStatus.daysLeft} 天 (展延 {renewalCount} 次)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 font-semibold text-emerald-800 text-[11px]">
                          <Percent className="w-3 h-3 text-emerald-600" />
                          {snapshot?.versionNumber || snapshot?.versionId || 'V1.0'}
                        </div>
                        <span className="text-[10px] text-slate-500 truncate block max-w-[140px]">
                          {snapshot?.basisDescription}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onOpenFollowUp(reg)}
                            title="新增追蹤紀錄"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                          >
                            <MessageSquareText className="w-3.5 h-3.5 text-rose-500" />
                          </button>

                          <button
                            onClick={() => onOpenViewing(reg)}
                            title="預約/回報帶看"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                          >
                            <CalendarCheck className="w-3.5 h-3.5 text-sky-500" />
                          </button>

                          {reg.status === 'CONFLICT_PENDING' && currentUser.role === 'center_admin' ? (
                            <button
                              onClick={() => onOpenResolveConflict(reg)}
                              className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs"
                            >
                              裁定
                            </button>
                          ) : (
                            <button
                              onClick={() => onOpenReportTransaction(reg)}
                              title="申報交易"
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                            >
                              <BadgeDollarSign className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
};
