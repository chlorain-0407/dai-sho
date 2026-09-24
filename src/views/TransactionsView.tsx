import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Transaction, TransactionStage } from '../types';
import {
  formatDateTaipei,
  formatCurrencyNTD,
  calculateCommissionFromSnapshot,
  formatBuildingUnit,
} from '../rules';
import { repository } from '../services/repository';
import {
  BadgeDollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  Percent,
  Home,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface TransactionsViewProps {
  onOpenConfirmModal: (transaction: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenConfirmModal,
}) => {
  const {
    scopedData,
    currentUser,
    allUsers,
    transactionFilterStage,
    setTransactionFilterStage,
    refreshData,
    addToast,
  } = useApp();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      addToast({
        type: 'info',
        title: '資料已刷新',
        message: '最新交易申報與審核狀態已同步更新。',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // 待審核的申報數量
  const pendingReviewCount = scopedData.transactions.filter(
    (t) =>
      t.reviewStatus === 'PENDING_REVIEW' ||
      t.stage === 'DEPOSIT_REPORTED' ||
      t.stage === 'CONTRACT_REPORTED' ||
      t.stage === 'DEAL_REPORTED'
  ).length;

  const filteredTransactions = scopedData.transactions.filter((tx) => {
    if (!transactionFilterStage || transactionFilterStage === 'ALL') return true;
    if (transactionFilterStage === 'PENDING_REVIEW') {
      return (
        tx.reviewStatus === 'PENDING_REVIEW' ||
        tx.stage === 'DEPOSIT_REPORTED' ||
        tx.stage === 'CONTRACT_REPORTED' ||
        tx.stage === 'DEAL_REPORTED'
      );
    }
    return tx.stage === transactionFilterStage;
  });

  const getStageBadge = (stage: TransactionStage, reviewStatus?: string) => {
    if (reviewStatus === 'PENDING_REVIEW' || stage === 'DEPOSIT_REPORTED' || stage === 'CONTRACT_REPORTED' || stage === 'DEAL_REPORTED') {
      const typeLabel =
        stage === 'DEPOSIT_REPORTED'
          ? '下訂申報中'
          : stage === 'CONTRACT_REPORTED'
          ? '簽約申報中'
          : stage === 'DEAL_REPORTED'
          ? '成交申報中'
          : '申報待中心覆核';
      return { label: `${typeLabel} (待審核)`, color: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse' };
    }
    switch (stage) {
      case 'DEPOSIT_CONFIRMED':
        return { label: '已確認下訂 (保留戶)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'CONTRACT_CONFIRMED':
        return { label: '已確認簽約', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
      case 'DEAL_CONFIRMED':
        return { label: '確認成交 (結算發佣)', color: 'bg-emerald-600 text-white font-bold' };
      case 'CANCELLED':
        return {
          label: reviewStatus === 'REJECTED' ? '已駁回申報 (釋回戶別)' : '已取消交易 (釋回戶別)',
          color: 'bg-rose-100 text-rose-800 border-rose-300',
        };
      default:
        return { label: stage, color: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題與說明 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BadgeDollarSign className="w-6 h-6 text-rose-600" />
            {currentUser.role === 'center_admin' ? '交易審核與確認管線' : '聯銷交易進度申報與進度'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {currentUser.role === 'center_admin'
              ? '代銷中心專屬審核：審查門店下訂、簽約與成交申報，可核准生效或駁回並留存原因。'
              : '門店提出下訂、簽約與成交申報，由代銷中心總部審核核准後，同步鎖定戶別與分佣發放。'}
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          重新整理狀態
        </button>
      </div>

      {/* 待審核警示橫幅 (代銷中心端顯示) */}
      {currentUser.role === 'center_admin' && pendingReviewCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              目前有 <strong>{pendingReviewCount}</strong> 筆交易申報等待代銷中心覆核，請及時查閱匯款水單或契約確認。
            </span>
          </div>
          <button
            onClick={() => setTransactionFilterStage('PENDING_REVIEW')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shrink-0 transition-colors shadow-2xs"
          >
            篩選待審項目
          </button>
        </div>
      )}

      {/* 階段標籤篩選列 */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setTransactionFilterStage('ALL')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            !transactionFilterStage || transactionFilterStage === 'ALL'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          全數交易申報 ({scopedData.transactions.length})
        </button>
        <button
          onClick={() => setTransactionFilterStage('PENDING_REVIEW')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            transactionFilterStage === 'PENDING_REVIEW'
              ? 'bg-amber-600 text-white font-semibold'
              : 'text-amber-800 hover:bg-amber-50'
          }`}
        >
          待審申報 ({pendingReviewCount})
        </button>
        <button
          onClick={() => setTransactionFilterStage('DEPOSIT_CONFIRMED')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            transactionFilterStage === 'DEPOSIT_CONFIRMED'
              ? 'bg-emerald-700 text-white font-semibold'
              : 'text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          已下訂確認 ({scopedData.transactions.filter((t) => t.stage === 'DEPOSIT_CONFIRMED').length})
        </button>
        <button
          onClick={() => setTransactionFilterStage('CONTRACT_CONFIRMED')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            transactionFilterStage === 'CONTRACT_CONFIRMED'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-indigo-800 hover:bg-indigo-50'
          }`}
        >
          已簽約確認 ({scopedData.transactions.filter((t) => t.stage === 'CONTRACT_CONFIRMED').length})
        </button>
        <button
          onClick={() => setTransactionFilterStage('DEAL_CONFIRMED')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            transactionFilterStage === 'DEAL_CONFIRMED'
              ? 'bg-emerald-600 text-white font-semibold'
              : 'text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          成交結算完畢 ({scopedData.transactions.filter((t) => t.stage === 'DEAL_CONFIRMED').length})
        </button>
        <button
          onClick={() => setTransactionFilterStage('CANCELLED')}
          className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
            transactionFilterStage === 'CANCELLED'
              ? 'bg-rose-600 text-white font-semibold'
              : 'text-rose-800 hover:bg-rose-50'
          }`}
        >
          已取消／駁回 ({scopedData.transactions.filter((t) => t.stage === 'CANCELLED' || t.reviewStatus === 'REJECTED').length})
        </button>
      </div>

      {/* 交易列表卡片 */}
      <div className="space-y-4">
        {filteredTransactions.length === 0 ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
            目前無符合條件之交易進度資料。
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const project = scopedData.projects.find((p) => p.id === tx.projectId);
            const unit = scopedData.units.find((u) => u.id === tx.unitId);
            const store = scopedData.stores.find((s) => s.id === tx.storeId);
            const agent = allUsers.find((u) => u.id === tx.agentId);
            const reg = scopedData.registrations.find((r) => r.id === tx.customerRegistrationId);
            const customer = scopedData.customers.find((c) => c.id === reg?.customerId);
            const snapshot = scopedData.commissionSnapshots.find((s) => s.id === reg?.commissionSnapshotId);

            const badge = getStageBadge(tx.stage, tx.reviewStatus);

            // 分佣金額計算 (依正式價或待審價)
            const activePrice = tx.dealPrice || tx.pendingDealPrice || (tx as any).totalPrice || 0;
            const commission = snapshot
              ? calculateCommissionFromSnapshot(activePrice, snapshot)
              : { totalCommission: 0, centerCommission: 0, storeCommission: 0 };

            const isPendingReview =
              tx.reviewStatus === 'PENDING_REVIEW' ||
              tx.stage === 'DEPOSIT_REPORTED' ||
              tx.stage === 'CONTRACT_REPORTED' ||
              tx.stage === 'DEAL_REPORTED';

            return (
              <div
                key={tx.id}
                className={`bg-white rounded-2xl border shadow-xs p-5 space-y-4 hover:border-slate-300 transition-all text-xs ${
                  isPendingReview ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-slate-900">
                        {project?.name} · {formatBuildingUnit(unit?.building, unit?.unitNumber)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-rose-600 font-bold text-sm">
                        {isPendingReview ? '申報總價 ' : '成交總價 '}
                        {formatCurrencyNTD(activePrice, true)}
                      </span>
                    </div>
                    <p className="text-slate-500">
                      承辦門店：{store?.name} · 負責業務：{agent?.name} · 買方客戶：{customer?.name}（
                      {currentUser.role === 'center_admin' || currentUser.storeId === tx.storeId
                        ? (customer?.phone || '')
                        : (customer?.phone ? customer.phone.replace(/(\d{4})\d{3}(\d{3})/, '$1***$2') : '')}
                      ）
                    </p>
                  </div>

                  {currentUser.role === 'center_admin' && (
                    <button
                      onClick={() => onOpenConfirmModal(tx)}
                      className={`px-3.5 py-2 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto ${
                        isPendingReview
                          ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-300 ring-offset-1'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {isPendingReview ? '審核申報 (核准／駁回)' : '覆核進度／變更階段'}
                    </button>
                  )}
                </div>

                {/* 佣金試算明細與快照對照 */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">已收訂金</span>
                    <strong className="text-slate-800 text-sm mt-0.5 block">
                      {formatCurrencyNTD(tx.depositAmount || tx.pendingDepositAmount || 0)}
                    </strong>
                  </div>

                  <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
                    <span className="text-emerald-800 block text-[11px] font-semibold">
                      門店應得分佣
                    </span>
                    <strong className="text-emerald-700 text-sm mt-0.5 block">
                      {formatCurrencyNTD(commission.storeCommission)}
                    </strong>
                    <span className="text-[10px] text-slate-500">
                      依登記快照 {snapshot?.versionNumber || snapshot?.versionId || 'V1.0'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">代銷中心分配</span>
                    <strong className="text-slate-700 text-sm mt-0.5 block">
                      {formatCurrencyNTD(commission.centerCommission)}
                    </strong>
                    <span className="text-[10px] text-slate-500">
                      總佣金 {formatCurrencyNTD(commission.totalCommission)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block text-[11px]">分佣結算狀態</span>
                    <strong
                      className={`text-sm mt-0.5 block ${
                        tx.stage === 'DEAL_CONFIRMED'
                          ? 'text-emerald-700 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {tx.stage === 'DEAL_CONFIRMED' ? '已核可發放' : '待成交確認後發放'}
                    </strong>
                  </div>
                </div>

                {/* 備註與覆核/駁回紀錄 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 bg-slate-50 rounded-xl text-slate-600">
                    <span className="text-slate-400 block text-[11px]">業務申報備註：</span>
                    <p className="mt-0.5 italic">
                      "{tx.pendingReportNote || tx.reportNote || '無申報備註'}"
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      申報時間：{formatDateTaipei(tx.createdAt, true)}
                    </span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl ${
                      tx.reviewStatus === 'REJECTED'
                        ? 'bg-rose-50 border border-rose-200 text-rose-800'
                        : 'bg-slate-50 border border-slate-200 text-slate-600'
                    }`}
                  >
                    <span
                      className={`block text-[11px] ${
                        tx.reviewStatus === 'REJECTED' ? 'text-rose-600 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {tx.reviewStatus === 'REJECTED' ? '代銷中心駁回原因：' : '代銷中心覆核備註：'}
                    </span>
                    <p className="mt-0.5 font-medium">
                      {tx.reviewStatus === 'REJECTED'
                        ? tx.rejectionReason
                        : tx.centerConfirmNote
                        ? `"${tx.centerConfirmNote}"`
                        : isPendingReview
                        ? '⏳ 代銷中心審核中，尚未裁定'
                        : '已依程序核准'}
                    </p>
                    {tx.centerConfirmedAt && tx.reviewStatus !== 'REJECTED' && (
                      <span className="text-[10px] text-emerald-700 block mt-1">
                        確認時間：{formatDateTaipei(tx.centerConfirmedAt, true)} by {tx.centerConfirmedBy || (tx as any).confirmedBy}
                      </span>
                    )}
                    {tx.rejectedAt && (
                      <span className="text-[10px] text-rose-600 block mt-1">
                        駁回時間：{formatDateTaipei(tx.rejectedAt, true)} by {tx.rejectedBy}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
