import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UnitStatus, Unit } from '../types';
import { UnitModal } from '../components/modals/UnitModal';
import { repository } from '../services/repository';
import { formatBuildingUnit } from '../rules';
import {
  Home,
  Lock,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  ShieldAlert,
  UserPlus,
  Car,
  AlertCircle,
  Edit3,
  Trash2,
  Search,
} from 'lucide-react';

interface UnitsViewProps {
  onOpenNewUnit: (projectId?: string) => void;
  onOpenRegisterModal: (projectId?: string) => void;
}

export const UnitsView: React.FC<UnitsViewProps> = ({
  onOpenNewUnit,
  onOpenRegisterModal,
}) => {
  const { scopedData, currentUser, refreshData, addToast } = useApp();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const filteredUnits = scopedData.units.filter((u) => {
    if (selectedProjectId !== 'ALL' && u.projectId !== selectedProjectId) return false;
    if (selectedStatus !== 'ALL' && u.status !== selectedStatus) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchUnit =
        (u.unitNumber ? u.unitNumber.toLowerCase().includes(q) : false) ||
        (u.building ? u.building.toLowerCase().includes(q) : false);
      const matchPattern = u.pattern ? u.pattern.toLowerCase().includes(q) : false;
      const matchNotes = u.notes ? u.notes.toLowerCase().includes(q) : false;
      return matchUnit || matchPattern || matchNotes;
    }
    return true;
  });

  const getStatusBadge = (status: UnitStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return { label: '可銷售', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'NEGOTIATING':
        return { label: '洽談保留', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'RESERVED_DEPOSIT':
        return { label: '已收訂保留', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'SIGNED':
        return { label: '已簽約', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'DEAL_CLOSED':
        return { label: '已成交結案', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'PAUSED':
        return { label: '暫停銷售', color: 'bg-slate-100 text-slate-700 border-slate-300' };
      case 'DISABLED':
        return { label: '已停用(歷史留存)', color: 'bg-rose-100 text-rose-800 border-rose-200' };
      default:
        return { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const handleDeleteUnit = async (u: Unit) => {
    const unitLabel = formatBuildingUnit(u.building, u.unitNumber);
    const confirmMsg = `確定要移除戶別「${unitLabel}」嗎？\n\n＊ 若已有交易、帶看或客戶意向，系統將自動轉為停用 (DISABLED) 狀態以保留歷史稽核軌跡。`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await repository.deleteUnit(u.id, currentUser);
      if (res?.action === 'DISABLED') {
        addToast({
          type: 'info',
          title: '戶別已轉為停用',
          message: res.message || '已有歷史關聯紀錄，已自動轉為停用狀態保留歷程。',
        });
      } else {
        addToast({
          type: 'success',
          title: '戶別已成功移除',
          message: `戶別「${unitLabel}」已順利刪除。`,
        });
      }
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '操作失敗',
        message: err.message || '伺服器處理錯誤',
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 標題與操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Home className="w-6 h-6 text-rose-600" />
            建案可售戶別與銷控盤點
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            控管各案戶別之格局、權狀坪數、車位與公開表價。
            {currentUser.role === 'center_admin' ? (
              <span className="text-rose-600 font-semibold ml-1">
                【代銷中心管理員模式】：底價已完整解鎖，可進行戶別編輯與銷控。
              </span>
            ) : (
              <span className="text-slate-600 font-medium ml-1">
                【門店模式】：建商底價屬總部最高機密已全數自動自後端剝除。
              </span>
            )}
          </p>
        </div>

        {currentUser.role === 'center_admin' && (
          <button
            onClick={() => onOpenNewUnit()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> 新增銷售戶別
          </button>
        )}
      </div>

      {/* 篩選工具列 */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋戶號 (如 18F-A)、棟別或格局..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
          />
        </div>

        <div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800 bg-white"
          >
            <option value="ALL">全部建案 ({scopedData.projects.length})</option>
            {scopedData.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800 bg-white"
          >
            <option value="ALL">全部銷售狀態</option>
            <option value="AVAILABLE">可銷售 (AVAILABLE)</option>
            <option value="NEGOTIATING">洽談保留 (NEGOTIATING)</option>
            <option value="RESERVED_DEPOSIT">已收訂保留 (RESERVED)</option>
            <option value="SIGNED">已簽約 (SIGNED)</option>
            <option value="DEAL_CLOSED">已成交結案 (DEAL_CLOSED)</option>
            <option value="PAUSED">暫停銷售 (PAUSED)</option>
            <option value="DISABLED">已停用 (DISABLED)</option>
          </select>
        </div>
      </div>

      {/* 戶別明細表格 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-3.5 px-4">建案名稱</th>
                <th className="py-3.5 px-4">戶別棟號</th>
                <th className="py-3.5 px-4">格局規劃</th>
                <th className="py-3.5 px-4">建物登記總坪數</th>
                <th className="py-3.5 px-4">車位規格</th>
                <th className="py-3.5 px-4 text-right">房屋開價</th>
                <th className="py-3.5 px-4 text-right">車位開價</th>
                <th className="py-3.5 px-4 text-right font-black text-slate-900">總開價 (萬元)</th>
                {currentUser.role === 'center_admin' && (
                  <th className="py-3.5 px-4 text-right text-rose-700 bg-rose-50/30">
                    <span className="inline-flex items-center gap-1">
                      <Lock className="w-3 h-3 text-rose-500" />
                      底價 (僅中心)
                    </span>
                  </th>
                )}
                <th className="py-3.5 px-4 text-center">銷控狀態</th>
                <th className="py-3.5 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={currentUser.role === 'center_admin' ? 11 : 10} className="py-12 text-center text-slate-400">
                    查無符合條件之戶別資料。
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => {
                  const project = scopedData.projects.find((p) => p.id === unit.projectId);
                  const statusInfo = getStatusBadge(unit.status);

                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {project?.name || '未知建案'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {formatBuildingUnit(unit.building, unit.unitNumber)}
                        </div>
                        <span className="text-[11px] text-slate-400">{unit.floor} 樓</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{unit.pattern || '未載'}</span>
                        {unit.notes && (
                          <p className="text-[10px] text-slate-500 truncate max-w-[120px]" title={unit.notes}>
                            {unit.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span>{unit.totalPing || unit.areaPings || 0} 坪</span>
                          {unit.includesParking ? (
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                              含車位
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                              車位另計
                            </span>
                          )}
                        </div>
                        {(unit.mainPing || unit.commonPing) && (
                          <span className="text-[10px] text-slate-400 block">
                            主 {unit.mainPing || '-'} 坪 · 公設 {unit.commonPing || '-'} 坪
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="text-slate-800 font-medium">{unit.parkingNumber || '無車位'}</span>
                        {unit.parkingType && (
                          <span className="text-[10px] text-slate-400 block">{unit.parkingType}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {unit.housePrice ? `${(unit.housePrice / 10000).toLocaleString('zh-TW')} 萬` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {unit.parkingPrice ? `${(unit.parkingPrice / 10000).toLocaleString('zh-TW')} 萬` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-rose-700 text-sm">
                        {unit.listPrice ? `${(unit.listPrice / 10000).toLocaleString('zh-TW')} 萬` : '未載'}
                      </td>

                      {/* 底價：嚴格依角色權限渲染 */}
                      {currentUser.role === 'center_admin' && (
                        <td className="py-3.5 px-4 text-right font-bold text-rose-900 bg-rose-50/20">
                          {unit.bottomPrice !== undefined && unit.bottomPrice !== null ? (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="w-3 h-3 text-rose-500" />
                              {(unit.bottomPrice / 10000).toLocaleString('zh-TW')} 萬
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      )}

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {currentUser.role === 'center_admin' && (
                            <>
                              <button
                                onClick={() => setEditingUnit(unit)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                              >
                                編輯
                              </button>
                              <button
                                onClick={() => handleDeleteUnit(unit)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="移除或停用戶別"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onOpenRegisterModal(unit.projectId)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <UserPlus className="w-3 h-3 text-rose-400" /> 意向登記
                          </button>
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

      {/* 編輯戶別 Modal */}
      {editingUnit && (
        <UnitModal
          isOpen={Boolean(editingUnit)}
          onClose={() => setEditingUnit(null)}
          defaultProjectId={editingUnit.projectId}
          initialUnit={editingUnit}
        />
      )}
    </div>
  );
};
