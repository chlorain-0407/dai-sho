import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';
import { IssueType } from '../../types';
import {
  X,
  AlertTriangle,
  HelpCircle,
  Send,
  Loader2,
  ShieldCheck,
  FileQuestion,
  CheckCircle2,
} from 'lucide-react';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, activeTab, addToast } = useApp();

  const [type, setType] = useState<IssueType>('OPERATION_FAILED');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      addToast({ type: 'warning', title: '請填寫問題標題' });
      return;
    }
    if (!description.trim()) {
      addToast({ type: 'warning', title: '請填寫問題說明' });
      return;
    }

    setSubmitting(true);
    try {
      // 安全清理路徑，去除 query string、token 與個資
      const cleanedPagePath = window.location.pathname.split('?')[0] + ` [Tab: ${activeTab}]`;

      const res = await apiClient.createIssue({
        type,
        title: title.trim(),
        description: description.trim(),
        reproductionSteps: reproductionSteps.trim(),
        expectedResult: expectedResult.trim(),
        actualResult: actualResult.trim(),
        pagePath: cleanedPagePath,
        appVersion: 'v1.0.0-trial',
      });

      if (res.duplicatePrevented) {
        addToast({
          type: 'info',
          title: '已收到相同回報',
          message: '系統已自動攔截短時間內的重複點擊，回報已安全保存。',
        });
      } else {
        addToast({
          type: 'success',
          title: '問題回報成功',
          message: `回報編號：${res.ticket?.ticketNumber || res.ticketId}，代銷中心將依順序處理。`,
        });
      }

      onSuccess?.();
      onClose();
      // 重設表單
      setTitle('');
      setDescription('');
      setReproductionSteps('');
      setExpectedResult('');
      setActualResult('');
      setType('OPERATION_FAILED');
    } catch (err: any) {
      console.error('Failed to report issue:', err);
      addToast({
        type: 'error',
        title: '送出問題回報失敗',
        message: err?.message || '伺服器連線異常，請稍候重試',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600/30 text-rose-300 border border-rose-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">試營運問題與建議回報</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                回報人：{currentUser.name} · {currentUser.storeName || '代銷中心'}（{currentUser.role === 'center_admin' ? '總部管理員' : currentUser.role === 'store_manager' ? '店長' : '營業員'}）
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 隱私安全提示 */}
        <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2.5 text-xs text-amber-900">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>安全與隱私防護保證：</strong>
            本表單由後端自動記錄您的所屬門店與角色，純文字保存。系統已強制過濾任何客戶個資、網址參數、Token 或金鑰。
          </div>
        </div>

        {/* 表單主體 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              問題類型 <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { value: 'OPERATION_FAILED', label: '無法操作' },
                { value: 'DATA_ANOMALY', label: '資料異常' },
                { value: 'PERMISSION_ISSUE', label: '權限問題' },
                { value: 'UI_DISPLAY', label: '畫面問題' },
                { value: 'FEATURE_REQUEST', label: '功能建議' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setType(item.value as IssueType)}
                  className={`p-2.5 rounded-xl text-left border font-semibold transition-all ${
                    type === item.value
                      ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              問題標題 <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：點擊申報交易時按鈕無反應、客戶列表電話顯示異常等"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              問題說明 <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="請詳細描述遇到的狀況、畫面顯示內容或具體異常現象..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              重現步驟（選填）
            </label>
            <textarea
              rows={2}
              value={reproductionSteps}
              onChange={(e) => setReproductionSteps(e.target.value)}
              placeholder="1. 點擊我的客戶 2. 選擇建案A 3. 點擊申報交易"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                預期結果（選填）
              </label>
              <input
                type="text"
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                placeholder="例：應跳出成功提示並轉為下訂申報中"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                實際結果（選填）
              </label>
              <input
                type="text"
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                placeholder="例：按鈕呈載入中且未回應"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* 送出與取消 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>送出中...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>送出問題回報</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
