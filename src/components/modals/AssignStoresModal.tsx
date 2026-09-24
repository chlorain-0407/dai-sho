import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';
import { Project, ProjectAssignment, Store, BatchAssignStoreItemResult } from '../../types';
import {
  X,
  Search,
  Filter,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Info,
  MapPin,
  Tag,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface AssignStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  existingAssignments: ProjectAssignment[];
  onSuccess: () => void;
}

export const AssignStoresModal: React.FC<AssignStoresModalProps> = ({
  isOpen,
  onClose,
  project,
  existingAssignments,
  onSuccess,
}) => {
  const { scopedData, addToast } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedSpecialty, setSelectedSpecialty] = useState('ALL');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [salesNotesForStore, setSalesNotesForStore] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchAssignStoreItemResult[] | null>(null);

  // 判斷建案是否允許指派 (規則 2：只有已上架 ON_SALE 的建案可新增指派)
  const isProjectOnSale = project.status === 'ON_SALE';

  // 取得有效指派之 storeId 集合
  const activeAssignedStoreIds = useMemo(() => {
    return new Set(
      existingAssignments
        .filter((a) => a.status === 'ACTIVE')
        .map((a) => a.storeId)
    );
  }, [existingAssignments]);

  // 取得已暫停或已撤銷之指派 (可用於標示重啟)
  const pausedOrRevokedStoreIds = useMemo(() => {
    return new Set(
      existingAssignments
        .filter((a) => a.status === 'PAUSED' || a.status === 'REVOKED')
        .map((a) => a.storeId)
    );
  }, [existingAssignments]);

  // 取得所有縣市選項
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    scopedData.stores.forEach((s) => {
      if (s.city) set.add(s.city);
    });
    return Array.from(set).sort();
  }, [scopedData.stores]);

  // 取得所有專長產品選項
  const specialtyOptions = useMemo(() => {
    const set = new Set<string>();
    scopedData.stores.forEach((s) => {
      (s.specialties || []).forEach((spec) => set.add(spec));
    });
    return Array.from(set).sort();
  }, [scopedData.stores]);

  // 篩選門店清單
  const filteredStores = useMemo(() => {
    return scopedData.stores.filter((store) => {
      // 搜尋關鍵字：門店名稱、代碼、電話、聯絡人
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchName = store.name ? store.name.toLowerCase().includes(q) : false;
        const matchCode = store.code ? store.code.toLowerCase().includes(q) : false;
        const matchContact = store.contactPerson ? store.contactPerson.toLowerCase().includes(q) : false;
        const matchDist = store.district ? store.district.toLowerCase().includes(q) : false;
        if (!matchName && !matchCode && !matchContact && !matchDist) return false;
      }

      // 縣市篩選
      if (selectedCity !== 'ALL' && store.city !== selectedCity) {
        return false;
      }

      // 擅長產品類型篩選
      if (selectedSpecialty !== 'ALL') {
        const specs = store.specialties || [];
        if (!specs.includes(selectedSpecialty)) return false;
      }

      return true;
    });
  }, [scopedData.stores, searchTerm, selectedCity, selectedSpecialty]);

  // 可勾選的門店 (排除非啟用狀態與已是有效指派的門店)
  const selectableStores = useMemo(() => {
    return filteredStores.filter((s) => s.status === 'ACTIVE' && !activeAssignedStoreIds.has(s.id));
  }, [filteredStores, activeAssignedStoreIds]);

  const toggleSelectStore = (storeId: string) => {
    setSelectedStoreIds((prev = []) =>
      (prev || []).includes(storeId) ? (prev || []).filter((id) => id !== storeId) : [...(prev || []), storeId]
    );
  };

  const handleSelectAll = () => {
    if ((selectedStoreIds || []).length === selectableStores.length) {
      setSelectedStoreIds([]);
    } else {
      setSelectedStoreIds(selectableStores.map((s) => s.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isProjectOnSale) {
      addToast({
        type: 'error',
        title: '無法新增指派',
        message: `建案目前非上架中狀態（當前狀態：${project.status}），僅已上架 (ON_SALE) 之建案可進行門店指派。`,
      });
      return;
    }

    if (selectedStoreIds.length === 0) {
      addToast({
        type: 'warning',
        title: '請選擇門店',
        message: '請至少勾選一家欲加入銷售的門店。',
      });
      return;
    }

    if (!reason.trim()) {
      addToast({
        type: 'warning',
        title: '請填寫指派原因',
        message: '依聯銷管理規章，指派原因為必填欄位。',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.batchAssignStores(project.id, {
        storeIds: selectedStoreIds,
        reason: reason.trim(),
        salesNotesForStore: salesNotesForStore.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
      });

      setBatchResults(res.results);

      const successCount = res.results.filter((r) => r.success).length;
      addToast({
        type: 'success',
        title: '門店指派完成',
        message: `成功指派 ${successCount} 家門店加入建案「${project.name}」銷售行列！`,
      });

      onSuccess();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '指派失敗',
        message: err.message || '伺服器處理錯誤',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/90 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">中心指派建案銷售門店</h3>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    isProjectOnSale ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {project.status === 'ON_SALE' ? '🟢 上架熱銷中 (可指派)' : `⚠️ 當前狀態：${project.status}`}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                目標建案：<span className="font-semibold text-white">{project.name}</span> · {project.city}
                {project.district} · {project.developer}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 建案非上架中警告 Banner */}
        {!isProjectOnSale && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">依業務規章：僅「上架中 (ON_SALE)」建案可新增或恢復門店指派</p>
              <p className="text-amber-700 mt-0.5">
                目前此建案狀態為「{project.status}」。請先至建案基本資料將狀態調整為「上架熱銷 (ON_SALE)」，方可指派加盟門店。
              </p>
            </div>
          </div>
        )}

        {/* 批次結果摘要對話框 (若已提交完成) */}
        {batchResults ? (
          <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> 指派結果處理報告
              </h4>
              <p className="text-xs text-emerald-700 mt-1">
                已依中心人工決策完成門店聯銷授權登記，指派歷程與原因已完整存檔留痕。
              </p>
            </div>

            <div className="space-y-2">
              {batchResults.map((r, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    r.success
                      ? 'bg-white border-emerald-200 text-slate-800'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {r.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span className="font-bold">{r.storeName}</span>
                  </div>
                  <span className={r.success ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                    {r.message}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                關閉並返回建案詳情
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* 篩選與搜尋工具列 */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-rose-600" /> 門店篩選與人工指派挑選
                  </span>
                  <span className="text-[11px] text-slate-500">
                    共找到 {filteredStores.length} 家門店 · 可指派 {selectableStores.length} 家
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="搜尋門店名稱、代碼、聯絡人..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="ALL">全部縣市區域</option>
                    {cityOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedSpecialty}
                    onChange={(e) => setSelectedSpecialty(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="ALL">全部擅長產品類型</option>
                    {specialtyOptions.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 門店候選清單 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      disabled={selectableStores.length === 0}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      {selectedStoreIds.length === selectableStores.length && selectableStores.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      全選可指派門店 ({selectableStores.length})
                    </button>
                    {selectedStoreIds.length > 0 && (
                      <span className="text-[11px] font-bold text-slate-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        已選擇 {selectedStoreIds.length} 家
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    ＊僅啟用中 (ACTIVE) 門店可接受指派；已在銷售名單中之門店不重複指派
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {filteredStores.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">沒有符合搜尋或篩選條件的門店</div>
                  ) : (
                    filteredStores.map((store) => {
                      const isAssigned = activeAssignedStoreIds.has(store.id);
                      const isPausedOrRevoked = pausedOrRevokedStoreIds.has(store.id);
                      const isStoreActive = store.status === 'ACTIVE';
                      const isSelected = (selectedStoreIds || []).includes(store.id);
                      const isDisabled = !isStoreActive || isAssigned;

                      return (
                        <div
                          key={store.id}
                          onClick={() => {
                            if (!isDisabled) toggleSelectStore(store.id);
                          }}
                          className={`p-3 flex items-center justify-between transition-colors ${
                            isDisabled
                              ? 'bg-slate-50/70 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-rose-50/50 cursor-pointer'
                              : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => {}}
                              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs">{store.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                  {store.code}
                                </span>
                                {isAssigned && (
                                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                                    ✓ 已在銷售名單
                                  </span>
                                )}
                                {isPausedOrRevoked && (
                                  <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">
                                    ↺ 原指派暫停/撤銷（可重啟）
                                  </span>
                                )}
                                {!isStoreActive && (
                                  <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold">
                                    門店非啟用狀態
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                <span>
                                  {store.city} {store.district}
                                </span>
                                {store.contactPerson && <span>聯絡人：{store.contactPerson}</span>}
                                {store.specialties && store.specialties.length > 0 && (
                                  <span className="text-slate-400">
                                    擅長：{store.specialties.slice(0, 3).join('、')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-[11px]">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                store.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              門店狀態：{store.status === 'ACTIVE' ? '啟用中' : store.status}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 必填與選填資訊欄位 */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                {/* 1. 指派原因 (必填) */}
                <div>
                  <label className="block font-bold text-slate-800 text-xs mb-1">
                    指派原因 <span className="text-rose-600">*必填（保存於系統歷程）</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="例如：2026年第二季北投區預售聯銷主力門店授權；擴大雙北高資產客群推案接觸點"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    ＊中心人工決定之業務理由，將完整存檔於指派歷程與中心稽核日誌。
                  </p>
                </div>

                {/* 2. 門店可見的銷售說明 (選填) */}
                <div>
                  <label className="block font-bold text-slate-800 text-xs mb-1">
                    門店可見的銷售說明 <span className="text-slate-400 font-normal">（選填，獲指派門店可見）</span>
                  </label>
                  <textarea
                    rows={2}
                    value={salesNotesForStore}
                    onChange={(e) => setSalesNotesForStore(e.target.value)}
                    placeholder="例如：請優先鎖定自住換屋及首購客群；預約實地帶看前需先至系統報備並提早2小時聯繫現場專案窗口。"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    ＊此欄位內容將顯示於被指派門店的「我的建案」與「建案詳情」中，協助前線經紀人掌握重點。
                  </p>
                </div>

                {/* 3. 中心內部備註 (選填，僅中心可見) */}
                <div>
                  <label className="block font-bold text-slate-800 text-xs mb-1">
                    中心內部備註 <span className="text-rose-600 font-normal">（機密保護，僅代銷中心可見）</span>
                  </label>
                  <textarea
                    rows={2}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="例如：本批門店預計推案評估期至6月底；首季達成3戶成交者提供額外獎勵激勵金，專案負責人依週報追蹤。"
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 bg-rose-50/30 leading-relaxed"
                  />
                  <p className="text-[10px] text-rose-500 mt-1">
                    ＊機密隔離保證：後端嚴格過濾白名單，非中心角色絕對無法從任何 API 讀取此欄位。
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
              <div className="text-[11px] text-slate-500">
                已選取 <span className="font-bold text-rose-600">{selectedStoreIds.length}</span> 家門店
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isProjectOnSale || selectedStoreIds.length === 0}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {isSubmitting ? '指派處理中...' : `確認指派 (${selectedStoreIds.length} 家門店)`}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
