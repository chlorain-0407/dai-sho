import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { CustomerRegistration } from '../../types';
import { formatCurrencyNTD, calculateCommissionFromSnapshot } from '../../rules';
import { BadgeDollarSign, X, CheckCircle2, AlertCircle, Percent } from 'lucide-react';

interface TransactionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration?: CustomerRegistration | null;
}

export const TransactionReportModal: React.FC<TransactionReportModalProps> = ({
  isOpen,
  onClose,
  registration,
}) => {
  const { currentUser, scopedData, refreshData, addToast } = useApp();

  if (!isOpen || !registration) return null;

  const customer = scopedData.customers.find((c) => c.id === registration.customerId);
  const project = scopedData.projects.find((p) => p.id === registration.projectId);
  const snapshot = scopedData.commissionSnapshots.find((s) => s.id === registration.commissionSnapshotId);

  // 可選戶別
  const projectUnits = scopedData.units.filter((u) => u.projectId === registration.projectId);

  const [unitId, setUnitId] = useState(
    registration.intendedUnitId || (projectUnits.length > 0 ? projectUnits[0].id : '')
  );
  const selectedUnit = projectUnits.find((u) => u.id === unitId);

  const [stage, setStage] = useState<'DEPOSIT_REPORTED' | 'CONTRACT_REPORTED' | 'DEAL_REPORTED'>(
    'DEPOSIT_REPORTED'
  );
  const [dealPrice, setDealPrice] = useState(selectedUnit?.listPrice || 40000000);
  const [depositAmount, setDepositAmount] = useState(1000000);
  const [reportNote, setReportNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 當選擇的戶別改變時，預載該戶開價
  const handleUnitChange = (newUnitId: string) => {
    setUnitId(newUnitId);
    const u = projectUnits.find((item) => item.id === newUnitId);
    if (u) {
      setDealPrice(u.listPrice);
    }
  };

  if (!isOpen) return null;

  // 計算佣金預覽
  const previewCommission = snapshot
    ? calculateCommissionFromSnapshot(Number(dealPrice), snapshot)
    : { totalCommission: 0, centerCommission: 0, storeCommission: 0 };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId) {
      addToast({
        type: 'error',
        title: '請選擇交易戶別',
      });
      return;
    }

    if (!reportNote.trim()) {
      addToast({
        type: 'error',
        title: '請填寫申報備註',
        message: '例如定金收受支票號碼或簽約付款協議。',
      });
      return;
    }

    const numDealPrice = Number(dealPrice);
    if (isNaN(numDealPrice) || numDealPrice <= 0) {
      addToast({
        type: 'error',
        title: '交易總價錯誤',
        message: '申報成交總價必須大於 0 元。',
      });
      return;
    }

    const numDeposit = Number(depositAmount);
    if (isNaN(numDeposit) || numDeposit < 0) {
      addToast({
        type: 'error',
        title: '訂金金額錯誤',
        message: '訂金金額不得為負數。',
      });
      return;
    }

    if (numDeposit > numDealPrice) {
      addToast({
        type: 'error',
        title: '訂金金額錯誤',
        message: '訂金金額不得超過申報成交總價。',
      });
      return;
    }

    setSubmitting(true);
    try {
      await repository.reportTransactionStage({
        customerRegistrationId: registration.id,
        unitId,
        stage,
        totalPrice: Number(dealPrice),
        depositAmount: Number(depositAmount),
        note: reportNote.trim(),
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: 'success',
        title: '交易申報已送出！',
        message: '已送交代銷中心覆核。待中心確認後，將正式生效並同步更新戶別銷售狀態。',
      });
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '申報失敗',
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
            <BadgeDollarSign className="w-5 h-5 text-rose-600" />
            提出交易進度申報
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">客戶姓名：</span>
            <strong className="text-slate-800">{customer?.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">建案名稱：</span>
            <strong className="text-slate-800">{project?.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">鎖定分佣版本：</span>
            <span className="text-emerald-700 font-semibold">{snapshot?.basisDescription || '未知快照'}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                申報交易階段 <span className="text-rose-500">*</span>
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold text-slate-800"
              >
                <option value="DEPOSIT_REPORTED">下訂申報中（已付小訂/大訂）</option>
                <option value="CONTRACT_REPORTED">簽約申報中（已簽買賣契約）</option>
                <option value="DEAL_REPORTED">成交申報中（交屋尾款完成）</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                交易標的戶別 <span className="text-rose-500">*</span>
              </label>
              <select
                value={unitId}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {projectUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.building} {u.unitNumber} ({u.pattern} · 開價 {u.listPrice / 10000}萬)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                申報成交總價 (元) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="10000"
                required
                value={dealPrice}
                onChange={(e) => setDealPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {formatCurrencyNTD(Number(dealPrice), true)}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                已收訂金金額 (元)
              </label>
              <input
                type="number"
                step="10000"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {formatCurrencyNTD(Number(depositAmount), true)}
              </span>
            </div>
          </div>

          {/* 佣金試算即時預覽 */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between font-bold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-600" />
                依登記快照試算分佣
              </span>
              <span className="text-[10px] bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-800">
                申報中估算 (未結算)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
              <div className="p-2 bg-white rounded-lg border border-emerald-100 text-center">
                <p className="text-slate-500">預估總佣金</p>
                <p className="font-bold text-slate-800 mt-0.5">
                  {formatCurrencyNTD(previewCommission.totalCommission)}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100 text-center">
                <p className="text-slate-500">門店分配金額</p>
                <p className="font-bold text-emerald-700 mt-0.5">
                  {formatCurrencyNTD(previewCommission.storeCommission)}
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100 text-center">
                <p className="text-slate-500">代銷中心分配</p>
                <p className="font-bold text-slate-600 mt-0.5">
                  {formatCurrencyNTD(previewCommission.centerCommission)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              申報說明與備註 <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="例如：收受台支本票 100 萬元，附上買賣意願書影本..."
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
              <CheckCircle2 className="w-4 h-4" /> 確認送出交易申報
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
