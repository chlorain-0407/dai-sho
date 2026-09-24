import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';
import { Project, ProjectAssignment, AssignmentStatus, AssignmentImpactInfo } from '../../types';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  XCircle,
  Users,
  Clock,
  FileCheck,
  Info,
} from 'lucide-react';

interface AssignmentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  assignment: ProjectAssignment;
  targetStatus: AssignmentStatus;
  onSuccess: () => void;
}

export const AssignmentStatusModal: React.FC<AssignmentStatusModalProps> = ({
  isOpen,
  onClose,
  project,
  assignment,
  targetStatus,
  onSuccess,
}) => {
  const { addToast } = useApp();

  const [impact, setImpact] = useState<AssignmentImpactInfo | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(true);
  const [reason, setReason] = useState('');
  const [salesNotesForStore, setSalesNotesForStore] = useState(assignment.salesNotesForStore || '');
  const [internalNotes, setInternalNotes] = useState(assignment.internalNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoadingImpact(true);
    apiClient
      .getAssignmentImpact(project.id, assignment.id)
      .then((data) => {
        if (mounted) {
          setImpact(data);
          setIsLoadingImpact(false);
        }
      })
      .catch((err) => {
        console.error('Impact check error:', err);
        if (mounted) setIsLoadingImpact(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, project.id, assignment.id]);

  if (!isOpen) return null;

  const isPausing = targetStatus === 'PAUSED';
  const isRevoking = targetStatus === 'REVOKED';
  const isResuming = targetStatus === 'ACTIVE';

  const actionTitle = isPausing ? '暫停門店銷售指派' : isRevoking ? '撤銷門店銷售指派' : '恢復門店銷售指派';
  const actionColor = isPausing ? 'amber' : isRevoking ? 'rose' : 'emerald';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      addToast({
        type: 'warning',
        title: '請填寫變更原因',
        message: '依聯銷稽核要求，變更指派狀態必須填寫具體業務原因。',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.updateAssignmentStatus(project.id, assignment.id, {
        status: targetStatus,
        reason: reason.trim(),
        salesNotesForStore: salesNotesForStore.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
      });

      addToast({
        type: 'success',
        title: '指派狀態已更新',
        message: res.message || `門店「${assignment.storeName}」之指派狀態已調整為 [${targetStatus}]。`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '更新指派狀態失敗',
        message: err.message || '伺服器處理錯誤',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 text-white ${
            isPausing ? 'bg-amber-600' : isRevoking ? 'bg-rose-700' : 'bg-emerald-700'
          }`}
        >
          <div className="flex items-center gap-3">
            {isPausing && <PauseCircle className="w-6 h-6 text-amber-200" />}
            {isRevoking && <XCircle className="w-6 h-6 text-rose-200" />}
            {isResuming && <PlayCircle className="w-6 h-6 text-emerald-200" />}
            <div>
              <h3 className="font-bold text-base">{actionTitle}</h3>
              <p className="text-xs text-white/80">
                建案：{project.name} ➔ 目標門店：{assignment.storeName} ({assignment.storeCode})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-black/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* 影響事項提示 (受影響事項評估) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  受影響事項與現有業務資產評估
                </span>
                {isLoadingImpact && <span className="text-slate-400">評估載入中...</span>}
              </div>

              {impact && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 block">有效保留客戶</span>
                    <span className="text-lg font-black text-rose-600">
                      {impact.activeReservedCustomersCount} <span className="text-xs font-normal">位</span>
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 block">待審展期申請</span>
                    <span className="text-lg font-black text-amber-600">
                      {impact.pendingExtensionCount} <span className="text-xs font-normal">筆</span>
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 block">進行中交易申報</span>
                    <span className="text-lg font-black text-indigo-600">
                      {impact.inProgressTransactionsCount} <span className="text-xs font-normal">筆</span>
                    </span>
                  </div>
                </div>
              )}

              {/* 權益保障說明 */}
              <div className="text-[11px] text-slate-600 leading-relaxed space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                {isPausing && (
                  <>
                    <p className="font-bold text-amber-800">
                      • 暫停指派影響：門店將無法新增客戶登記與預約帶看。
                    </p>
                    <p className="text-slate-600">
                      • 權益保護承諾：既有有效保留客戶之專屬保護期與已申報交易歷程不受影響；中心可隨時執行恢復。
                    </p>
                  </>
                )}
                {isRevoking && (
                  <>
                    <p className="font-bold text-rose-800">
                      • 撤銷指派影響：終止門店對此建案的銷售授權，該門店從前線案源清單移除。
                    </p>
                    <p className="text-slate-600">
                      • 權益保護承諾：既有客戶於登記時鎖定之分佣快照依然不可篡改，歷史申報案件依法存檔核發佣金。
                    </p>
                  </>
                )}
                {isResuming && (
                  <>
                    <p className="font-bold text-emerald-800">
                      • 恢復指派效益：重啟門店銷售授權，門店經紀人可立即於前線開展推案並登記新客戶。
                    </p>
                    <p className="text-slate-600">
                      • 業務要求：將重新校驗建案目前是否為「上架中」及門店是否為「啟用中」。
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* 變更原因 (必填) */}
            <div>
              <label className="block font-bold text-slate-800 text-xs mb-1">
                變更原因 <span className="text-rose-600">*必填（保存於系統歷程）</span>
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isPausing
                    ? '例如：接待中心戶別調整中，暫停全區預約登記兩週'
                    : isRevoking
                    ? '例如：門店主動提請結案，或加盟合約調整終止聯銷合作'
                    : '例如：接待中心整修完畢，恢復正常對外聯銷授權'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white"
              />
            </div>

            {/* 門店可見的銷售說明 (選填) */}
            <div>
              <label className="block font-bold text-slate-800 text-xs mb-1">
                門店可見的銷售說明 <span className="text-slate-400 font-normal">（選填，獲指派門店可見）</span>
              </label>
              <textarea
                rows={2}
                value={salesNotesForStore}
                onChange={(e) => setSalesNotesForStore(e.target.value)}
                placeholder="更新或補充給門店人員查閱的重點叮嚀..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white leading-relaxed"
              />
            </div>

            {/* 中心內部備註 (選填，僅中心可見) */}
            <div>
              <label className="block font-bold text-slate-800 text-xs mb-1">
                中心內部備註 <span className="text-rose-600 font-normal">（僅代銷中心可見）</span>
              </label>
              <textarea
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="記錄內部評估決策依據，門店端絕對無法查看..."
                className="w-full px-3 py-2 rounded-xl border border-rose-200 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 bg-rose-50/30 leading-relaxed"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-3.5 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs ${
                isPausing
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : isRevoking
                  ? 'bg-rose-700 hover:bg-rose-800'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? '處理中...' : `確認${actionTitle}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
