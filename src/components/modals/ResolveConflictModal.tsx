import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { CustomerRegistration } from '../../types';
import { formatDateTaipei, maskPhone } from '../../rules';
import { AlertTriangle, CheckCircle2, X, Store, UserCheck, ShieldAlert, XCircle, FileText } from 'lucide-react';

interface ResolveConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflictReg?: CustomerRegistration | null;
  registration?: CustomerRegistration | null;
}

export const ResolveConflictModal: React.FC<ResolveConflictModalProps> = ({
  isOpen,
  onClose,
  conflictReg,
  registration,
}) => {
  const { currentUser, scopedData, refreshData, addToast, allUsers } = useApp();

  const reg = conflictReg || registration;
  if (!isOpen || !reg) return null;

  const customer = scopedData.customers.find((c) => c.id === reg.customerId);
  const project = scopedData.projects.find((p) => p.id === reg.projectId);
  const conflictStore = scopedData.stores.find((s) => s.id === reg.storeId);
  const conflictAgent = allUsers.find((u) => u.id === reg.agentId);

  // 原始已登記紀錄
  const originalReg = scopedData.registrations.find(
    (r) => r.id === reg.conflictOriginalRegId || (r.phone === reg.phone && r.projectId === reg.projectId && r.id !== reg.id)
  );
  const originalStore = scopedData.stores.find((s) => s.id === originalReg?.storeId);
  const originalAgent = allUsers.find((u) => u.id === originalReg?.agentId);

  // 裁定決策類型：APPROVE (核准改派) 或 REJECT (駁回申請)
  const [action, setAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [assignStoreId, setAssignStoreId] = useState(reg.storeId || originalReg?.storeId || '');
  const [assignAgentId, setAssignAgentId] = useState(reg.agentId || originalReg?.agentId || '');
  const [resolutionReason, setResolutionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetStoreAgents = allUsers.filter(
    (u) => u.role === 'agent' && u.status === 'ACTIVE' && (assignStoreId ? u.storeId === assignStoreId : true)
  );

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionReason.trim()) {
      addToast({
        type: 'error',
        title: '請填寫裁定具體理由',
        message: '必須填寫判定依據並具名留存於操作紀錄中。',
      });
      return;
    }

    setSubmitting(true);
    try {
      await repository.resolveConflict({
        conflictRegId: reg.id,
        action,
        assignToStoreId: action === 'APPROVE' ? assignStoreId : undefined,
        assignToAgentId: action === 'APPROVE' ? assignAgentId : undefined,
        resolutionReason: resolutionReason.trim(),
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: 'success',
        title: action === 'APPROVE' ? '裁定核准完成' : '已裁定駁回爭議申請',
        message:
          action === 'APPROVE'
            ? '已正式生效新門店保留期 30 天，並終止原保留紀錄。'
            : '已駁回該重複登記申請，原保留維持不變。',
      });
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '裁定失敗',
        message: err.message || '操作未完成，請稍後重試。',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            代銷中心 · 處理客戶建案重複登記歸屬判定
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed space-y-1">
          <p>
            <strong>衝突檢核：</strong>客戶「{customer?.name}」（電話：{currentUser.role === 'center_admin' ? (customer?.phone || reg.phone) : maskPhone(customer?.phone || reg.phone)}）在建案「{project?.name}」出現跨門店重複登記。
          </p>
          <p className="text-[11px] text-amber-800">
            ★ 依平台規範：同案同客戶僅得由一家門店享有專屬保留期。原登記已到期或待判定時，皆由中心確認後決定是否重新登記，原保留到期後不得自動轉給其他門店。
          </p>
        </div>

        {/* 雙方送件紀錄完整比對 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase">【甲案】既有登記紀錄</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                {originalReg?.status || '既有保留'}
              </span>
            </div>
            <p className="font-bold text-slate-800">{originalStore?.name || '原始門店'}</p>
            <p className="text-slate-600">負責業務：{originalAgent?.name || '專案業務'}</p>
            <p className="text-slate-500 text-[11px]">登記時間：{formatDateTaipei(originalReg?.createdAt, true)}</p>
            <p className="text-slate-500 text-[11px]">原到期日：{formatDateTaipei(originalReg?.reservationExpiryDate)}</p>
            {originalReg?.notes && (
              <p className="text-slate-500 text-[11px] bg-white p-1.5 rounded border border-slate-200 mt-1">
                備註：{originalReg.notes}
              </p>
            )}
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 uppercase">【乙案】本次重複申請件</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">
                歸屬待判定
              </span>
            </div>
            <p className="font-bold text-slate-800">{conflictStore?.name || '新送件門店'}</p>
            <p className="text-slate-600">負責業務：{conflictAgent?.name || '專案業務'}</p>
            <p className="text-slate-500 text-[11px]">送件時間：{formatDateTaipei(reg.createdAt, true)}</p>
            <p className="text-slate-500 text-[11px]">意向戶別：{reg.intendedUnitId ? '已指定特定戶' : '尚未指定戶別'}</p>
            {reg.notes && (
              <p className="text-slate-600 text-[11px] bg-white p-1.5 rounded border border-amber-200 mt-1">
                備註：{reg.notes}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleResolve} className="space-y-4 text-xs">
          {/* 裁定決策類型選擇 */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">裁定動作</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  action === 'APPROVE'
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="action"
                  value="APPROVE"
                  checked={action === 'APPROVE'}
                  onChange={() => setAction('APPROVE')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    核准新申請（重啟30天保留）
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    終止原門店保留，改由新門店/業務承辦。保留期自核准生效日起重算30天，沿用送件時快照條件。
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  action === 'REJECT'
                    ? 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="action"
                  value="REJECT"
                  checked={action === 'REJECT'}
                  onChange={() => setAction('REJECT')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    駁回新申請（原保留維持不變）
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    原門店保留維持不變；本次新登記標示為已駁回，不產生有效保留，駁回紀錄具名留存備查。
                  </div>
                </div>
              </label>
            </div>
          </div>

          {action === 'APPROVE' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  核准指定門店 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignStoreId}
                  onChange={(e) => {
                    setAssignStoreId(e.target.value);
                    const firstAgent = allUsers.find(
                      (u) => u.role === 'agent' && u.storeId === e.target.value && u.status === 'ACTIVE'
                    );
                    if (firstAgent) setAssignAgentId(firstAgent.id);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium bg-white"
                >
                  {scopedData.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  核准指定業務 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignAgentId}
                  onChange={(e) => setAssignAgentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium bg-white"
                >
                  {targetStoreAgents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.title || '專案業務'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              代銷中心裁定依據與具名理由 <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={resolutionReason}
              onChange={(e) => setResolutionReason(e.target.value)}
              placeholder="請詳細敘明判定依據（如先後聯繫紀錄比對、客戶指名意向、帶看成效或逾期重啟之考量），將具名記錄於雙方歷程中..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>判定人員：{currentUser.name} ({currentUser.title || '總部管理者'})</span>
              <span>裁定時間：台北時間即時記錄</span>
            </div>
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
              className={`px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? '裁定寫入中...' : action === 'APPROVE' ? '確認核准並重啟30天保留' : '確認駁回爭議申請'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
