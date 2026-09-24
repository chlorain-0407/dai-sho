import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldAlert,
  Building2,
  UserCheck,
  RefreshCw,
  ChevronDown,
  Menu,
  X,
  Upload,
  Sparkles,
  Info,
  Database,
  HelpCircle,
} from 'lucide-react';

interface HeaderProps {
  onOpenResetModal: () => void;
  onOpenRegisterModal?: () => void;
  onOpenLoginModal?: () => void;
  onOpenReportModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenResetModal, onOpenLoginModal, onOpenReportModal }) => {
  const {
    currentUser,
    setCurrentUser,
    allUsers,
    mobileMenuOpen,
    setMobileMenuOpen,
    setActiveTab,
    dbConnected,
    loading,
    isDemoSession,
    logout,
  } = useApp();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'center_admin':
        return { label: '代銷中心總部', color: 'bg-rose-900 text-rose-100 border-rose-700' };
      case 'store_manager':
        return { label: '加盟門店店長', color: 'bg-indigo-900 text-indigo-100 border-indigo-700' };
      case 'agent':
        return { label: '加盟門店業務', color: 'bg-emerald-900 text-emerald-100 border-emerald-700' };
      default:
        return { label: '使用者', color: 'bg-slate-800 text-slate-200 border-slate-700' };
    }
  };

  const roleInfo = getRoleBadge(currentUser.role);

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      {/* 頂部示範模式強烈提示橫幅 */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-inner">
        <div className="flex items-center gap-2 mx-auto sm:mx-0">
          <ShieldAlert className="w-4 h-4 shrink-0 text-slate-950 animate-pulse" />
          <span>
            <strong>【試營運演示環境】</strong>
            本系統全站採虛擬示範資料與免密碼示範帳號，切勿輸入真實客戶姓名、電話或敏感個資。
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <button
            onClick={() => setActiveTab('architecture')}
            className="hover:underline flex items-center gap-1 font-semibold text-slate-900"
          >
            <Info className="w-3.5 h-3.5" /> 正式版架構規範
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* 左側：品牌名稱與官方 Logo 上傳預留區 */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none"
              aria-label="選單開關"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* 官方 Logo 預留上傳槽位 */}
            <label
              title="點擊可上傳太平洋房屋官方品牌 Logo 預覽（或使用預設標誌）"
              className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer overflow-hidden shrink-0 group transition-all"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Official Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-rose-400">
                  <Building2 className="w-5 h-5 text-rose-500" />
                  <span className="text-[8px] font-bold tracking-tighter text-slate-400">LOGO</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white">
                <Upload className="w-3.5 h-3.5" />
              </div>
            </label>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                  太平洋房屋
                </span>
                <span className="text-slate-400 text-sm hidden md:inline">｜</span>
                <span className="text-sm sm:text-base font-semibold text-rose-400 hidden sm:inline truncate">
                  預售與新成屋聯銷平台
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate hidden lg:block">
                代銷中心掌案源 · 門店拓在地客戶 · 平台護利益與分佣
              </p>
            </div>
          </div>

          {/* 右側：示範帳號切換與操作功能 */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* MongoDB 連線指標 */}
            <div
              title={
                dbConnected
                  ? '已連線至專屬 MongoDB 資料庫 (e8346c_dai_sho_t)，由 Node.js 後端 API 提供安全存取'
                  : '正在嘗試連線至 MongoDB 資料庫...'
              }
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800/80 border border-slate-700/80"
            >
              <Database className="w-3 h-3 text-emerald-400" />
              <span className="text-slate-300">MongoDB</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  dbConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-500 animate-ping'
                }`}
              />
            </div>

            {/* 回報問題按鈕 */}
            {onOpenReportModal && (
              <button
                onClick={onOpenReportModal}
                title="回報系統問題或功能建議"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/60 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>回報問題</span>
              </button>
            )}

            {/* 重設資料按鈕 */}
            <button
              onClick={onOpenResetModal}
              title="重設所有資料為初始示範狀態"
              disabled={loading}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-rose-400 ${loading ? 'animate-spin' : ''}`} />
              <span>重設示範資料</span>
            </button>

            {/* 登入 / 身分切換按鈕 */}
            <button
              onClick={onOpenLoginModal}
              title="使用 Google 登入或切換身分"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google 登入 / 註冊</span>
              <span className="sm:hidden">登入</span>
            </button>

            {/* 帳號切換下拉選單 */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 transition-all text-left focus:outline-none"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 to-rose-800 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                  {currentUser.name.slice(0, 1)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-100">{currentUser.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                    {!isDemoSession && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-blue-900/60 text-blue-200 border border-blue-700">
                        Google
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                    {currentUser.storeName || currentUser.title}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        切換示範身分 (免密碼)
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        點選即時重新套用該角色之視野與隔離資料
                      </p>
                    </div>
                  </div>

                  <div className="py-1 max-h-[360px] overflow-y-auto">
                    {allUsers.map((u) => {
                      const isCurrent = u.id === currentUser.id;
                      const badge = getRoleBadge(u.role);
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            setCurrentUser(u);
                            setUserDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left flex items-start gap-3 transition-colors ${
                            isCurrent
                              ? 'bg-rose-950/40 border-l-4 border-rose-500 text-white'
                              : 'hover:bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                              isCurrent
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {u.name.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-slate-100">{u.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{u.title}</p>
                            <p className="text-[11px] text-slate-500 truncate">{u.storeName || '代銷中心總部'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2 border-t border-slate-800 space-y-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenLoginModal?.();
                      }}
                      className="w-full py-2 px-3 text-xs text-rose-300 hover:bg-slate-800 rounded-lg flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> 正式 Google 登入 / 註冊
                    </button>
                    {!isDemoSession && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logout();
                        }}
                        className="w-full py-2 px-3 text-xs text-slate-400 hover:bg-slate-800 rounded-lg flex items-center justify-center gap-1.5"
                      >
                        登出切回示範模式
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
