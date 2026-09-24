import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { Project, Store } from '../../types';
import { Store as StoreIcon, X, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface AssignStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project;
}

export const AssignStoreModal: React.FC<AssignStoreModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const { currentUser, scopedData, refreshData, addToast } = useApp();

  const [projectId, setProjectId] = useState(project?.id || scopedData.projects[0]?.id || '');
  const [storeId, setStoreId] = useState(scopedData.stores[0]?.id || '');
  const [action, setAction] = useState<'ASSIGN' | 'REVOKE'>('ASSIGN');
  const [reason, setReason] = useState('擴大台北東區精華地段推案能量，指派加盟門店全權深耕銷售。');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentProject = scopedData.projects.find((p) => p.id === (project?.id || projectId));
  const currentStore = scopedData.stores.find((s) => s.id === storeId);

  // 檢查目前是否已指派
  const activeProjectId = project?.id || projectId;
  const isCurrentlyAssigned = scopedData.assignments.some(
    (a) => a.projectId === activeProjectId && a.storeId === storeId && a.status === 'ACTIVE'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      addToast({
        type: 'error',
        title: '請填寫指派或解除理由',
        message: '權限異動必須詳細備註原因以供稽核。',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (action === 'ASSIGN') {
        await repository.assignStoreToProject(activeProjectId, storeId, currentUser, reason.trim());
      } else {
        await repository.revokeStoreAssignment(activeProjectId, storeId, currentUser, reason.trim());
      }

      await refreshData();
      addToast({
        type: action === 'ASSIGN' ? 'success' : 'warning',
        title: action === 'ASSIGN' ? '門店案源指派成功！' : '已解除門店銷售授權',
        message:
          action === 'ASSIGN'
            ? `「${currentStore?.name}」即日起享有「${currentProject?.name}」之代銷聯售與客戶登記權利。`
            : `已收回「${currentStore?.name}」對「${currentProject?.name}」的承辦授權。`,
      });
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '操作失敗',
        message: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <StoreIcon className="w-5 h-5 text-rose-600" />
            代銷中心 · 案源授權與門店指派管理
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p>
            <strong>案源管控機制：</strong>代銷中心全權掌控建商銷售代理權，逐案指派授權加盟門店。未獲指派之門店不可瀏覽底價亦不可建立該案之客戶登記。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {!project && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">選擇建案</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              >
                {scopedData.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.city}{p.district})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">目標加盟門店</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              >
                {scopedData.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">授權動作</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-800"
              >
                <option value="ASSIGN">新增指派授權 (ASSIGN)</option>
                <option value="REVOKE">解除/收回授權 (REVOKE)</option>
              </select>
            </div>
          </div>

          <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-600">
            目前狀態：
            {isCurrentlyAssigned ? (
              <span className="text-emerald-700 font-bold ml-1">已授權此門店銷售</span>
            ) : (
              <span className="text-slate-500 font-semibold ml-1">尚未授權</span>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              異動或指派說明理由 <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="請填寫授權調整原因..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-sm flex items-center gap-1.5 transition-colors ${
                action === 'ASSIGN'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> 確認執行授權調整
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
