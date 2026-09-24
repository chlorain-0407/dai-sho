import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { CommissionFormulaType, Project } from '../../types';
import { Percent, X, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

interface NewCommissionVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
}

export const NewCommissionVersionModal: React.FC<NewCommissionVersionModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const { currentUser, refreshData, addToast } = useApp();

  const [versionCode, setVersionCode] = useState('V2.0 (專案調升案期促銷)');
  const [formulaType, setFormulaType] = useState<CommissionFormulaType>('PERCENTAGE_TOTAL');
  const [totalPercentage, setTotalPercentage] = useState(4.0);
  const [centerPercentage, setCenterPercentage] = useState(1.0);
  const [storePercentage, setStorePercentage] = useState(3.0);
  const [fixedAmount, setFixedAmount] = useState(1000000);
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [note, setNote] = useState('因應接待中心公開熱銷，調升加盟門店成交分配至總價3.0%');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !project) return null;

  const handlePercentageChange = (total: number, center: number) => {
    setTotalPercentage(total);
    setCenterPercentage(center);
    setStorePercentage(Number((total - center).toFixed(2)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formulaType === 'PERCENTAGE_TOTAL') {
      const sum = Number((centerPercentage + storePercentage).toFixed(2));
      if (Math.abs(sum - totalPercentage) > 0.01) {
        addToast({
          type: 'error',
          title: '比例不相符',
          message: '代銷中心比例加上門店比例必須等於總分佣比例。',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      await repository.publishCommissionVersion({
        projectId: project.id,
        versionNumber: versionCode.trim(),
        formulaType,
        percentage: formulaType === 'PERCENTAGE_TOTAL' ? Number(totalPercentage) : 0,
        centerPercentage: Number(centerPercentage) || 0,
        storePercentage: Number(storePercentage) || 0,
        fixedAmount: formulaType === 'FIXED_AMOUNT' ? Number(fixedAmount) : undefined,
        effectiveDate: new Date(effectiveDate).toISOString(),
        note: note.trim(),
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: 'success',
        title: '新分佣版本發布成功！',
        message: '自生效日起新登記客戶適用此新版，既有已登記客戶繼續鎖定原歷史快照，權益不受影響。',
      });
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '發布失敗',
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
            <Percent className="w-5 h-5 text-rose-600" />
            代銷中心 · 發布建案新分佣版本
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">標的建案：</span>
            <strong className="text-slate-800">{project.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">建商名稱：</span>
            <span className="text-slate-700">{project.developer}</span>
          </div>
        </div>

        <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p>
            <strong>快照鎖定與利益保護原則：</strong>
            發布新分佣版本只對生效後「新登記之客戶」生效。所有先前已登記客戶均維持當時鎖定之不可覆寫快照，確保門店與業務之預期佣金權益不遭追溯調降。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              版本代碼／說明 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
              placeholder="例如：V2.0 (專案促銷版)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">計算方式</label>
              <select
                value={formulaType}
                onChange={(e) => setFormulaType(e.target.value as CommissionFormulaType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="PERCENTAGE_TOTAL">總價百分比分潤 (標準)</option>
                <option value="FIXED_PER_UNIT">每戶固定金額 (包銷特規)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">生效起算日</label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {formulaType === 'PERCENTAGE_TOTAL' ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-semibold text-slate-700 block">百分比拆分設定</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">總分佣比 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={totalPercentage}
                    onChange={(e) => handlePercentageChange(Number(e.target.value), centerPercentage)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-0.5">代銷中心分配 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={totalPercentage}
                    value={centerPercentage}
                    onChange={(e) => handlePercentageChange(totalPercentage, Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-emerald-700 block mb-0.5 font-bold">門店實領比例 (%)</label>
                  <input
                    type="number"
                    disabled
                    value={storePercentage}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 font-bold bg-emerald-50 text-emerald-800"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">每戶固定金額 (元)</label>
              <input
                type="number"
                step="10000"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              發布說明備註 <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
              className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> 確認發布新版分佣
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
