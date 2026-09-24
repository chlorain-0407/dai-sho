import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { RenewalRequest } from '../../types';
import { formatDateTaipei, calculateNewExpiryDate } from '../../rules';
import { CheckCircle2, XCircle, X, ShieldAlert, Calendar } from 'lucide-react';

interface ReviewRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: RenewalRequest | null;
}

export const ReviewRenewalModal: React.FC<ReviewRenewalModalProps> = ({
  isOpen,
  onClose,
  request,
}) => {
  const { currentUser, scopedData, refreshData, addToast, allUsers } = useApp();
  const [reviewReason, setReviewReason] = useState('經查核實地帶看與客戶洽談進度明確，核准延長保留30天。');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !request) return null;

  const reg = scopedData.registrations.find((r) => r.id === request.customerRegistrationId);
  const customer = scopedData.customers.find((c) => c.id === reg?.customerId);
  const project = scopedData.projects.find((p) => p.id === reg?.projectId);
  const store = scopedData.stores.find((s) => s.id === request.storeId);
  const agent = allUsers.find((u) => u.id === request.agentId);

  // 計算預計核准後的新到期日
  const projectedNewExpiry = calculateNewExpiryDate(request.originalExpiryDate, new Date(), 30);

  const handleReview = async (approved: boolean) => {
    if (!reviewReason.trim()) {
      addToast({
        type: 'error',
        title: '請輸入審核意向理由',
        message: '審核紀錄將具名留存於系統操作稽核日誌中。',
      });
      return;
    }

    setSubmitting(true);
    try {
      await repository.reviewRenewal({
        renewalId: request.id,
        approved,
        reviewReason: reviewReason.trim(),
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: approved ? 'success' : 'warning',
        title: approved ? '續期申請已核准' : '續期申請已駁回',
        message: approved
          ? `已將專屬保留期延長30天至 ${formatDateTaipei(projectedNewExpiry)}。`
          : '已駁回該次續期申請，維持原到期保留政策。',
      });
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '審核失敗',
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
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            代銷中心 · 審核保留續期申請
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">申請門店／業務：</span>
            <strong className="text-slate-800">
              {store?.name} · {agent?.name}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">客戶姓名：</span>
            <strong className="text-slate-800">{customer?.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">意向建案：</span>
            <strong className="text-slate-800">{project?.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">原保留到期日：</span>
            <span className="text-slate-700 font-semibold">{formatDateTaipei(request.originalExpiryDate)}</span>
          </div>
          <div className="flex justify-between text-emerald-700 bg-emerald-50/80 p-1.5 rounded">
            <span>核准後展延到期日：</span>
            <strong className="font-bold">{formatDateTaipei(projectedNewExpiry)} (+30天)</strong>
          </div>
        </div>

        <div className="mb-3 p-3 bg-slate-100 rounded-xl text-xs">
          <span className="font-semibold text-slate-700 block mb-1">門店業務提出之理由：</span>
          <p className="text-slate-600 leading-relaxed italic">"{request.reason}"</p>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              代銷中心審核理由 <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleReview(false)}
              className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl flex items-center gap-1.5 transition-colors border border-rose-200"
            >
              <XCircle className="w-4 h-4" /> 駁回申請
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleReview(true)}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> 核准展延 30 天
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
