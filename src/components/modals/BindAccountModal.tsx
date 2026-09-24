import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import {
  KeyRound,
  X,
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Unlink,
  ExternalLink,
} from 'lucide-react';

interface BindAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess?: () => void;
}

export const BindAccountModal: React.FC<BindAccountModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const { fetchAdminUsers, refreshData, addToast } = useApp();

  const [boundEmail, setBoundEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setBoundEmail(user.boundEmail || user.email || '');
      setErrorMessage(null);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleBind = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const emailToBind = boundEmail.trim();
    if (!emailToBind) {
      setErrorMessage('請輸入欲綁定的 Google 帳號電子郵件（Email）');
      return;
    }

    // Basic email format check
    if (!emailToBind.includes('@') || !emailToBind.includes('.')) {
      setErrorMessage('請輸入格式正確的電子郵件信箱');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.bindUserAccount(user.id, emailToBind);
      addToast({
        type: 'success',
        title: 'Google 帳號綁定成功',
        message: `同仁 [${user.name}] 已成功綁定 Google 帳號 (${emailToBind})。`,
      });

      await fetchAdminUsers();
      await refreshData();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Bind account error:', err);
      setErrorMessage(err.message || '綁定 Google 帳號失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnbind = async () => {
    if (!window.confirm(`確定要解除同仁 [${user.name}] 的 Google 帳號綁定嗎？\n解除後該同仁需重新綁定 Google 方能登入。`)) {
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.bindUserAccount(user.id, '');
      addToast({
        type: 'info',
        title: '已解除 Google 帳號綁定',
        message: `同仁 [${user.name}] 的登入身分已解除綁定，狀態已更新為待綁定。`,
      });

      await fetchAdminUsers();
      await refreshData();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Unbind account error:', err);
      setErrorMessage(err.message || '解除綁定失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadyBound = user.isBound || !!user.boundEmail;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              <KeyRound className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Google 登入身分綁定</h2>
              <p className="text-xs text-slate-400">
                將同仁檔案與其 Google Workspace 或個人 Google 帳號進行關聯
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

        <form onSubmit={handleBind} className="p-6 space-y-5 text-slate-800">
          {/* Target Personnel Info Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{user.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {user.title || '營業員'}
                </span>
              </div>
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                  isAlreadyBound
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {isAlreadyBound ? '已綁定登入帳號' : '尚未綁定 Google'}
              </span>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-3">
              <span>門店：{user.storeName || '待指派門店'}</span>
              {user.mobilePhone && <span>手機：{user.mobilePhone}</span>}
              {user.licenseNumber && <span>證照：{user.licenseNumber}</span>}
            </div>
          </div>

          {/* Binding Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              指定綁定之 Google 帳號 (Email)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={boundEmail}
                onChange={(e) => setBoundEmail(e.target.value)}
                placeholder="例：sales.lin@gmail.com 或 agent@pacific.com.tw"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong>三階段身分流程：</strong>中心建立人員資料 → 綁定 Google 信箱 → 總部審核開通。
              綁定成功後，同仁以 Google 登入即自動進入該門店業務視野。
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <div>
              {isAlreadyBound && (
                <button
                  type="button"
                  onClick={handleUnbind}
                  disabled={submitting}
                  className="text-xs text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  解除目前綁定
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
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
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? '綁定中...' : isAlreadyBound ? '更新綁定信箱' : '確認綁定帳號'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
