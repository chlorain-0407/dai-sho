import React from 'react';
import { useApp, NavTab } from '../context/AppContext';
import {
  LayoutDashboard,
  Building,
  Home,
  Store,
  Users,
  CalendarCheck,
  BadgeDollarSign,
  ScrollText,
  FileCode2,
  Percent,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
  HelpCircle,
} from 'lucide-react';

interface SidebarProps {
  onOpenRegisterModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = () => {
  const {
    activeTab,
    setActiveTab,
    scopedData,
    currentUser,
    adminUsers,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useApp();

  // 待處理警示計數
  const pendingConflicts = (scopedData.registrations || []).filter((r) => r.status === 'CONFLICT_PENDING').length;
  const expiringCustomers = (scopedData.registrations || []).filter((r) => r.status === 'EXPIRING_SOON').length;
  const pendingRenewals = (scopedData.renewals || []).filter((r) => r.status === 'PENDING').length;
  const pendingTransactions = (scopedData.transactions || []).filter(
    (t) =>
      t.reviewStatus === 'PENDING_REVIEW' ||
      t.stage === 'DEPOSIT_REPORTED' ||
      t.stage === 'CONTRACT_REPORTED' ||
      t.stage === 'DEAL_REPORTED'
  ).length;
  const pendingApprovals = (adminUsers || []).filter((u) => u.status === 'PENDING_APPROVAL').length;

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badgeCount?: number;
    badgeColor?: string;
    centerOnly?: boolean;
    description: string;
  }[] = [
    {
      id: 'dashboard',
      label: '工作儀表板',
      icon: <LayoutDashboard className="w-4 h-4" />,
      description: '即時盤點與重要待辦',
    },
    {
      id: 'projects',
      label: currentUser.role === 'center_admin' ? '建案管理' : '我的建案',
      icon: <Building className="w-4 h-4" />,
      description: currentUser.role === 'center_admin' ? '預售/新成屋/餘屋案源與指派' : '已授權聯銷建案清單',
    },
    {
      id: 'units',
      label: '戶別管理',
      icon: <Home className="w-4 h-4" />,
      description: '格局坪數與開底價控管',
    },
    ...(currentUser.role === 'center_admin'
      ? [
          {
            id: 'stores' as NavTab,
            label: '門店與案源指派',
            icon: <Store className="w-4 h-4" />,
            description: '加盟門店建置與案源指派維護',
          },
        ]
      : []),
    {
      id: 'customers',
      label: currentUser.role === 'center_admin' ? '客戶管理與續期審核' : '我的客戶與保留',
      icon: <Users className="w-4 h-4" />,
      badgeCount: pendingConflicts > 0 ? pendingConflicts : expiringCustomers > 0 ? expiringCustomers : undefined,
      badgeColor: pendingConflicts > 0 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white',
      description: currentUser.role === 'center_admin' ? '專屬保留期、重複判定與展期審查' : '我的專屬客戶、追蹤待辦與30天保護',
    },
    {
      id: 'viewings',
      label: '帶看行程',
      icon: <CalendarCheck className="w-4 h-4" />,
      description: '現場接待行程與客戶回饋',
    },
    {
      id: 'transactions',
      label: currentUser.role === 'center_admin' ? '交易審核與確認' : '交易進度申報',
      icon: <BadgeDollarSign className="w-4 h-4" />,
      badgeCount: pendingTransactions > 0 ? pendingTransactions : undefined,
      badgeColor: 'bg-indigo-600 text-white',
      description: currentUser.role === 'center_admin' ? '下訂/簽約/成交覆核與分佣結算' : '申報進度、上傳憑證與成交試算',
    },
    {
      id: 'commission',
      label: '分佣版本與鎖定',
      icon: <Percent className="w-4 h-4" />,
      description: '登記即鎖定分佣快照',
    },
    ...(currentUser.role === 'center_admin'
      ? [
          {
            id: 'users' as NavTab,
            label: '帳號審核與權限',
            icon: <ShieldCheck className="w-4 h-4" />,
            badgeCount: pendingApprovals > 0 ? pendingApprovals : undefined,
            badgeColor: 'bg-amber-500 text-white animate-pulse',
            description: 'Google/業務開通與指派',
          },
        ]
      : []),
    {
      id: 'audit_logs',
      label: '操作稽核紀錄',
      icon: <ScrollText className="w-4 h-4" />,
      description: '關鍵異動與留存理由',
    },
    {
      id: 'issues',
      label: currentUser.role === 'center_admin' ? '問題回報處理' : '問題回報與追蹤',
      icon: <HelpCircle className="w-4 h-4" />,
      badgeColor: 'bg-rose-600 text-white',
      description: currentUser.role === 'center_admin' ? '試營運問題清單與處理進度' : '提出異常回報與進度追蹤',
    },
    {
      id: 'architecture',
      label: '正式版架構規範',
      icon: <FileCode2 className="w-4 h-4" />,
      description: 'API/DB/安全替代說明',
    },
  ];

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* 行動裝置背景遮罩 */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 導覽側邊欄主體 */}
      <aside
        className={`fixed lg:sticky top-16 left-0 z-20 h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            聯銷管理模組
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group ${
                  isActive
                    ? 'bg-rose-50 text-rose-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm tracking-tight truncate leading-tight">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                      item.badgeColor || 'bg-rose-600 text-white'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 底部角色權限狀態提示卡片 */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
            <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                當前視野範圍
              </span>
              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-normal">
                {currentUser.role === 'center_admin'
                  ? '代銷中心'
                  : currentUser.role === 'store_manager'
                  ? '門店店長'
                  : '專任業務'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {currentUser.role === 'center_admin' && '全域檢視全部建案、各店客戶、核准續期及交易確認。可查閱底價。'}
              {currentUser.role === 'store_manager' && `僅限「${currentUser.storeName}」指派建案與本店客戶，底價與其他門店隱私遮蔽。`}
              {currentUser.role === 'agent' && `僅限承接「${currentUser.name}」名下客戶與指派案源，嚴禁跨業務窺探明細。`}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
