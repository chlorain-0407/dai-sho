import React from 'react';
import { useApp } from '../context/AppContext';
import {
  formatDateTaipei,
  formatCurrencyNTD,
  getRegistrationBadge,
  calculateReservationStatus,
  formatBuildingUnit,
} from '../rules';
import { CustomerRegistration, RenewalRequest, Transaction } from '../types';
import {
  Building2,
  Users,
  Clock,
  AlertTriangle,
  FileCheck,
  BadgeDollarSign,
  TrendingUp,
  UserPlus,
  CalendarCheck,
  Percent,
  Store,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenRegisterModal: () => void;
  onSelectCustomer: (reg: CustomerRegistration) => void;
  onOpenResolveConflict: (reg: CustomerRegistration) => void;
  onOpenReviewRenewal: (request: RenewalRequest) => void;
  onOpenConfirmTransaction: (transaction: Transaction) => void;
  onOpenNewProject: () => void;
  onOpenNewUnit: () => void;
  onOpenAssignStore: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenRegisterModal,
  onSelectCustomer,
  onOpenResolveConflict,
  onOpenReviewRenewal,
  onOpenConfirmTransaction,
  onOpenNewProject,
  onOpenNewUnit,
  onOpenAssignStore,
}) => {
  const {
    currentUser,
    allUsers,
    scopedData,
    setActiveTab,
    setCustomerFilterStatus,
    setTransactionFilterStage,
  } = useApp();

  // 統計數據
  const totalProjects = (scopedData.projects || []).length;
  const activeRegistrations = (scopedData.registrations || []).filter((r) => r.status === 'ACTIVE').length;
  const expiringRegistrations = (scopedData.registrations || []).filter((r) => r.status === 'EXPIRING_SOON');
  const conflictRegistrations = (scopedData.registrations || []).filter((r) => r.status === 'CONFLICT_PENDING');
  const pendingRenewals = (scopedData.renewals || []).filter((r) => r.status === 'PENDING');
  const pendingTransactions = (scopedData.transactions || []).filter(
    (t) =>
      t.stage === 'DEPOSIT_REPORTED' ||
      t.stage === 'CONTRACT_REPORTED' ||
      t.stage === 'DEAL_REPORTED'
  );

  // 累計鎖定佣金試算 (門店視角為門店應收，中心視角為全案代銷佣金)
  const totalCommissionLocked = (scopedData.commissionSnapshots || []).reduce((acc, s) => {
    if (s.formulaType === 'PERCENTAGE_TOTAL') {
      const avgPrice = 45000000;
      const rate = currentUser.role === 'center_admin' ? (s.percentage || 0) : s.storePercentage;
      return acc + (avgPrice * rate) / 100;
    }
    return acc + (s.fixedAmount || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* 歡迎與角色身份指引卡片 */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white tracking-wide">
                {currentUser.role === 'center_admin'
                  ? '代銷中心總部運營'
                  : currentUser.role === 'store_manager'
                  ? '加盟門店店務管理'
                  : '專任銷售經紀人'}
              </span>
              <span className="text-slate-400 text-xs">
                {currentUser.storeName || '太平洋房屋代銷中心'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              您好，{currentUser.name} {currentUser.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {currentUser.role === 'center_admin' &&
                '掌案源、定制度、審續期、決歸屬、覆核交易並統籌各加盟門店分佣利益。'}
              {currentUser.role === 'store_manager' &&
                `統籌「${currentUser.storeName}」全體業務案源推動、客戶30天專屬保護與續期申報進度。`}
              {currentUser.role === 'agent' &&
                '專注在地客源開發、實地帶看與成交流程，享有30天排他保留與不可覆寫分佣保障。'}
            </p>
          </div>

          {/* 快捷主動作按鈕 */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenRegisterModal}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <UserPlus className="w-4 h-4" />
              登記新客戶 (鎖定30天)
            </button>

            {currentUser.role === 'center_admin' && (
              <button
                onClick={onOpenNewProject}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-rose-400" />
                新增代理建案
              </button>
            )}

            {currentUser.role === 'center_admin' && (
              <button
                onClick={onOpenAssignStore}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Store className="w-3.5 h-3.5 text-amber-400" />
                門店案源指派
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 數據指標卡片網格 (點選可直接篩選跳轉) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 指派建案數 */}
        <div
          onClick={() => setActiveTab('projects')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">可售聯銷建案</span>
            <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-rose-50 text-slate-600 group-hover:text-rose-600 transition-colors">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{totalProjects}</span>
            <span className="text-[11px] text-slate-400">總戶數 {scopedData.units.length} 戶</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span>瀏覽可售戶別格局與開價</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* 有效保留客戶 */}
        <div
          onClick={() => {
            setCustomerFilterStatus('ACTIVE');
            setActiveTab('customers');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">專屬保留中客戶</span>
            <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-emerald-50 text-slate-600 group-hover:text-emerald-600 transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700">{activeRegistrations}</span>
            <span className="text-[11px] text-emerald-600 font-medium">30天期限保護</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span>鎖定不可覆寫分佣快照</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* 7天內即將到期 (重要警示) */}
        <div
          onClick={() => {
            setCustomerFilterStatus('EXPIRING_SOON');
            setActiveTab('customers');
          }}
          className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group bg-rose-50/20"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-rose-700">7天內即將到期</span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-600">{expiringRegistrations.length}</span>
            <span className="text-[11px] text-rose-600 font-medium">急需追蹤續期</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span>需具備14天有效追蹤方可申請</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* 待處理事項 (重複爭議 / 續期審核 / 交易覆核) */}
        <div
          onClick={() => {
            if (currentUser.role === 'center_admin') {
              setActiveTab('transactions');
            } else {
              setActiveTab('customers');
            }
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">待核辦重要事項</span>
            <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-indigo-50 text-slate-600 group-hover:text-indigo-600 transition-colors">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {conflictRegistrations.length + pendingRenewals.length + pendingTransactions.length}
            </span>
            <span className="text-[11px] text-slate-500">
              (爭議 {conflictRegistrations.length} · 續期 {pendingRenewals.length} · 交易 {pendingTransactions.length})
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span>點擊快速檢視核准清單</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* 待辦事項清單群組 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 區塊一：7天內即將到期客戶 (提醒門店及業務積極追蹤) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-900">7 天內即將到期保留名單</h2>
            </div>
            <button
              onClick={() => {
                setCustomerFilterStatus('EXPIRING_SOON');
                setActiveTab('customers');
              }}
              className="text-xs text-rose-600 hover:underline font-medium"
            >
              檢視全部
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {expiringRegistrations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                目前無 7 天內即將到期之客戶。
              </div>
            ) : (
              expiringRegistrations.slice(0, 4).map((reg) => {
                const customer = scopedData.customers.find((c) => c.id === reg.customerId);
                const project = scopedData.projects.find((p) => p.id === reg.projectId);
                const store = scopedData.stores.find((s) => s.id === reg.storeId);
                const agent = allUsers.find((u) => u.id === reg.agentId);
                const resStatus = calculateReservationStatus(reg);

                return (
                  <div
                    key={reg.id}
                    onClick={() => onSelectCustomer(reg)}
                    className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{customer?.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                          剩餘 {resStatus.daysLeft} 天
                        </span>
                        <span className="text-slate-400 text-[11px] truncate">
                          {project?.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        門店：{store?.name} · 業務：{agent?.name} · 到期日：{formatDateTaipei(reg.reservationExpiryDate)}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCustomer(reg);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg shrink-0 border border-rose-200"
                    >
                      查看／續期
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 區塊二：待審核續期與重複爭議 (代銷中心及門店權益維護) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">
                {currentUser.role === 'center_admin' ? '待代銷中心裁決事項' : '爭議與續期進度'}
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              共 {conflictRegistrations.length + pendingRenewals.length} 件
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {/* 重複爭議清單 */}
            {conflictRegistrations.map((cr) => {
              const customer = scopedData.customers.find((c) => c.id === cr.customerId);
              const project = scopedData.projects.find((p) => p.id === cr.projectId);
              const store = scopedData.stores.find((s) => s.id === cr.storeId);

              return (
                <div key={cr.id} className="p-3.5 bg-amber-50/40 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>跨門店重複登記待判定</span>
                    </div>
                    <p className="text-slate-700 mt-0.5 truncate">
                      客戶「{customer?.name}」於「{project?.name}」由【{store?.name}】再次送件。
                    </p>
                  </div>

                  {currentUser.role === 'center_admin' ? (
                    <button
                      onClick={() => onOpenResolveConflict(cr)}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shrink-0 shadow-xs"
                    >
                      裁定歸屬
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-700 font-medium shrink-0">
                      中心判定中
                    </span>
                  )}
                </div>
              );
            })}

            {/* 待審核續期申請 */}
            {pendingRenewals.map((pr) => {
              const reg = scopedData.registrations.find((r) => r.id === pr.customerRegistrationId);
              const customer = scopedData.customers.find((c) => c.id === reg?.customerId);
              const project = scopedData.projects.find((p) => p.id === reg?.projectId);
              const store = scopedData.stores.find((s) => s.id === pr.storeId);

              return (
                <div key={pr.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>保留續期申請 (+30天)</span>
                    </div>
                    <p className="text-slate-700 mt-0.5 truncate">
                      {store?.name} 申請延長「{customer?.name}」（{project?.name}）專屬保留期。
                    </p>
                  </div>

                  {currentUser.role === 'center_admin' ? (
                    <button
                      onClick={() => onOpenReviewRenewal(pr)}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shrink-0 shadow-xs"
                    >
                      審核准駁
                    </button>
                  ) : (
                    <span className="text-[11px] text-indigo-600 font-medium shrink-0">
                      已送出待審
                    </span>
                  )}
                </div>
              );
            })}

            {conflictRegistrations.length === 0 && pendingRenewals.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                目前無待處理之爭議或續期申請。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 區塊三：交易申報覆核管道 (申報中交易) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <BadgeDollarSign className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">進行中交易進度申報與核准</h2>
              <p className="text-[11px] text-slate-500">門店申報下訂/簽約/成交後，由代銷中心確認並同步戶別狀態與分佣</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('transactions')}
            className="text-xs text-rose-600 hover:underline font-medium"
          >
            查看交易明細
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              目前無申報待覆核之交易。
            </div>
          ) : (
            pendingTransactions.map((tx) => {
              const project = scopedData.projects.find((p) => p.id === tx.projectId);
              const unit = scopedData.units.find((u) => u.id === tx.unitId);
              const store = scopedData.stores.find((s) => s.id === tx.storeId);
              const reg = scopedData.registrations.find((r) => r.id === tx.customerRegistrationId);
              const customer = scopedData.customers.find((c) => c.id === reg?.customerId);

              let stageBadge = '下訂申報中';
              if (tx.stage === 'CONTRACT_REPORTED') stageBadge = '簽約申報中';
              if (tx.stage === 'DEAL_REPORTED') stageBadge = '成交申報中';

              return (
                <div
                  key={tx.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        {project?.name} · {formatBuildingUnit(unit?.building, unit?.unitNumber)}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {stageBadge}
                      </span>
                      <span className="text-rose-600 font-bold">
                        總價 {formatCurrencyNTD(tx.pendingDealPrice || tx.dealPrice || (tx as any).totalPrice, true)}
                      </span>
                    </div>
                    <p className="text-slate-500">
                      申報門店：{store?.name} · 買方客戶：{customer?.name} · 訂金：{formatCurrencyNTD(tx.pendingDepositAmount !== undefined ? tx.pendingDepositAmount : (tx.depositAmount || 0))}
                    </p>
                  </div>

                  {currentUser.role === 'center_admin' ? (
                    <button
                      onClick={() => onOpenConfirmTransaction(tx)}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shrink-0 shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      覆核確認／更新戶別
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      待代銷中心確認
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
