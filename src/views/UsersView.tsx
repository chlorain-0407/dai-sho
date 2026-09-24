import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { apiClient } from '../../src/services/apiClient';
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  Building,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Plus,
  ArrowRightLeft,
  Edit,
  Trash2,
  FileBadge,
  Phone,
  BadgeCheck,
  UserPlus,
} from 'lucide-react';
import { PersonnelModal } from '../components/modals/PersonnelModal';
import { TransferStoreModal } from '../components/modals/TransferStoreModal';
import { BindAccountModal } from '../components/modals/BindAccountModal';

export const UsersView: React.FC = () => {
  const {
    currentUser,
    adminUsers,
    fetchAdminUsers,
    approveUser,
    toggleUserStatus,
    scopedData,
    refreshData,
    addToast,
    loading,
  } = useApp();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterStoreId, setFilterStoreId] = useState<string>('ALL');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Modals state
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [userToTransfer, setUserToTransfer] = useState<User | null>(null);

  const [isBindModalOpen, setIsBindModalOpen] = useState(false);
  const [userToBind, setUserToBind] = useState<User | null>(null);

  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('agent');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showOAuthConfig, setShowOAuthConfig] = useState(false);

  // Available stores
  const stores = scopedData.stores;

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return adminUsers.filter((u) => {
      const matchSearch =
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.boundEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.storeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.mobilePhone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.licenseNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.title || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        filterStatus === 'ALL'
          ? true
          : filterStatus === 'PENDING_APPROVAL'
          ? u.status === 'PENDING_APPROVAL'
          : filterStatus === 'PENDING_BINDING'
          ? u.status === 'PENDING_BINDING'
          : filterStatus === 'ACTIVE'
          ? u.status === 'ACTIVE'
          : u.status === 'DISABLED';

      const matchStore = filterStoreId === 'ALL' ? true : u.storeId === filterStoreId;
      const matchRole = filterRole === 'ALL' ? true : u.role === filterRole;

      return matchSearch && matchStatus && matchStore && matchRole;
    });
  }, [adminUsers, searchTerm, filterStatus, filterStoreId, filterRole]);

  // Counts
  const totalCount = adminUsers.length;
  const pendingCount = adminUsers.filter((u) => u.status === 'PENDING_APPROVAL').length;
  const pendingBindingCount = adminUsers.filter((u) => u.status === 'PENDING_BINDING').length;
  const activeCount = adminUsers.filter((u) => u.status === 'ACTIVE').length;
  const disabledCount = adminUsers.filter((u) => u.status === 'DISABLED').length;

  // Handlers
  const handleOpenCreatePersonnel = () => {
    setUserToEdit(null);
    setIsPersonnelModalOpen(true);
  };

  const handleOpenEditPersonnel = (user: User) => {
    setUserToEdit(user);
    setIsPersonnelModalOpen(true);
  };

  const handleOpenTransfer = (user: User) => {
    setUserToTransfer(user);
    setIsTransferModalOpen(true);
  };

  const handleOpenBind = (user: User) => {
    setUserToBind(user);
    setIsBindModalOpen(true);
  };

  const handleOpenApproveModal = (user: User) => {
    setApprovingUser(user);
    setSelectedRole(user.role && user.role !== 'agent' ? user.role : 'agent');
    setSelectedStoreId(user.storeId || stores[0]?.id || 'store_001');
  };

  const handleConfirmApproval = async () => {
    if (!approvingUser) return;
    setSubmitting(true);
    try {
      const storeObj = stores.find((s) => s.id === selectedStoreId);
      const storeName = selectedRole === 'center_admin' ? '太平洋房屋代銷中心' : storeObj?.name;
      await approveUser(
        approvingUser.id,
        selectedRole,
        selectedRole === 'center_admin' ? undefined : selectedStoreId,
        storeName
      );
      setApprovingUser(null);
    } catch {
      // toast is handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const confirmMsg =
      newStatus === 'DISABLED'
        ? `確定要停用同仁 [${user.name}] 嗎？\n停用期間該同仁將無法登入系統存取客戶與業務資料。`
        : `確定要開通並啟用同仁 [${user.name}] 嗎？`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await toggleUserStatus(user.id, newStatus);
    } catch {
      // toast handled
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`確定要刪除同仁 [${user.name}] 嗎？\n若該同仁名下已有客戶登記或交易紀錄，系統將予以防護並禁止刪除，請改用停用。`)) {
      return;
    }

    try {
      await apiClient.deleteUser(user.id);
      addToast({
        type: 'success',
        title: '同仁已安全刪除',
        message: `同仁 [${user.name}] 已成功自系統中移除。`,
      });
      await fetchAdminUsers();
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '無法刪除同仁',
        message: err?.message || '該同仁名下已有進行中業務紀錄，請先調店交接或改用停用模式以維護稽核歷史。',
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'center_admin':
        return { label: '代銷中心管理員', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'store_manager':
        return { label: '加盟店長', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'agent':
        return { label: '營業員', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      default:
        return { label: '待指派', color: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return { label: '在職/已啟用', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' };
      case 'PENDING_APPROVAL':
        return { label: '待審核開通', color: 'bg-amber-100 text-amber-800 border-amber-400 font-bold' };
      case 'PENDING_BINDING':
        return { label: '待綁定 Google', color: 'bg-sky-50 text-sky-800 border-sky-300' };
      case 'DISABLED':
        return { label: '已停用/停職', color: 'bg-rose-50 text-rose-700 border-rose-300' };
      default:
        return { label: '正常', color: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">人員資料與登入帳號管理</h1>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                {pendingCount} 人待開通
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            中心可先建立同仁基本資料，同仁以 Google 登入後再進行綁定，或預先指定信箱；調店前需處理業務交接，確保客戶保護不中斷。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowOAuthConfig(!showOAuthConfig)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
          >
            <KeyRound className="w-4 h-4 text-indigo-600" />
            <span>Google 登入設定</span>
          </button>
          {currentUser.role === 'center_admin' && (
            <button
              onClick={handleOpenCreatePersonnel}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>新增同仁資料</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">登錄同仁總數</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-bold text-slate-900">{totalCount}</strong>
            <span className="text-xs text-slate-400">人</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-amber-700 font-medium">待開通審核</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-bold text-amber-600">{pendingCount}</strong>
            <span className="text-xs text-amber-600 font-medium">人等待核可</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-sky-700 font-medium">待綁定 Google</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-bold text-sky-600">{pendingBindingCount}</strong>
            <span className="text-xs text-sky-600 font-medium">人尚未綁定</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-emerald-700 font-medium">在職啟用同仁</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-bold text-emerald-600">{activeCount}</strong>
            <span className="text-xs text-emerald-600 font-medium">名正常作業</span>
          </div>
        </div>
      </div>

      {/* Collapsible Google OAuth Guide */}
      {showOAuthConfig && (
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-5 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              太平洋房屋 Google Identity 身分認證與綁定指引
            </h3>
            <button
              onClick={() => setShowOAuthConfig(false)}
              className="text-xs text-indigo-700 hover:text-indigo-900 underline font-semibold"
            >
              收合說明
            </button>
          </div>
          <div className="text-xs text-indigo-950 space-y-2 leading-relaxed">
            <p>
              本系統採用<strong>「身分資料獨立建置 ＋ Google 單一登入 (SSO) 綁定」</strong>機制：
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>
                <strong>中心預先建立同仁名冊：</strong>代銷中心或加盟店長可先錄入同仁姓名、證照、所屬門店與公務電話，無須先獲取 Google 授權。
              </li>
              <li>
                <strong>同仁登入與自動媒合：</strong>同仁首次使用個人或公司 Google 帳號登入時，若中心已輸入該 Google Email，系統自動完成綁定認領；若未預先填寫，則產生開通申請由中心指派綁定。
              </li>
              <li>
                <strong>跨店調派與業務交接：</strong>同仁調動門店時，系統強制檢核未結案件，並自動批次轉移負責業務給接手人，避免客戶保護過期爭議。
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋姓名、信箱、Google 綁定帳號、手機、證照或門店..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'ALL', label: '全部' },
              { id: 'PENDING_APPROVAL', label: '待開通' },
              { id: 'PENDING_BINDING', label: '待綁定' },
              { id: 'ACTIVE', label: '在職' },
              { id: 'DISABLED', label: '停用' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                  filterStatus === tab.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Store Filter */}
          <select
            value={filterStoreId}
            onChange={(e) => setFilterStoreId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
          >
            <option value="ALL">全部門店</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
          >
            <option value="ALL">全部角色</option>
            <option value="agent">營業員</option>
            <option value="store_manager">加盟店長</option>
            <option value="center_admin">代銷中心管理員</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">查無符合條件之同仁名單</p>
            <p className="text-slate-400">請嘗試調整搜尋關鍵字或篩選標籤。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">同仁姓名 / 角色</th>
                  <th className="py-3 px-4">所屬加盟門店</th>
                  <th className="py-3 px-4">聯絡資訊</th>
                  <th className="py-3 px-4">證照字號</th>
                  <th className="py-3 px-4">Google 登入身分</th>
                  <th className="py-3 px-4">狀態</th>
                  <th className="py-3 px-4 text-right">操作管理</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((user) => {
                  const roleBadge = getRoleBadge(user.role);
                  const statusBadge = getStatusBadge(user.status);
                  const isBound = user.isBound || !!user.boundEmail;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Role */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                            {user.name ? user.name.slice(0, 1) : '同'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{user.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`px-2 py-0.2 rounded text-[10px] font-semibold border ${roleBadge.color}`}
                              >
                                {user.title || roleBadge.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Store */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">
                          {user.storeName || (user.role === 'center_admin' ? '代銷中心' : '待指派門店')}
                        </div>
                        {user.storeId && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {user.storeId}
                          </span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 space-y-0.5">
                        {user.mobilePhone && (
                          <div className="flex items-center gap-1 text-slate-700">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{user.mobilePhone}</span>
                          </div>
                        )}
                        {user.phone && !user.mobilePhone && (
                          <div className="text-slate-600">{user.phone}</div>
                        )}
                        {user.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {user.email}
                          </div>
                        )}
                      </td>

                      {/* License */}
                      <td className="py-3.5 px-4">
                        {user.licenseNumber ? (
                          <span className="font-mono text-slate-700 font-medium">
                            {user.licenseNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">未填寫</span>
                        )}
                      </td>

                      {/* Google Binding */}
                      <td className="py-3.5 px-4">
                        {isBound ? (
                          <div className="space-y-0.5">
                            <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              已綁定 Google
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[160px]">
                              {user.boundEmail || user.email}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenBind(user)}
                            className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors flex items-center gap-1"
                          >
                            <KeyRound className="w-3 h-3 text-amber-600" />
                            綁定帳號
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.color}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Approve button if pending */}
                          {user.status === 'PENDING_APPROVAL' && (
                            <button
                              onClick={() => handleOpenApproveModal(user)}
                              className="px-2.5 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-xs"
                            >
                              審核開通
                            </button>
                          )}

                          {/* Bind button if bound already, allow rebind */}
                          {isBound && (
                            <button
                              onClick={() => handleOpenBind(user)}
                              title="變更或解除 Google 帳號綁定"
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Transfer button */}
                          <button
                            onClick={() => handleOpenTransfer(user)}
                            title="跨店調派與業務交接"
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit button */}
                          <button
                            onClick={() => handleOpenEditPersonnel(user)}
                            title="編輯同仁基本資料"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle active / disabled */}
                          <button
                            onClick={() => handleToggleStatus(user)}
                            title={user.status === 'ACTIVE' ? '停用同仁' : '啟用同仁'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Delete */}
                          {currentUser.role === 'center_admin' && (
                            <button
                              onClick={() => handleDeleteUser(user)}
                              title="刪除同仁（防護檢查）"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Create / Edit Personnel */}
      <PersonnelModal
        isOpen={isPersonnelModalOpen}
        onClose={() => setIsPersonnelModalOpen(false)}
        userToEdit={userToEdit}
      />

      {/* Modal 2: Transfer Store & Handover */}
      <TransferStoreModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        user={userToTransfer}
      />

      {/* Modal 3: Bind / Rebind Google Account */}
      <BindAccountModal
        isOpen={isBindModalOpen}
        onClose={() => setIsBindModalOpen(false)}
        user={userToBind}
      />

      {/* Modal 4: Quick Approve Modal */}
      {approvingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-600" />
                審核開通新進同仁
              </h3>
              <button
                onClick={() => setApprovingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              即將為 <strong>{approvingUser.name}</strong>（{approvingUser.email || approvingUser.boundEmail}）正式指派加盟聯銷身分：
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">指派角色權限</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="approveRole"
                      value="agent"
                      checked={selectedRole === 'agent'}
                      onChange={() => setSelectedRole('agent')}
                    />
                    <span>營業員 (負責客戶帶看與申報)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="approveRole"
                      value="store_manager"
                      checked={selectedRole === 'store_manager'}
                      onChange={() => setSelectedRole('store_manager')}
                    />
                    <span>加盟店長 (綜理該店所有案源與同仁)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="approveRole"
                      value="center_admin"
                      checked={selectedRole === 'center_admin'}
                      onChange={() => setSelectedRole('center_admin')}
                    />
                    <span>代銷中心管理員 (總部全權限)</span>
                  </label>
                </div>
              </div>

              {selectedRole !== 'center_admin' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">指派所屬加盟門店</label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setApprovingUser(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                {submitting ? '開通中...' : '確認開通'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
