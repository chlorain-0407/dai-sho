import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { ViewingStatus, Viewing, CustomerRegistration } from '../../types';
import { CalendarCheck, X, CheckCircle2 } from 'lucide-react';

interface ViewingModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration?: CustomerRegistration | null;
  registrationId?: string;
  customerName?: string;
  projectId?: string;
  projectName?: string;
  existingViewing?: Viewing;
}

export const ViewingModal: React.FC<ViewingModalProps> = ({
  isOpen,
  onClose,
  registration,
  registrationId,
  customerName,
  projectId,
  projectName,
  existingViewing,
}) => {
  const { currentUser, scopedData, refreshData, addToast } = useApp();

  const activeRegId = registration?.id || registrationId || existingViewing?.customerRegistrationId || '';
  const currentReg = registration || scopedData.registrations.find((r) => r.id === activeRegId);
  const activeProjectId = projectId || currentReg?.projectId || existingViewing?.projectId || '';
  const activeProject = scopedData.projects.find((p) => p.id === activeProjectId);
  const activeCustomer = currentReg ? scopedData.customers.find((c) => c.id === currentReg.customerId) : undefined;
  const activeCustomerName = customerName || activeCustomer?.name || '客戶';
  const activeProjectName = projectName || activeProject?.name || '建案';

  const [unitId, setUnitId] = useState(existingViewing?.unitId || '');
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (existingViewing?.scheduledTime) {
      return existingViewing.scheduledTime.substring(0, 16);
    }
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d.toISOString().substring(0, 16);
  });
  const [status, setStatus] = useState<ViewingStatus>(existingViewing?.status || 'SCHEDULED');
  const [receptionistName, setReceptionistName] = useState(
    existingViewing?.receptionistName || `${currentUser.name}（專案業務）`
  );
  const [customerFeedback, setCustomerFeedback] = useState(existingViewing?.customerFeedback || '');
  const [objections, setObjections] = useState(existingViewing?.objections || '');
  const [nextStep, setNextStep] = useState(existingViewing?.nextStep || '');
  const [submitting, setSubmitting] = useState(false);

  const projectUnits = scopedData.units.filter((u) => u.projectId === activeProjectId);

  if (!isOpen || (!activeRegId && !existingViewing)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'COMPLETED' && (!customerFeedback.trim() || !nextStep.trim())) {
      addToast({
        type: 'error',
        title: '完成帶看必須填寫結果',
        message: '請詳實填寫客戶反應回饋與下一步，以便建立有效紀錄。',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (existingViewing) {
        await repository.updateViewingReport({
          viewingId: existingViewing.id,
          status,
          receptionistName,
          customerFeedback: customerFeedback.trim(),
          objections: objections.trim(),
          nextStep: nextStep.trim(),
          operator: currentUser,
        });
      } else {
        await repository.addViewing({
          customerRegistrationId: activeRegId,
          projectId: activeProjectId,
          unitId: unitId || undefined,
          scheduledTime: new Date(scheduledDate).toISOString(),
          status,
          receptionistName,
          customerFeedback: customerFeedback.trim() || undefined,
          objections: objections.trim() || undefined,
          nextStep: nextStep.trim() || undefined,
          operator: currentUser,
        });
      }

      await refreshData();
      addToast({
        type: 'success',
        title: existingViewing ? '帶看紀錄已更新' : '帶看行程已建立',
        message: status === 'COMPLETED' ? '已登記為完成帶看，可作為續期保留之合法要件。' : '行程已成功排入。',
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
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <CalendarCheck className="w-5 h-5 text-rose-600" />
            {existingViewing ? '編輯/回報帶看結果' : '新增現場帶看預約'}
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

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">帶看狀態</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ViewingStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              >
                <option value="SCHEDULED">已預約（待帶看）</option>
                <option value="COMPLETED">已完成帶看（填寫回饋）</option>
                <option value="CANCELLED">已取消</option>
                <option value="NO_SHOW">客戶未到場 (No-Show)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">帶看日期時間</label>
              <input
                type="datetime-local"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">參觀戶別（選填）</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">-- 全案樣品屋/接待中心 --</option>
                {projectUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.building} {u.unitNumber} ({u.pattern})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">接待接待人員</label>
              <input
                type="text"
                required
                value={receptionistName}
                onChange={(e) => setReceptionistName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              客戶現場反應與回饋 {status === 'COMPLETED' && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={2}
              required={status === 'COMPLETED'}
              value={customerFeedback}
              onChange={(e) => setCustomerFeedback(e.target.value)}
              placeholder={status === 'COMPLETED' ? '例如：客戶對主臥衛浴與陽台景觀滿意，考慮長輩換屋...' : '完成帶看後填寫...'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">主要抗性（客戶顧慮點）</label>
            <input
              type="text"
              value={objections}
              onChange={(e) => setObjections(e.target.value)}
              placeholder="例如：擔心面路車流噪音、總價超出原先自備款預期"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              明確下一步 {status === 'COMPLETED' && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="text"
              required={status === 'COMPLETED'}
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="例如：週二寄送建材檢驗報告並洽談付款時程"
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
              <CheckCircle2 className="w-4 h-4" /> 確認送出帶看紀錄
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
