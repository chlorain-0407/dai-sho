import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldAlert,
  Building2,
  Clock,
  UserCheck,
  RefreshCw,
  LogOut,
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle,
} from 'lucide-react';

export const PendingApprovalView: React.FC = () => {
  const { currentUser, loginWithDemo, logout, addToast, refreshData } = useApp();
  const [checking, setChecking] = useState(false);

  const handleRecheckStatus = async () => {
    setChecking(true);
    try {
      await refreshData();
      addToast({
        type: 'info',
        title: '已重新檢查審核狀態',
        message: '您的帳號仍處於待開通審核中。若為測試環境，您可點擊下方按鈕切換為代銷中心管理員進行開通。',
      });
    } catch {
      // toast handled
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-white relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">太平洋房屋</h1>
            <p className="text-xs text-rose-400 font-medium">預售與新成屋加盟聯銷平台</p>
          </div>
        </div>

        {/* 狀態卡片 */}
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-amber-100">帳號已建立，目前為【待開通審核】狀態</span>
          </div>
          <p className="text-xs text-amber-300/90 leading-relaxed">
            您好，<strong>{currentUser.name}</strong>（{currentUser.email || currentUser.username}）！您的 Google 帳號已向系統完成登記。
          </p>
        </div>

        {/* 資安宣告說明 */}
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong>營業機密與個資隔離保護：</strong>
              依太平洋房屋加盟聯銷規範，新註冊使用者預設不具備任何專案、客戶個資與交易讀取權限，不可查看其他加盟門店或建案之底價。
            </p>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p>
              <strong>開通程序：</strong>
              請聯絡您所屬之<strong>太平洋房屋代銷中心總部運營人員</strong>。中心管理員將於管理介面核實您的加盟門店資格，並指派您的職務角色（店長或營業員）後，即可立即進入系統。
            </p>
          </div>
        </div>

        {/* 操作按鈕群 */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={handleRecheckStatus}
            disabled={checking}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>重新檢查總部審核狀態</span>
          </button>

          {/* 測試演示捷徑 */}
          <button
            onClick={() => loginWithDemo('center_admin')}
            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <UserCheck className="w-4 h-4" />
            <span>切換至【代銷中心管理員】前往審核開通</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={logout}
            className="w-full py-2 px-4 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>登出回到示範首頁</span>
          </button>
        </div>
      </div>
    </div>
  );
};
