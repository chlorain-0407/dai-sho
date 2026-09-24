import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { ContactMethod, CustomerRegistration } from '../../types';
import { MessageSquareText, X, CheckCircle2, Clock } from 'lucide-react';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration?: CustomerRegistration | null;
  registrationId?: string;
  customerName?: string;
  projectName?: string;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  isOpen,
  onClose,
  registration,
  registrationId,
  customerName,
  projectName,
}) => {
  const { currentUser, scopedData, refreshData, addToast } = useApp();

  const activeRegId = registration?.id || registrationId || '';
  const currentReg = registration || scopedData.registrations.find((r) => r.id === activeRegId);
  const activeCustomerName =
    customerName ||
    (currentReg ? scopedData.customers.find((c) => c.id === currentReg.customerId)?.name : '') ||
    '客戶';
  const activeProjectName =
    projectName ||
    (currentReg ? scopedData.projects.find((p) => p.id === currentReg.projectId)?.name : '') ||
    '建案';

  const [method, setMethod] = useState<ContactMethod>('PHONE');
  const [summary, setSummary] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().substring(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !activeRegId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !customerResponse.trim() || !nextStep.trim()) {
      addToast({
        type: 'error',
        title: '請完整填寫紀錄內容',
        message: '包含洽談摘要、客戶實際回應及明確下一步，以符合有效追蹤規範。',
      });
      return;
    }

    setSubmitting(true);
    try {
      const fu = await repository.addFollowUp({
        customerRegistrationId: activeRegId,
        storeId: currentReg?.storeId || currentUser.storeId || 'store_daan_a',
        agentId: currentUser.id,
        method,
        summary: summary.trim(),
        customerResponse: customerResponse.trim(),
        nextStep: nextStep.trim(),
        nextFollowUpDate: new Date(nextFollowUpDate).toISOString(),
        recordedBy: currentUser.name,
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: 'success',
        title: '追蹤紀錄已儲存',
        message: fu.isEffectiveFollowUp
          ? '已符合「有效追蹤規範」（14天內具備客戶實質回饋與明確下一步），符合續期資格。'
          : '追蹤已留存。',
      });

      onClose();
      setSummary('');
      setCustomerResponse('');
      setNextStep('');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '儲存失敗',
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
            <MessageSquareText className="w-5 h-5 text-rose-600" />
            新增客戶追蹤紀錄
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
          <div>
            客戶：<strong className="text-slate-800">{activeCustomerName}</strong>
          </div>
          <div>
            建案：<strong className="text-slate-800">{activeProjectName}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">聯絡方式</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ContactMethod)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="PHONE">電話照會</option>
                <option value="LINE">LINE 訊息溝通</option>
                <option value="ON_SITE">現場接待/面談</option>
                <option value="ONLINE_MEETING">線上視訊解說</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">預計下次追蹤日</label>
              <input
                type="date"
                required
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              本次洽談摘要 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="例如：電訪提供樣品屋格局圖與周邊實登行情"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              客戶實際回應 <span className="text-rose-500">*</span>
              <span className="text-[10px] text-amber-600 ml-1.5 font-normal">(有效追蹤必要欄位，不可為空或純待辦)</span>
            </label>
            <textarea
              required
              rows={2}
              value={customerResponse}
              onChange={(e) => setCustomerResponse(e.target.value)}
              placeholder="例如：客戶表示對高樓層採光很滿意，正與配偶核算首期自備款成數..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              明確下一步規劃 <span className="text-rose-500">*</span>
              <span className="text-[10px] text-amber-600 ml-1.5 font-normal">(有效追蹤必要欄位)</span>
            </label>
            <input
              type="text"
              required
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="例如：週六下午 2 點預約案場實地複看樣品屋"
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
              className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> 儲存追蹤紀錄
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
