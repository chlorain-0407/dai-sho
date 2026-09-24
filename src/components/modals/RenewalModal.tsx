import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { checkRenewalEligibility, formatDateTaipei } from '../../rules';
import { CustomerRegistration } from '../../types';
import { Clock, AlertCircle, CheckCircle2, X, Link as LinkIcon, ShieldCheck } from 'lucide-react';

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration?: CustomerRegistration | null;
  registrationId?: string;
  customerName?: string;
  projectName?: string;
  currentExpiryDate?: string;
}

export const RenewalModal: React.FC<RenewalModalProps> = ({
  isOpen,
  onClose,
  registration,
  registrationId,
  customerName,
  projectName,
  currentExpiryDate,
}) => {
  const { currentUser, scopedData, refreshData, addToast } = useApp();

  const activeRegId = registration?.id || registrationId || '';
  const currentReg = registration || scopedData.registrations.find((r) => r.id === activeRegId);
  const activeCustomer = currentReg ? scopedData.customers.find((c) => c.id === currentReg.customerId) : undefined;
  const activeProject = currentReg ? scopedData.projects.find((p) => p.id === currentReg.projectId) : undefined;
  const activeCustomerName = customerName || activeCustomer?.name || '客戶';
  const activeProjectName = projectName || activeProject?.name || '建案';
  const activeExpiryDate = currentExpiryDate || currentReg?.reservationExpiryDate || new Date().toISOString();

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !activeRegId) return null;

  // 檢查是否已有待審續期
  const hasPending = scopedData.renewals.some(
    (r) => r.customerRegistrationId === activeRegId && r.status === 'PENDING'
  );

  // 執行有效追蹤判定
  const eligibility = checkRenewalEligibility(
    activeRegId,
    scopedData.followUps,
    scopedData.viewings,
    hasPending
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      addToast({
        type: 'error',
        title: '請輸入續期原因說明',
        message: '需詳細向代銷中心說明客戶目前之具體洽談與購屋決策進度。',
      });
      return;
    }

    setSubmitting(true);
    try {
      await repository.applyRenewal({
        registrationId: activeRegId,
        storeId: currentReg?.storeId || currentUser.storeId || 'store_daan_a',
        agentId: currentReg?.agentId || currentUser.id,
        reason: reason.trim(),
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: 'success',
        title: '續期申請已送交代銷中心',
        message: '申請待審期間不自動延長保留，請靜待代銷中心核准。核准後將延長30天。',
      });
      onClose();
      setReason('');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '申請失敗',
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
            <Clock className="w-5 h-5 text-rose-600" />
            申請客戶專屬保留期續期 (展延30天)
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">客戶姓名：</span>
            <strong className="text-slate-800">{activeCustomerName}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">意向建案：</span>
            <strong className="text-slate-800">{activeProjectName}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">原保留到期日：</span>
            <span className="font-semibold text-rose-600">{formatDateTaipei(activeExpiryDate)}</span>
          </div>
        </div>

        {/* 續期要件檢核卡片 */}
        <div
          className={`p-3.5 rounded-xl border text-xs mb-4 ${
            eligibility.eligible
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 font-bold mb-1.5">
            {eligibility.eligible ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{eligibility.eligible ? '符合續期要件' : '不符合續期資格'}</span>
          </div>

          {eligibility.eligible && eligibility.validRecord ? (
            <div className="space-y-1 text-slate-700">
              <p className="text-[11px] text-emerald-800">
                系統已自動鎖定並關聯 14 天內有效追蹤/帶看紀錄：
              </p>
              <div className="p-2 bg-white/80 rounded-lg border border-emerald-200 text-xs flex items-start gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="break-all">{eligibility.validRecord.summary}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-rose-800">
              {eligibility.reason ||
                '過去14天內未有實質客戶回饋追蹤或完成帶看紀錄。依聯銷規範，僅建立代辦不算有效追蹤，請先補登有效追蹤後再行申請。'}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              申請續期具體理由 <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              disabled={!eligibility.eligible}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                eligibility.eligible
                  ? '例如：客戶已帶長輩複看，目前正召集家族會議確認付款期程，承諾於一週內完成下訂申報，建請代銷中心予以延長保留。'
                  : '資格未符，暫無法送件'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-600 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <p>
              <strong>制度提醒：</strong>送出後由代銷中心營運協理親自審查。每次核准延長30天（以原到期日或核准日較晚者起算），待審期間不自動延長天數。
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              關閉
            </button>
            <button
              type="submit"
              disabled={!eligibility.eligible || submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" /> 確認送出續期申請
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
