import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTaipei, formatCurrencyNTD } from '../rules';
import {
  Percent,
  Lock,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building2,
  Search,
  History,
  FileCheck,
} from 'lucide-react';
import { Project } from '../types';

interface CommissionViewProps {
  onOpenNewCommission: (project: Project) => void;
}

export const CommissionView: React.FC<CommissionViewProps> = ({ onOpenNewCommission }) => {
  const { scopedData, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'versions' | 'snapshots'>('versions');
  const [searchSnapshot, setSearchSnapshot] = useState('');

  const filteredSnapshots = scopedData.commissionSnapshots.filter((s) => {
    if (!searchSnapshot.trim()) return true;
    const q = searchSnapshot.toLowerCase();
    const reg = scopedData.registrations.find((r) => r.id === s.customerRegistrationId);
    const customer = scopedData.customers.find((c) => c.id === reg?.customerId);
    const project = scopedData.projects.find((p) => p.id === s.projectId);
    return (
      ((s.versionNumber || s.versionId || '') as string).toLowerCase().includes(q) ||
      (customer?.name ? customer.name.toLowerCase().includes(q) : false) ||
      (project?.name ? project.name.toLowerCase().includes(q) : false)
    );
  });

  return (
    <div className="space-y-6">
      {/* 標題與說明 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Percent className="w-6 h-6 text-rose-600" />
            分佣版本管理與不可覆寫快照
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            由代銷中心統一訂定分佣版本。客戶成功登記即自動建立並鎖定快照，杜絕事後糾紛。
          </p>
        </div>
      </div>

      {/* 快照鎖定核心制度保障卡片 */}
      <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-2xl border border-emerald-800 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600/30 text-emerald-400 shrink-0 border border-emerald-500/40">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-emerald-300">
              平台核心保障：登記即鎖定不可覆寫分佣快照 (Immutable Commission Snapshot)
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              當業務為客戶完成建案登記時，系統即時將當時有效之分佣版本欄位完整抄錄為專屬快照。代銷中心後續發布新版或調整佣金，原快照資料皆完全凍結不變，門店預期分佣權益獲 100% 絕對保障。
            </p>
          </div>
        </div>
      </div>

      {/* 頁籤切換 */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('versions')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'versions'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          建案有效分佣版本清單 ({scopedData.commissionVersions.length})
        </button>
        <button
          onClick={() => setActiveTab('snapshots')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'snapshots'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          已成立客戶分佣快照盤點 ({scopedData.commissionSnapshots.length})
        </button>
      </div>

      {/* 標籤一：建案分佣版本 */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scopedData.commissionVersions.map((cv) => {
              const project = scopedData.projects.find((p) => p.id === cv.projectId);

              return (
                <div
                  key={cv.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3 hover:border-slate-300 transition-all text-xs flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-900">
                            {project?.name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                            {cv.versionNumber}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          生效起算日：{formatDateTaipei(cv.effectiveDate)}
                        </span>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        目前有效版
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="text-slate-400 text-[11px] block">總分佣率</span>
                        <strong className="text-slate-900 text-sm mt-0.5 block">
                          {cv.percentage}%
                        </strong>
                      </div>
                      <div className="bg-emerald-50/80 rounded-lg p-1">
                        <span className="text-emerald-700 text-[11px] block font-bold">門店分配</span>
                        <strong className="text-emerald-800 text-sm mt-0.5 block">
                          {cv.storePercentage}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">代銷中心</span>
                        <strong className="text-slate-700 text-sm mt-0.5 block">
                          {cv.centerPercentage}%
                        </strong>
                      </div>
                    </div>

                    <p className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <strong>版本說明：</strong>{cv.note}
                    </p>
                  </div>

                  {currentUser.role === 'center_admin' && project && (
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => onOpenNewCommission(project)}
                        className="text-rose-600 font-semibold text-xs hover:underline flex items-center gap-1"
                      >
                        發布修訂新版本 →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 標籤二：已成立之客戶分佣快照清單 (檢驗不可覆寫) */}
      {activeTab === 'snapshots' && (
        <div className="space-y-4">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 text-xs">
            <Search className="w-4 h-4 text-slate-400 ml-1" />
            <input
              type="text"
              value={searchSnapshot}
              onChange={(e) => setSearchSnapshot(e.target.value)}
              placeholder="搜尋快照代碼、客戶姓名或建案名稱..."
              className="flex-1 bg-transparent border-none focus:outline-none"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">快照代號</th>
                    <th className="py-3 px-4">歸屬客戶／建案</th>
                    <th className="py-3 px-4">鎖定時間</th>
                    <th className="py-3 px-4">計佣公式基礎</th>
                    <th className="py-3 px-4">門店分佣比</th>
                    <th className="py-3 px-4">代銷中心比</th>
                    <th className="py-3 px-4 text-center">快照鎖定狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSnapshots.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        查無快照資料。
                      </td>
                    </tr>
                  ) : (
                    filteredSnapshots.map((snap) => {
                      const reg = scopedData.registrations.find(
                        (r) => r.id === snap.customerRegistrationId
                      );
                      const customer = scopedData.customers.find((c) => c.id === reg?.customerId);
                      const project = scopedData.projects.find((p) => p.id === snap.projectId);

                      return (
                        <tr key={snap.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {snap.versionNumber || snap.versionId}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900">{customer?.name}</span>
                            <span className="text-[10px] text-slate-500 block">{project?.name}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {formatDateTaipei(snap.lockedAt, true)}
                          </td>
                          <td className="py-3 px-4 max-w-[220px] truncate" title={snap.basisDescription}>
                            {snap.basisDescription}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-700">
                            {snap.formulaType === 'PERCENTAGE_TOTAL'
                              ? `${snap.storePercentage}% (總佣 ${snap.percentage}%)`
                              : `${snap.fixedAmount?.toLocaleString()} 元`}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {snap.formulaType === 'PERCENTAGE_TOTAL'
                              ? `${snap.centerPercentage}%`
                              : '代銷統籌'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <Lock className="w-3 h-3" />
                              唯讀已鎖定
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
