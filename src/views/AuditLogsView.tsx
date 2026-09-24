import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateTaipei } from '../rules';
import {
  ScrollText,
  Search,
  Filter,
  ShieldAlert,
  User,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { scopedData } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');

  const filteredLogs = scopedData.auditLogs.filter((log) => {
    if (selectedAction !== 'ALL' && log.actionType !== selectedAction) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchOp = log.operatorName ? log.operatorName.toLowerCase().includes(q) : false;
      const matchAction = log.actionType ? log.actionType.toLowerCase().includes(q) : false;
      const matchDetails = (log.summary || '').toLowerCase().includes(q);
      const matchReason = log.reason ? log.reason.toLowerCase().includes(q) : false;
      return matchOp || matchAction || matchDetails || matchReason;
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    const act = action || '';
    if (act.includes('RESOLVE') || act.includes('CONFLICT')) {
      return { label: '重複爭議裁決', color: 'bg-amber-100 text-amber-800' };
    }
    if (act.includes('RENEWAL_APPROVED') || act.includes('APPROVE')) {
      return { label: '保留續期核准', color: 'bg-emerald-100 text-emerald-800' };
    }
    if (act.includes('TRANSACTION_CONFIRM') || act.includes('CONFIRM')) {
      return { label: '交易進度覆核', color: 'bg-indigo-100 text-indigo-800' };
    }
    if (act.includes('COMMISSION')) {
      return { label: '分佣版本發布', color: 'bg-purple-100 text-purple-800' };
    }
    if (act.includes('REGISTER')) {
      return { label: '客戶專屬登記', color: 'bg-rose-100 text-rose-800' };
    }
    return { label: action, color: 'bg-slate-100 text-slate-700' };
  };

  return (
    <div className="space-y-6">
      {/* 標題與說明 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-rose-600" />
            全站關鍵操作與制度審核稽核軌跡
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            不可竄改之操作軌跡。詳實記錄操作者、時間戳記、異動標的與決策審核理由。
          </p>
        </div>
      </div>

      {/* 搜尋與過濾列 */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-xs">
        <div className="flex-1 min-w-[220px]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋操作者、動作或原因關鍵字..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        <div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
          >
            <option value="ALL">全部操作動作</option>
            <option value="CUSTOMER_REGISTER">客戶專屬登記</option>
            <option value="RENEWAL_APPROVED">保留續期核准</option>
            <option value="RENEWAL_REJECTED">保留續期駁回</option>
            <option value="CONFLICT_RESOLVE">重複爭議裁決</option>
            <option value="TRANSACTION_CONFIRM">交易覆核確認</option>
            <option value="COMMISSION_VERSION_PUBLISH">發布分佣版本</option>
            <option value="STORE_ASSIGN">門店案源指派</option>
          </select>
        </div>
      </div>

      {/* 稽核日誌列表 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">時間戳記</th>
                <th className="py-3 px-4">操作人員</th>
                <th className="py-3 px-4">操作類型</th>
                <th className="py-3 px-4">操作標的</th>
                <th className="py-3 px-4">決策審核理由／詳細紀錄</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    目前無符合之稽核紀錄。
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const badge = getActionBadge(log.actionType);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {formatDateTaipei(log.timestamp, true)}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{log.operatorName}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {log.role === 'center_admin'
                            ? '代銷中心總部'
                            : log.role === 'store_manager'
                            ? '門店店長'
                            : '專案業務'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{log.entityType}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ID: {log.entityId.slice(0, 14)}...
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-md">
                        {log.reason && (
                          <div className="font-medium text-slate-800 bg-slate-50 p-1.5 rounded-lg border border-slate-200 mb-1">
                            <strong>理由：</strong>{log.reason}
                          </div>
                        )}
                        <p className="text-slate-600 text-xs">
                          {log.summary}
                        </p>
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
  );
};
