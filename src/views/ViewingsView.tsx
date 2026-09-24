import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Viewing, ViewingStatus } from '../types';
import { formatDateTaipei, maskPhone, formatBuildingUnit } from '../rules';
import {
  CalendarCheck,
  MapPin,
  CheckCircle2,
  Clock,
  User,
  Plus,
  Home,
  MessageSquare,
  AlertCircle,
  XCircle,
} from 'lucide-react';

interface ViewingsViewProps {
  onOpenViewingModal: (viewing?: Viewing) => void;
}

export const ViewingsView: React.FC<ViewingsViewProps> = ({ onOpenViewingModal }) => {
  const { scopedData, currentUser } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredViewings = scopedData.viewings.filter((v) => {
    if (filterStatus === 'ALL') return true;
    return v.status === filterStatus;
  });

  const getViewingBadge = (status: ViewingStatus) => {
    switch (status) {
      case 'COMPLETED':
        return { label: '已完成帶看', color: 'bg-emerald-100 text-emerald-800' };
      case 'SCHEDULED':
        return { label: '已排程預約', color: 'bg-sky-100 text-sky-800' };
      case 'CANCELLED':
        return { label: '已取消', color: 'bg-slate-200 text-slate-700' };
      case 'NO_SHOW':
        return { label: '未到場', color: 'bg-rose-100 text-rose-800' };
      default:
        return { label: status, color: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題與說明 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-rose-600" />
            現場實地帶看行程與客戶回饋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            落實案場接待登記與回饋填寫。完成帶看並留存回饋為 30 天保留期續期之法定有效要件。
          </p>
        </div>

        <button
          onClick={() => onOpenViewingModal()}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> 預約/回報實地帶看
        </button>
      </div>

      {/* 狀態過濾標籤 */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterStatus === 'ALL'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          全數帶看 ({scopedData.viewings.length})
        </button>
        <button
          onClick={() => setFilterStatus('SCHEDULED')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterStatus === 'SCHEDULED'
              ? 'bg-sky-600 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          已預約待帶看 ({scopedData.viewings.filter((v) => v.status === 'SCHEDULED').length})
        </button>
        <button
          onClick={() => setFilterStatus('COMPLETED')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterStatus === 'COMPLETED'
              ? 'bg-emerald-600 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          已完成實地帶看 ({scopedData.viewings.filter((v) => v.status === 'COMPLETED').length})
        </button>
      </div>

      {/* 帶看卡片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredViewings.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            目前無相關帶看行程。
          </div>
        ) : (
          filteredViewings.map((vw) => {
            const project = scopedData.projects.find((p) => p.id === vw.projectId);
            const unit = scopedData.units.find((u) => u.id === vw.unitId);
            const reg = scopedData.registrations.find((r) => r.id === vw.customerRegistrationId);
            const customer = scopedData.customers.find((c) => c.id === reg?.customerId);
            const store = scopedData.stores.find((s) => s.id === reg?.storeId);
            const badge = getViewingBadge(vw.status);
            const canViewFullPhone = currentUser.role === 'center_admin' || currentUser.storeId === reg?.storeId;
            const phoneDisplay = canViewFullPhone ? (customer?.phone || '') : maskPhone(customer?.phone || '');

            return (
              <div
                key={vw.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3.5 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-base font-bold text-slate-900 block">
                        {customer?.name}（{phoneDisplay}）
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {project?.name} · {unit ? formatBuildingUnit(unit.building, unit.unitNumber) : '全案樣品屋參觀'}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">帶看預約時間：</span>
                      <strong className="text-slate-800">
                        {formatDateTaipei(vw.scheduledTime, true)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">現場接待人員：</span>
                      <span className="text-slate-700">{vw.receptionistName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">所屬門店：</span>
                      <span className="text-slate-700">{store?.name}</span>
                    </div>
                  </div>

                  {vw.customerFeedback && (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
                      <span className="text-emerald-900 font-bold block">客戶反應回饋：</span>
                      <p className="text-slate-700 leading-relaxed">{vw.customerFeedback}</p>
                      {vw.objections && (
                        <p className="text-slate-600 text-[11px] pt-0.5">
                          <strong>客戶顧慮抗性：</strong>{vw.objections}
                        </p>
                      )}
                    </div>
                  )}

                  {vw.nextStep && (
                    <p className="text-xs text-slate-600">
                      <strong>明確下一步：</strong>{vw.nextStep}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    登記時間：{formatDateTaipei(vw.createdAt)}
                  </span>
                  <button
                    onClick={() => onOpenViewingModal(vw)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    編輯回報結果 →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
