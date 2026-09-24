import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { apiClient } from '../services/apiClient';
import { IssueTicket, IssueStatus, IssueType, IssuePriority } from '../types';
import { formatDateTaipei } from '../rules';
import {
  HelpCircle,
  Plus,
  Filter,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  ArrowRight,
  MessageSquare,
  Send,
  Loader2,
  RefreshCw,
  Building,
  User,
  ShieldCheck,
  ChevronDown,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react';

interface IssuesViewProps {
  onOpenReportModal: () => void;
}

export const IssuesView: React.FC<IssuesViewProps> = ({ onOpenReportModal }) => {
  const { currentUser, addToast } = useApp();

  const [tickets, setTickets] = useState<IssueTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<IssueTicket | null>(null);

  // 篩選條件
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');

  // 中心操作表單狀態
  const [targetStatus, setTargetStatus] = useState<IssueStatus>('IN_PROGRESS');
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [verificationResult, setVerificationResult] = useState('');
  const [postponeReason, setPostponeReason] = useState('');
  const [centerInternalNotes, setCenterInternalNotes] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // 補充說明留言
  const [commentContent, setCommentContent] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getIssues({
        status: statusFilter,
        type: typeFilter,
        storeId: storeFilter,
      });
      if (res && res.tickets) {
        setTickets(res.tickets);
        // 若當前有選中 ticket，更新其最新資料
        if (selectedTicket) {
          const updated = res.tickets.find((t: any) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch issues:', err);
      addToast({
        type: 'error',
        title: '無法載入問題回報',
        message: err?.message || '讀取資料失敗',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, storeFilter, addToast, selectedTicket?.id]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // 當選中問題變更時，初始化操作表單欄位
  useEffect(() => {
    if (selectedTicket) {
      setTargetStatus(selectedTicket.status);
      setPriority(selectedTicket.priority);
      setResolutionSummary(selectedTicket.resolutionSummary || '');
      setVerificationResult(selectedTicket.verificationResult || '');
      setPostponeReason(selectedTicket.postponeReason || '');
      setCenterInternalNotes(selectedTicket.centerInternalNotes || '');
      setRollbackReason('');
      setCommentContent('');
    }
  }, [selectedTicket?.id]);

  const handleUpdateStatus = async (statusOverride?: IssueStatus) => {
    if (!selectedTicket) return;
    const finalStatus = statusOverride || targetStatus;

    if (finalStatus === 'POSTPONED' && !postponeReason.trim()) {
      addToast({ type: 'warning', title: '暫緩必須填寫原因' });
      return;
    }

    if (finalStatus === 'IN_PROGRESS' && currentUser.role !== 'center_admin' && !rollbackReason.trim()) {
      addToast({ type: 'warning', title: '退回處理中必須提供仍可重現之具體原因說明' });
      return;
    }

    setActionLoading(true);
    try {
      await apiClient.updateIssueStatus(selectedTicket.id, {
        status: finalStatus,
        priority: currentUser.role === 'center_admin' ? priority : undefined,
        resolutionSummary: currentUser.role === 'center_admin' ? resolutionSummary : undefined,
        verificationResult: currentUser.role === 'center_admin' ? verificationResult : undefined,
        centerInternalNotes: currentUser.role === 'center_admin' ? centerInternalNotes : undefined,
        postponeReason: postponeReason.trim(),
        rollbackReason: rollbackReason.trim(),
      });

      addToast({
        type: 'success',
        title: '狀態更新成功',
        message: `問題 [${selectedTicket.ticketNumber}] 狀態已更新為：${finalStatus}`,
      });
      fetchTickets();
    } catch (err: any) {
      console.error('Failed to update issue status:', err);
      addToast({
        type: 'error',
        title: '更新失敗',
        message: err?.message || '操作未完成',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !commentContent.trim()) return;

    setCommentLoading(true);
    try {
      await apiClient.addIssueComment(selectedTicket.id, {
        content: commentContent.trim(),
        isCenterInternal: currentUser.role === 'center_admin' ? isInternalComment : false,
      });

      addToast({
        type: 'success',
        title: '補充說明已記錄',
        message: '已成功留存發言紀錄與時間戳記。',
      });
      setCommentContent('');
      setIsInternalComment(false);
      fetchTickets();
    } catch (err: any) {
      console.error('Failed to add comment:', err);
      addToast({
        type: 'error',
        title: '留言失敗',
        message: err?.message || '無法儲存補充說明',
      });
    } finally {
      setCommentLoading(false);
    }
  };

  const getStatusBadge = (status: IssueStatus) => {
    switch (status) {
      case 'PENDING':
        return { label: '待處理', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'IN_PROGRESS':
        return { label: '處理中', color: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'WAITING_CONFIRM':
        return { label: '待確認', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'CLOSED':
        return { label: '已結案', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'POSTPONED':
        return { label: '暫緩', color: 'bg-slate-200 text-slate-700 border-slate-300' };
      default:
        return { label: status, color: 'bg-slate-100 text-slate-600' };
    }
  };

  const getTypeLabel = (type: IssueType) => {
    switch (type) {
      case 'OPERATION_FAILED':
        return '無法操作';
      case 'DATA_ANOMALY':
        return '資料異常';
      case 'PERMISSION_ISSUE':
        return '權限問題';
      case 'UI_DISPLAY':
        return '畫面問題';
      case 'FEATURE_REQUEST':
        return '功能建議';
      default:
        return type;
    }
  };

  const getPriorityBadge = (p: IssuePriority) => {
    switch (p) {
      case 'URGENT':
        return { label: '緊急', color: 'bg-rose-600 text-white' };
      case 'HIGH':
        return { label: '高', color: 'bg-amber-600 text-white' };
      case 'MEDIUM':
        return { label: '中', color: 'bg-slate-600 text-white' };
      case 'LOW':
        return { label: '低', color: 'bg-slate-400 text-white' };
      default:
        return { label: p, color: 'bg-slate-500 text-white' };
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題與操作欄 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {currentUser.role === 'center_admin' ? '試營運問題回報中心' : '問題回報與處理追蹤'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
              共 {tickets.length} 則回報
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentUser.role === 'center_admin'
              ? '代銷中心總部受理全門店試營運反饋、調整優先順序、填寫修復結果與結案驗證。'
              : currentUser.role === 'store_manager'
              ? '店長可查看本店業務同仁提出之所有回報，掌握系統處理進度與排除情況。'
              : '業務同仁專屬回報清單；回報後可持續補充說明，並於中心修復後確認結案或退回。'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
            title="重新整理"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onOpenReportModal}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>提出問題回報</span>
          </button>
        </div>
      </div>

      {/* 篩選工具列 */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>狀態：</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="ALL">全部狀態</option>
            <option value="PENDING">待處理</option>
            <option value="IN_PROGRESS">處理中</option>
            <option value="WAITING_CONFIRM">待確認</option>
            <option value="CLOSED">已結案</option>
            <option value="POSTPONED">暫緩</option>
          </select>

          <div className="flex items-center gap-1.5 font-bold text-slate-700 ml-2">
            <span>類型：</span>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="ALL">全部類型</option>
            <option value="OPERATION_FAILED">無法操作</option>
            <option value="DATA_ANOMALY">資料異常</option>
            <option value="PERMISSION_ISSUE">權限問題</option>
            <option value="UI_DISPLAY">畫面問題</option>
            <option value="FEATURE_REQUEST">功能建議</option>
          </select>

          {currentUser.role === 'center_admin' && (
            <>
              <div className="flex items-center gap-1.5 font-bold text-slate-700 ml-2">
                <span>門店：</span>
              </div>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ALL">全部門店</option>
                <option value="store_dunnan">敦南加盟旗艦店</option>
                <option value="store_banqiao">板橋特區旗艦店</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* 主版面：左側列表 + 右側詳細資訊與處理 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左側列表 */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center">
            <span>回報列表 ({tickets.length})</span>
            <span className="text-[11px] text-slate-400 font-normal">點選檢視與回覆</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                目前無符合條件之問題回報。
              </div>
            ) : (
              tickets.map((t) => {
                const statusBadge = getStatusBadge(t.status);
                const priorityBadge = getPriorityBadge(t.priority);
                const isSelected = selectedTicket?.id === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-rose-50/70 border-l-4 border-rose-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-slate-400 font-bold">
                            {t.ticketNumber}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${statusBadge.color}`}
                          >
                            {statusBadge.label}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${priorityBadge.color}`}
                          >
                            {priorityBadge.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 text-xs line-clamp-1">
                          {t.title}
                        </h3>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatDateTaipei(t.createdAt).split(' ')[0]}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1.5">
                      {t.description}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {t.reporterStoreName || '代銷中心'} · {t.reporterName}
                      </span>
                      <span className="text-slate-500 font-medium">
                        {getTypeLabel(t.type)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右側詳細資訊與處理工作區 */}
        <div className="lg:col-span-7 space-y-4">
          {selectedTicket ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 text-xs">
              {/* 問題頂部資訊 */}
              <div className="space-y-3 pb-4 border-b border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      {selectedTicket.ticketNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        getStatusBadge(selectedTicket.status).color
                      }`}
                    >
                      {getStatusBadge(selectedTicket.status).label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        getPriorityBadge(selectedTicket.priority).color
                      }`}
                    >
                      優先級：{getPriorityBadge(selectedTicket.priority).label}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-bold">
                      {getTypeLabel(selectedTicket.type)}
                    </span>
                  </div>

                  <span className="text-slate-400 text-[11px]">
                    回報時間：{formatDateTaipei(selectedTicket.createdAt, true)}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-900">
                  {selectedTicket.title}
                </h2>

                <div className="p-3 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-2 text-slate-600">
                  <div>
                    <span className="text-slate-400">回報者：</span>
                    <strong className="text-slate-800">{selectedTicket.reporterName}</strong>
                    <span className="text-slate-400 ml-1">（{selectedTicket.reporterRole === 'center_admin' ? '總部' : selectedTicket.reporterRole === 'store_manager' ? '店長' : '業務'}）</span>
                  </div>
                  <div>
                    <span className="text-slate-400">所屬門店：</span>
                    <strong className="text-slate-800">{selectedTicket.reporterStoreName || '代銷中心'}</strong>
                  </div>
                  {selectedTicket.pagePath && (
                    <div className="w-full text-slate-500 text-[11px] font-mono mt-1">
                      相關畫面：{selectedTicket.pagePath}
                    </div>
                  )}
                </div>
              </div>

              {/* 問題說明與重現步驟 */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">問題說明</h4>
                  <div className="p-3.5 bg-slate-50 rounded-xl text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.description}
                  </div>
                </div>

                {selectedTicket.reproductionSteps && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">重現步驟</h4>
                    <div className="p-3.5 bg-slate-50 rounded-xl text-slate-700 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.reproductionSteps}
                    </div>
                  </div>
                )}

                {(selectedTicket.expectedResult || selectedTicket.actualResult) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTicket.expectedResult && (
                      <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                        <span className="font-bold text-emerald-900 block mb-1">預期結果</span>
                        <p className="text-emerald-800 text-[11px]">{selectedTicket.expectedResult}</p>
                      </div>
                    )}
                    {selectedTicket.actualResult && (
                      <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl">
                        <span className="font-bold text-rose-900 block mb-1">實際結果</span>
                        <p className="text-rose-800 text-[11px]">{selectedTicket.actualResult}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 暫緩原因顯示 */}
                {selectedTicket.status === 'POSTPONED' && selectedTicket.postponeReason && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                    <strong className="block mb-1">暫緩原因：</strong>
                    <p className="text-xs">{selectedTicket.postponeReason}</p>
                  </div>
                )}

                {/* 代銷中心公開之修復與處理結果 */}
                {selectedTicket.resolutionSummary && (
                  <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl">
                    <div className="flex items-center gap-1.5 font-bold text-purple-900 mb-1">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>代銷中心處理結果與修復說明</span>
                    </div>
                    <p className="text-purple-950 text-xs leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.resolutionSummary}
                    </p>
                    {selectedTicket.verificationResult && (
                      <div className="mt-2 pt-2 border-t border-purple-200/60 text-purple-800 text-[11px]">
                        <strong>驗證結果：</strong> {selectedTicket.verificationResult}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 回報人（門店端業務/店長）操作區：若狀態為 WAITING_CONFIRM，可確認結案或退回 */}
              {currentUser.role !== 'center_admin' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>回報者確認回饋</span>
                  </h4>

                  {selectedTicket.status === 'WAITING_CONFIRM' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600">
                        代銷中心已將此問題標記為「待確認」，請依據您的測試狀況進行結案或退回：
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleUpdateStatus('CLOSED')}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" /> 確認已解決並結案
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <span className="font-bold text-rose-700 block">若仍可重現，退回處理中：</span>
                        <input
                          type="text"
                          value={rollbackReason}
                          onChange={(e) => setRollbackReason(e.target.value)}
                          placeholder="請說明仍可重現之狀況或現象..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                        <button
                          onClick={() => handleUpdateStatus('IN_PROGRESS')}
                          disabled={actionLoading || !rollbackReason.trim()}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-4 h-4" /> 退回處理中
                        </button>
                      </div>
                    </div>
                  ) : selectedTicket.status === 'CLOSED' ? (
                    <p className="text-xs text-emerald-700 font-semibold">
                      本問題已正式結案。若有其他新問題請提出新回報。
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      問題目前處於 [{getStatusBadge(selectedTicket.status).label}] 階段，代銷中心正全力排查中。
                    </p>
                  )}
                </div>
              )}

              {/* 中心總部專屬處理工作區 */}
              {currentUser.role === 'center_admin' && (
                <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl space-y-4 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-bold text-sm">代銷中心管理員處理控制台</h4>
                    </div>
                    <span className="text-[11px] text-slate-400">總部專用（內部備註不公開）</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">目標狀態</label>
                      <select
                        value={targetStatus}
                        onChange={(e) => setTargetStatus(e.target.value as IssueStatus)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                      >
                        <option value="PENDING">待處理</option>
                        <option value="IN_PROGRESS">處理中</option>
                        <option value="WAITING_CONFIRM">待確認（通知回報者驗證）</option>
                        <option value="CLOSED">已結案</option>
                        <option value="POSTPONED">暫緩（須填寫原因）</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">處理優先順序</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as IssuePriority)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                      >
                        <option value="URGENT">緊急 (URGENT)</option>
                        <option value="HIGH">高 (HIGH)</option>
                        <option value="MEDIUM">中 (MEDIUM)</option>
                        <option value="LOW">低 (LOW)</option>
                      </select>
                    </div>
                  </div>

                  {targetStatus === 'POSTPONED' && (
                    <div>
                      <label className="block text-amber-300 font-bold mb-1">暫緩原因說明 *</label>
                      <input
                        type="text"
                        value={postponeReason}
                        onChange={(e) => setPostponeReason(e.target.value)}
                        placeholder="例：等候外部金流/簡訊平台開放正式 API..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-amber-500/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      對回報者公開之處理結果 / 修復說明
                    </label>
                    <textarea
                      rows={2}
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="填寫已修復之說明、調整內容或建議作業方式..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                    />
                  </div>

                  {targetStatus === 'CLOSED' && (
                    <div>
                      <label className="block text-emerald-300 font-bold mb-1">結案驗證結果記錄</label>
                      <input
                        type="text"
                        value={verificationResult}
                        onChange={(e) => setVerificationResult(e.target.value)}
                        placeholder="例：已在隔離測試庫完成 3 筆下訂衝突覆核通過..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      中心內部處理備註（門店及業務端絕對隱藏，不回傳）
                    </label>
                    <input
                      type="text"
                      value={centerInternalNotes}
                      onChange={(e) => setCenterInternalNotes(e.target.value)}
                      placeholder="僅限中心管理員查閱之技術備註或處理評估..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 font-medium text-[11px]"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => handleUpdateStatus()}
                      disabled={actionLoading}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md transition-all flex items-center gap-2"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>儲存處理結果與更新狀態</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 歷程與留言討論區 */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-rose-600" />
                  <span>補充說明與討論歷程 ({selectedTicket.comments?.length || 0})</span>
                </h4>

                <div className="space-y-3">
                  {selectedTicket.comments?.length === 0 ? (
                    <p className="text-slate-400 text-xs italic">目前尚無補充說明。</p>
                  ) : (
                    selectedTicket.comments?.map((c) => (
                      <div
                        key={c.id}
                        className={`p-3.5 rounded-xl border ${
                          c.isCenterInternal
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            {c.authorName}（{c.authorStoreName || '代銷中心'}）
                            {c.isCenterInternal && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-200 text-amber-900 font-bold">
                                總部內部備註
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {formatDateTaipei(c.createdAt, true)}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* 填寫補充說明 */}
                <form onSubmit={handleAddComment} className="pt-2 space-y-2">
                  <textarea
                    required
                    rows={2}
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="輸入補充說明內容或問題重現補充..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />

                  <div className="flex items-center justify-between">
                    {currentUser.role === 'center_admin' ? (
                      <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                        <input
                          type="checkbox"
                          checked={isInternalComment}
                          onChange={(e) => setIsInternalComment(e.target.checked)}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                        <span>設為中心內部備註（加盟門店無法看見）</span>
                      </label>
                    ) : (
                      <span className="text-[11px] text-slate-400">發言將公開留存供代銷中心檢視</span>
                    )}

                    <button
                      type="submit"
                      disabled={commentLoading || !commentContent.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {commentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>發表補充說明</span>
                    </button>
                  </div>
                </form>

                {/* 狀態變更紀錄 Audit */}
                {selectedTicket.statusHistory?.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 block mb-2">處理狀態轉移日誌</span>
                    <div className="space-y-1 text-[11px] text-slate-500">
                      {selectedTicket.statusHistory.map((h) => (
                        <div key={h.id} className="flex items-center gap-2">
                          <span className="text-slate-400 font-mono">
                            {formatDateTaipei(h.createdAt, true)}
                          </span>
                          <span className="font-semibold text-slate-700">{h.operatorName}:</span>
                          <span>
                            {h.fromStatus} <ArrowRight className="inline w-3 h-3 text-slate-400" /> {h.toStatus}
                          </span>
                          {h.reason && <span className="text-slate-400 italic">({h.reason})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center text-slate-400 text-xs">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              請由左側點選任一問題回報，以檢視詳細說明與處理歷程。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
