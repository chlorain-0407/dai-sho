import React, { useState, useEffect } from 'react';
import { Store, User, Project } from '../../types';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import {
  Store as StoreIcon,
  X,
  Building2,
  Users,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit,
  Power,
  Trash2,
  Calendar,
  Layers,
  FileText,
  BadgeCheck,
} from 'lucide-react';

interface StoreDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store | null;
  onEditStore: (store: Store) => void;
  onOpenAssignProject?: (project?: Project) => void;
  onAddPersonnelToStore?: (storeId: string) => void;
}

export const StoreDetailModal: React.FC<StoreDetailModalProps> = ({
  isOpen,
  onClose,
  store,
  onEditStore,
  onOpenAssignProject,
  onAddPersonnelToStore,
}) => {
  const { currentUser, scopedData, refreshData, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'info' | 'projects' | 'personnel' | 'audits'>('info');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [statusActionPending, setStatusActionPending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Status toggle reason state
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [targetStatus, setTargetStatus] = useState<'ACTIVE' | 'DISABLED' | 'INACTIVE'>('ACTIVE');

  useEffect(() => {
    if (store && isOpen) {
      setActiveTab('info');
      setShowStatusConfirm(false);
      setStatusReason('');
      // Load audits
      setLoadingAudits(true);
      apiClient
        .getStoreAuditLogs(store.id)
        .then((res) => {
          if (res && res.auditLogs) {
            setAuditLogs(res.auditLogs);
          }
        })
        .catch((err) => console.error('Failed to load store audit logs:', err))
        .finally(() => setLoadingAudits(false));
    }
  }, [store, isOpen]);

  if (!isOpen || !store) return null;

  // Personnel in this store
  const storeMembers = (scopedData as any).allStorePersonnel
    ? (scopedData as any).allStorePersonnel.filter((u: User) => u.storeId === store.id)
    : [];

  // Assigned projects
  const assignedProjectIds = (scopedData.assignments || [])
    .filter((a) => a.storeId === store.id && a.status === 'ACTIVE')
    .map((a) => a.projectId);
  const assignedProjects = (scopedData.projects || []).filter((p) => p?.id ? assignedProjectIds.includes(p.id) : false);

  // Client registrations count
  const storeRegistrations = (scopedData.registrations || []).filter((r) => r.storeId === store.id);
  const activeRegs = storeRegistrations.filter((r) => r.status === 'ACTIVE').length;

  const handleStatusChangeSubmit = async () => {
    setStatusActionPending(true);
    try {
      await apiClient.updateStoreStatus(store.id, targetStatus, statusReason.trim() || '總部管理員手動調整門店狀態');
      addToast({
        type: 'success',
        title: '門店狀態已變更',
        message: `門店 [${store.name}] 狀態已切換為：${targetStatus === 'ACTIVE' ? '啟用' : targetStatus === 'DISABLED' ? '停用' : '待啟用'}。`,
      });
      setShowStatusConfirm(false);
      await refreshData();
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '變更狀態失敗',
        message: err?.message || '無法變更門店狀態',
      });
    } finally {
      setStatusActionPending(false);
    }
  };

  const handleDeleteStore = async () => {
    if (!window.confirm(`確定要刪除加盟門店 [${store.name}] 嗎？\n若門店已有同仁或聯銷指派紀錄，系統將予以防護並禁止刪除。`)) {
      return;
    }
    setDeleting(true);
    try {
      await apiClient.deleteStore(store.id);
      addToast({
        type: 'success',
        title: '門店已成功刪除',
        message: `門店 [${store.name}] 已安全自系統中移除。`,
      });
      await refreshData();
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '無法刪除門店',
        message: err?.message || '該門店已有指派紀錄或人員，請改用停用模式以維護稽核歷史。',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="p-6 bg-slate-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8">
            <div className="flex items-start gap-3">
              <span className="p-3 rounded-2xl bg-rose-600/30 text-rose-400 border border-rose-500/30 shrink-0">
                <StoreIcon className="w-7 h-7" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold">{store.name}</h1>
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-xs border border-slate-700">
                    代碼：{store.code}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      store.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : store.status === 'DISABLED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {store.status === 'ACTIVE' ? '正常營運中' : store.status === 'DISABLED' ? '已停用' : '待啟用'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>{store.city} {store.district} {store.address}</span>
                  {store.phone && <span>• 市話：{store.phone}</span>}
                </p>
              </div>
            </div>

            {/* Quick Actions for Center Admin */}
            {currentUser.role === 'center_admin' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onEditStore(store)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 text-rose-400" />
                  編輯資料
                </button>
                <button
                  onClick={() => {
                    setTargetStatus(store.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE');
                    setShowStatusConfirm(true);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors ${
                    store.status === 'ACTIVE'
                      ? 'bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/50'
                      : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {store.status === 'ACTIVE' ? '停用門店' : '開通啟用'}
                </button>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block text-[11px]">獲指派案源</span>
              <strong className="text-white text-base mt-0.5 block">{assignedProjects.length} 案</strong>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block text-[11px]">在職同仁數</span>
              <strong className="text-white text-base mt-0.5 block">{store.totalPersonnel || storeMembers.length} 名</strong>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block text-[11px]">專屬客戶保留額</span>
              <strong className="text-emerald-400 text-base mt-0.5 block">{activeRegs} 位</strong>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-slate-400 block text-[11px]">建檔時間</span>
              <strong className="text-slate-300 text-xs mt-1 block">
                {store.createdAt ? new Date(store.createdAt).toLocaleDateString('zh-TW') : '系統初始'}
              </strong>
            </div>
          </div>
        </div>

        {/* Status Confirmation Sub-Banner */}
        {showStatusConfirm && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 text-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                確認將門店狀態切換為：【{targetStatus === 'ACTIVE' ? '啟用' : '停用'}】？
              </h4>
              <button
                onClick={() => setShowStatusConfirm(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                取消
              </button>
            </div>
            {targetStatus === 'DISABLED' && (
              <p className="text-xs text-amber-800">
                門店停用後，該店所有人員在停用期間停止存取業務資料（建案、客戶、交易等），但人員資料與歷史紀錄完全保留。
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="請輸入變更理由（必填稽核備註，例：加盟合約期滿 / 店面整修結束開通）"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={handleStatusChangeSubmit}
                disabled={statusActionPending}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {statusActionPending ? '處理中...' : '確認執行'}
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-6 text-xs font-semibold text-slate-500">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            門店資料與服務
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'projects'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            授權聯銷建案 ({assignedProjects.length})
          </button>
          <button
            onClick={() => setActiveTab('personnel')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'personnel'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            所屬同仁清單 ({store.totalPersonnel || storeMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'audits'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            異動與稽核紀錄 ({auditLogs.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800">
          {/* Tab 1: 門店資料與服務 */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 基本登記 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    工商登記與門店識別
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">門店唯一識別碼 (ID)</span>
                      <span className="font-mono font-bold text-slate-800">{store.id}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">加盟店代碼</span>
                      <span className="font-mono font-bold text-rose-600">{store.code}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">加盟公司抬頭</span>
                      <span className="text-slate-800 font-medium">{store.companyName || '（未提供）'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">統一編號</span>
                      <span className="font-mono text-slate-800">{store.taxId || '（未提供）'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">店長姓名</span>
                      <span className="text-slate-800 font-semibold">{store.managerName || '待指派'}</span>
                    </div>
                  </div>
                </div>

                {/* 聯絡資訊 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    營業據點與對接管道
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">營業地址</span>
                      <span className="text-slate-800 font-medium text-right">
                        {store.city} {store.district} {store.address || '（未設定）'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">門店代表號</span>
                      <span className="font-medium text-slate-800">{store.phone || '（未設定）'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">聯絡窗口</span>
                      <span className="text-slate-800 font-medium">{store.contactPerson || '（未設定）'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">窗口手機/分機</span>
                      <span className="text-slate-800">{store.contactPhone || '（未設定）'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">窗口電子信箱</span>
                      <span className="text-slate-800">{store.contactEmail || '（未設定）'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 服務區域與擅長產品 */}
              <div className="space-y-4 pt-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">主要經營與服務區域：</h4>
                  <div className="flex flex-wrap gap-2">
                    {(store.serviceAreas && store.serviceAreas.length > 0) ? (
                      store.serviceAreas.map((area) => (
                        <span
                          key={area}
                          className="px-2.5 py-1 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200 font-medium flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3 text-rose-600" />
                          {area}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">尚未設定主要服務區域</span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">擅長產品與銷售類型：</h4>
                  <div className="flex flex-wrap gap-2">
                    {(store.specialties && store.specialties.length > 0) ? (
                      store.specialties.map((spec) => (
                        <span
                          key={spec}
                          className="px-2.5 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium flex items-center gap-1"
                        >
                          <BadgeCheck className="w-3 h-3 text-emerald-600" />
                          {spec}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">尚未設定擅長產品類型</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 內部備註 (僅中心可見) */}
              {currentUser.role === 'center_admin' && (
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-1.5">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    代銷中心內部備註（僅總部管理員可見）：
                  </h4>
                  <p className="text-xs text-amber-800 whitespace-pre-line leading-relaxed">
                    {store.internalNotes || '暫無內部備註事項。'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: 授權聯銷建案 */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">獲指派代銷聯銷之建案</h3>
                  <p className="text-xs text-slate-500">
                    僅獲中心指派之建案，該門店營業員方可進行客戶登記與銷售進度申報
                  </p>
                </div>
                {currentUser.role === 'center_admin' && onOpenAssignProject && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAssignProject();
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    調整聯銷指派權
                  </button>
                )}
              </div>

              {assignedProjects.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  目前尚未授權任何建案給此門店。中心端可隨時指派銷售案源。
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {assignedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-slate-900 block">{project.name}</span>
                          <span className="text-xs text-slate-500">建商：{project.builderName || '未填寫'}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {project.productType}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-3 pt-1 border-t border-slate-100">
                        <span>區域：{project.city} {project.district}</span>
                        <span>可售：{project.availableUnits || 0} 戶</span>
                        <span>價格：{project.priceRange || '洽詢代銷'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: 所屬同仁清單 */}
          {activeTab === 'personnel' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">門店同仁與營業員名冊</h3>
                  <p className="text-xs text-slate-500">
                    同仁建立後可綁定 Google 帳號，經總部審核開通即可登入進行業務
                  </p>
                </div>
                {currentUser.role === 'center_admin' && onAddPersonnelToStore && (
                  <button
                    onClick={() => {
                      onClose();
                      onAddPersonnelToStore(store.id);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    + 新增同仁資料
                  </button>
                )}
              </div>

              {storeMembers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  此門店目前尚無建置人員。門店可先建立基本資料，後續再加入人員。
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {storeMembers.map((member: User) => (
                    <div key={member.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                          {member.name ? member.name.slice(0, 1) : '同'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{member.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {member.title || (member.role === 'store_manager' ? '店長' : '營業員')}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.2 rounded-full font-semibold ${
                                member.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : member.status === 'PENDING_APPROVAL'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {member.status === 'ACTIVE' ? '在職' : member.status === 'PENDING_APPROVAL' ? '待開通' : '已停用'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                            {member.mobilePhone && <span>手機：{member.mobilePhone}</span>}
                            {member.licenseNumber && <span>證照：{member.licenseNumber}</span>}
                            <span>帳號：{member.boundEmail || member.email || member.username}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        {member.isBound || member.boundEmail ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <BadgeCheck className="w-3.5 h-3.5" /> 已綁定 Google
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">待綁定登入帳號</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: 異動與稽核紀錄 */}
          {activeTab === 'audits' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">門店安全與管理異動紀錄</h3>
                <p className="text-xs text-slate-500">
                  包含門店建立、編輯、狀態切換、案源授權與同仁調動紀錄
                </p>
              </div>

              {loadingAudits ? (
                <div className="p-8 text-center text-slate-400 text-xs">讀取異動紀錄中...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  暫無此門店之歷史異動紀錄。
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-semibold text-slate-800">
                          {log.operatorName} ({log.operatorRole === 'center_admin' ? '代銷中心' : '店長'})
                        </span>
                        <span>{new Date(log.createdAt).toLocaleString('zh-TW')}</span>
                      </div>
                      <p className="text-slate-700">{log.actionDescription}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {currentUser.role === 'center_admin' && (
              <button
                onClick={handleDeleteStore}
                disabled={deleting}
                className="text-xs text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? '檢查並刪除中...' : '刪除此門店 (安全防護)'}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
