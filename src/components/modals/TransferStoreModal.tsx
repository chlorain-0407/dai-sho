import React, { useState, useEffect } from 'react';
import { User, Store } from '../../types';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import {
  ArrowRightLeft,
  X,
  Building2,
  Users,
  AlertCircle,
  CheckCircle2,
  FileBadge,
  ShieldAlert,
} from 'lucide-react';

interface TransferStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess?: () => void;
}

export const TransferStoreModal: React.FC<TransferStoreModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const { scopedData, adminUsers, fetchAdminUsers, refreshData, addToast } = useApp();

  const [targetStoreId, setTargetStoreId] = useState('');
  const [handoverUserId, setHandoverUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available stores (exclude current store)
  const availableStores = scopedData.stores.filter((s) => s.id !== user?.storeId);

  // Potential handover candidates (active staff, not the current user)
  const candidateUsers = (adminUsers && adminUsers.length > 0 ? adminUsers : (scopedData as any).allStorePersonnel || []).filter(
    (u: User) => u.id !== user?.id && u.status === 'ACTIVE'
  );

  // Pending items under this user
  const userRegistrations = scopedData.registrations.filter(
    (r) => r.agentId === user?.id && r.status === 'ACTIVE'
  );
  const userTransactions = scopedData.transactions.filter(
    (t) =>
      t.agentId === user?.id &&
      (t.stage === 'DEPOSIT_REPORTED' || t.stage === 'CONTRACT_REPORTED' || t.stage === 'DEAL_REPORTED')
  );

  useEffect(() => {
    if (isOpen) {
      setTargetStoreId(availableStores[0]?.id || '');
      setHandoverUserId('');
      setReason('');
      setErrorMessage(null);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const currentStore = scopedData.stores.find((s) => s.id === user.storeId);
  const hasPendingItems = userRegistrations.length > 0 || userTransactions.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!targetStoreId) {
      setErrorMessage('請選擇欲調入之新門店');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('請填寫調店理由（必填稽核備註）');
      return;
    }

    if (hasPendingItems && !handoverUserId) {
      setErrorMessage(`該同仁名下尚有 ${userRegistrations.length} 位進行中客戶及 ${userTransactions.length} 筆交易，請指定業務接手同仁進行自動交接。`);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.transferUserStore(user.id, {
        targetStoreId,
        reason: reason.trim(),
        handoverUserId: handoverUserId || undefined,
      });

      addToast({
        type: 'success',
        title: '同仁調店與交接完成',
        message: `同仁 [${user.name}] 已成功調派至新門店，進行中業務已完成轉移。`,
      });

      await fetchAdminUsers();
      await refreshData();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Transfer user store error:', err);
      setErrorMessage(err.message || '調店處理失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-600/30 text-amber-400 border border-amber-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold">人員調店與業務交接</h2>
              <p className="text-xs text-slate-400">
                跨店人員調動規範：轉移前將名下客戶保護與申報案件安全交接
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1 text-slate-800">
          {/* Current Staff Info */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900">{user.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {user.title || '營業員'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                目前所屬：<strong>{currentStore?.name || user.storeName || '待指派門店'}</strong> ({currentStore?.code})
              </p>
            </div>

            <div className="text-right text-xs">
              <span className="text-slate-400 block">名下進行中案件</span>
              <span className="text-amber-700 font-bold">
                {userRegistrations.length} 客戶 / {userTransactions.length} 交易
              </span>
            </div>
          </div>

          {/* Pending items warning */}
          {hasPendingItems && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                進行中業務交接保護機制
              </div>
              <p className="leading-relaxed">
                該同仁名下尚有 <strong>{userRegistrations.length} 位</strong> 保留期客戶與{' '}
                <strong>{userTransactions.length} 筆</strong> 進行中交易申報。
                為確保客戶權益與佣金結算，調店時系統將自動批次轉移負責人至您指定的接手同仁。
              </p>
            </div>
          )}

          {/* Section: Select Target Store */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              調入新加盟門店 <span className="text-rose-600 font-bold">*</span>
            </label>
            <select
              value={targetStoreId}
              onChange={(e) => setTargetStoreId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            >
              <option value="">-- 請選擇調入之門店 --</option>
              {availableStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) — {s.city}{s.district}
                </option>
              ))}
            </select>
          </div>

          {/* Section: Select Handover Recipient */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              指定業務接手人 {hasPendingItems && <span className="text-rose-600 font-bold">*</span>}
            </label>
            <select
              value={handoverUserId}
              onChange={(e) => setHandoverUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            >
              <option value="">
                {hasPendingItems ? '-- 請指定接手同仁（必選） --' : '-- 暫無進行中案件，可選填 --'}
              </option>
              {candidateUsers.map((u: User) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.storeName || '總部'} — {u.title || '營業員'})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              系統將保留原有的客戶建檔與帶看歷程，並將負責業務更新為接手人。
            </p>
          </div>

          {/* Section: Reason */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              調店理由與備註說明 <span className="text-rose-600 font-bold">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="例：配合竹北高鐵新分店成立籌備，轉調至特區店擔任副店長..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? '調店處理中...' : '確認調店並交接業務'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
