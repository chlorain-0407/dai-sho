import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { Transaction, TransactionStage } from '../../types';
import { formatCurrencyNTD, formatDateTaipei, formatBuildingUnit } from '../../rules';
import { ShieldCheck, CheckCircle2, XCircle, X, AlertTriangle } from 'lucide-react';

interface TransactionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
}

export const TransactionConfirmModal: React.FC<TransactionConfirmModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  const { currentUser, scopedData, refreshData, addToast, allUsers } = useApp();

  if (!isOpen || !transaction) return null;

  const project = scopedData.projects.find((p) => p.id === transaction.projectId);
  const unit = scopedData.units.find((u) => u.id === transaction.unitId);
  const store = scopedData.stores.find((s) => s.id === transaction.storeId);
  const agent = allUsers.find((u) => u.id === transaction.agentId);
  const reg = scopedData.registrations.find((r) => r.id === transaction.customerRegistrationId);
  const customer = scopedData.customers.find((c) => c.id === reg?.customerId);

  // 預設確認動作：依照目前申報狀態推進
  const getNextStage = (): TransactionStage => {
    switch (transaction.stage) {
      case 'DEPOSIT_REPORTED':
        return 'DEPOSIT_CONFIRMED';
      case 'CONTRACT_REPORTED':
        return 'CONTRACT_CONFIRMED';
      case 'DEAL_REPORTED':
        return 'DEAL_CONFIRMED';
      default:
        return 'DEAL_CONFIRMED';
    }
  };

  const [activeAction, setActiveAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [targetStage, setTargetStage] = useState<TransactionStage>(getNextStage());
  const [confirmNote, setConfirmNote] = useState('代銷中心已查核水單與合約資料無誤，准予確認。');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 核准申報
  const handleApprove = async () => {
    if (!confirmNote.trim()) {
      addToast({
        type: 'error',
        title: '請填寫確認備註',
        message: '代銷中心覆核紀錄將具名留存。',
      });
      return;
    }

    setSubmitting(true);
    try {
      await repository.confirmTransactionStage({
        transactionId: transaction.id,
        nextStage: targetStage,
        note: confirmNote.trim(),
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: 'success',
        title: '交易申報已核准生效！',
        message:
          targetStage === 'DEAL_CONFIRMED'
            ? '正式確認成交！戶別已同步更新為「已售出 (SOLD)」，並依登記快照正式核算分佣發放。'
            : targetStage === 'CONTRACT_CONFIRMED'
            ? '已核准簽約申報，戶別狀態同步更新為「已簽約 (SIGNED)」。'
            : '已核准下訂申報，戶別狀態同步更新為「已收訂保留 (RESERVED_DEPOSIT)」。',
      });
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '核准失敗',
        message: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 駁回申報（必填原因）
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      addToast({
        type: 'error',
        title: '請填寫駁回原因',
        message: '中心駁回申報必須說明具體原因供門店參閱。',
      });
      return;
    }

    setSubmitting(true);
    try {
      await repository.rejectTransactionStage({
        transactionId: transaction.id,
        rejectionReason: rejectionReason.trim(),
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: 'warning',
        title: '交易申報已駁回',
        message: '已記錄駁回原因並釋回或保留原戶別狀態，門店端可查閱審核歷程。',
      });
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '駁回失敗',
        message: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 取消/釋回整筆交易
  const handleCancelTransaction = async () => {
    if (!window.confirm('確定要直接取消並終止此筆交易嗎？戶別將全數釋回為可銷售狀態。')) return;

    setSubmitting(true);
    try {
      await repository.confirmTransactionStage({
        transactionId: transaction.id,
        nextStage: 'CANCELLED',
        note: confirmNote.trim() || '代銷中心直接取消交易，釋回戶別。',
        operator: currentUser,
      });

      await refreshData();
      addToast({
        type: 'warning',
        title: '交易已取消',
        message: '該戶別已釋回為「可售 (AVAILABLE)」。',
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
            <ShieldCheck className="w-5 h-5 text-rose-600" />
            代銷中心 · 覆核交易申報與裁定
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 申報詳情資訊卡 */}
        <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">申報門店／業務：</span>
            <strong className="text-slate-800">
              {store?.name} · {agent?.name}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">客戶姓名：</span>
            <strong className="text-slate-800">{customer?.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">建案與戶別：</span>
            <strong className="text-slate-800">
              {project?.name} · {formatBuildingUnit(unit?.building, unit?.unitNumber)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">申報成交價：</span>
            <strong className="text-rose-600 text-sm">
              {formatCurrencyNTD(transaction.pendingDealPrice || transaction.dealPrice, true)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">已收訂金：</span>
            <span className="text-slate-700">
              {formatCurrencyNTD(
                transaction.pendingDepositAmount !== undefined
                  ? transaction.pendingDepositAmount
                  : transaction.depositAmount || 0
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">申報時間：</span>
            <span className="text-slate-600">{formatDateTaipei(transaction.createdAt, true)}</span>
          </div>
        </div>

        <div className="mb-3 p-2.5 bg-slate-100 rounded-xl text-xs">
          <span className="text-slate-500 block mb-0.5">業務申報備註：</span>
          <p className="text-slate-700 italic">
            "{transaction.pendingReportNote || transaction.reportNote || '無備註'}"
          </p>
        </div>

        {/* 審核模式切換：核准生效 vs 駁回申報 */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setActiveAction('APPROVE')}
            className={`py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
              activeAction === 'APPROVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> 核准申報生效
          </button>
          <button
            type="button"
            onClick={() => setActiveAction('REJECT')}
            className={`py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
              activeAction === 'REJECT'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <XCircle className="w-4 h-4" /> 駁回申報
          </button>
        </div>

        {activeAction === 'APPROVE' ? (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                核准確認階段 <span className="text-rose-500">*</span>
              </label>
              <select
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value as TransactionStage)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
              >
                <option value="DEPOSIT_CONFIRMED">確認下訂 (戶別轉為已收訂保留 RESERVED_DEPOSIT)</option>
                <option value="CONTRACT_CONFIRMED">確認簽約 (戶別轉為已簽約 SIGNED)</option>
                <option value="DEAL_CONFIRMED">確認成交 (戶別轉為已成交結案 DEAL_CLOSED 並結算分佣)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                代銷中心覆核備註 <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="例如：查驗匯款水單 100 萬與建商意向書已核對一致。"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs bg-rose-50/60 p-3 rounded-xl border border-rose-200">
            <div className="flex items-center gap-1.5 text-rose-800 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              駁回說明（必填，將留存歷程並同步反饋給門店業務）
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                駁回具體原因 <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="例如：匯款憑證金額不足、買方身分證件未齊全、或客戶已撤回出價..."
                className="w-full px-3 py-2 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              />
            </div>
            <p className="text-[11px] text-rose-700">
              ＊ 駁回後該筆申報將標記為 REJECTED，若此為首次下訂，戶別狀態將自動釋回為可銷售 (AVAILABLE)。
            </p>
          </div>
        )}

        {/* 底部按鈕操作列 */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={submitting}
            onClick={handleCancelTransaction}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition-colors"
          >
            直接取消交易 (釋回戶別)
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              取消返回
            </button>
            {activeAction === 'APPROVE' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleApprove}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> 確認核准
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleReject}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> 確認駁回
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
