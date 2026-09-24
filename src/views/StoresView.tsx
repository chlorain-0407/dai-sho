import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Store, Project } from '../types';
import {
  Store as StoreIcon,
  Building2,
  Users,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Power,
  Layers,
  ArrowUpDown,
  FileText,
  BadgeCheck,
} from 'lucide-react';
import { StoreModal } from '../components/modals/StoreModal';
import { StoreDetailModal } from '../components/modals/StoreDetailModal';
import { PersonnelModal } from '../components/modals/PersonnelModal';

interface StoresViewProps {
  onOpenAssignStore: (project?: Project) => void;
}

export const StoresView: React.FC<StoresViewProps> = ({ onOpenAssignStore }) => {
  const { scopedData, currentUser, allUsers, adminUsers, refreshData, addToast } = useApp();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'DISABLED'>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');

  // Modal States
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [storeToEdit, setStoreToEdit] = useState<Store | null>(null);

  const [selectedStoreForDetail, setSelectedStoreForDetail] = useState<Store | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [isAddPersonnelOpen, setIsAddPersonnelOpen] = useState(false);
  const [targetStoreIdForPersonnel, setTargetStoreIdForPersonnel] = useState<string>('');

  // Combined stores (scopedData.stores)
  const stores = scopedData.stores;

  // Extract all available cities for filtering
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (s.city) set.add(s.city);
    });
    return Array.from(set);
  }, [stores]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchSearch =
        (store.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (store.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (store.district || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (store.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (store.managerName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? store.status === 'ACTIVE'
          : statusFilter === 'INACTIVE'
          ? store.status === 'INACTIVE'
          : store.status === 'DISABLED';

      const matchCity = cityFilter === 'ALL' ? true : store.city === cityFilter;

      return matchSearch && matchStatus && matchCity;
    });
  }, [stores, searchTerm, statusFilter, cityFilter]);

  // Metric counts
  const totalCount = stores.length;
  const activeCount = stores.filter((s) => s.status === 'ACTIVE').length;
  const inactiveCount = stores.filter((s) => s.status === 'INACTIVE').length;
  const disabledCount = stores.filter((s) => s.status === 'DISABLED').length;

  // Open store creation
  const handleOpenCreateStore = () => {
    setStoreToEdit(null);
    setIsStoreModalOpen(true);
  };

  // Open store editing
  const handleOpenEditStore = (store: Store) => {
    setStoreToEdit(store);
    setIsStoreModalOpen(true);
  };

  // Open store detail
  const handleOpenDetail = (store: Store) => {
    setSelectedStoreForDetail(store);
    setIsDetailModalOpen(true);
  };

  // Open add personnel for store
  const handleOpenAddPersonnel = (storeId: string) => {
    setTargetStoreIdForPersonnel(storeId);
    setIsAddPersonnelOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <StoreIcon className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">門店管理</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            中心端可獨立建立加盟門店、設定服務區域與擅長產品；後續加入人員或指派代銷聯銷案源。以穩定 storeId 關聯。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentUser.role === 'center_admin' && (
            <>
              <button
                onClick={() => onOpenAssignStore()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5"
              >
                <Layers className="w-4 h-4 text-rose-600" />
                案源銷售指派
              </button>
              <button
                id="btn-add-store"
                onClick={handleOpenCreateStore}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                新增門店
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">總加盟門店數</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-bold text-slate-900">{totalCount}</strong>
            <span className="text-xs text-slate-400">間</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-emerald-700 font-medium">正常營業中</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-bold text-emerald-600">{activeCount}</strong>
            <span className="text-xs text-emerald-600 font-medium">間授權營運</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-amber-700 font-medium">待啟用 / 籌備中</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-bold text-amber-600">{inactiveCount}</strong>
            <span className="text-xs text-amber-600 font-medium">間待開通</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-rose-700 font-medium">已停用門店</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl font-bold text-rose-600">{disabledCount}</strong>
            <span className="text-xs text-slate-400">停止存取業務</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋門店名稱、代碼、縣市、行政區或店長..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['ALL', 'ACTIVE', 'INACTIVE', 'DISABLED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'ALL'
                  ? '全部'
                  : s === 'ACTIVE'
                  ? '營業中'
                  : s === 'INACTIVE'
                  ? '待啟用'
                  : '已停用'}
              </button>
            ))}
          </div>

          {/* City Filter */}
          {availableCities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium text-slate-700"
            >
              <option value="ALL">全部縣市</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Store Cards Matrix */}
      {filteredStores.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200 space-y-3">
          <StoreIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">查無符合條件之加盟門店</h3>
          <p className="text-xs text-slate-400">請嘗試調整搜尋關鍵字或狀態篩選條件，或直接新增門店。</p>
          {currentUser.role === 'center_admin' && (
            <div className="pt-2">
              <button
                id="btn-add-store-empty"
                onClick={handleOpenCreateStore}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                新增門店
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map((store) => {
            // Count staff members
            const storeMembers = allUsers.filter((u) => u.storeId === store.id);
            const totalStaffCount = store.totalPersonnel ?? storeMembers.length;

            // Assigned projects
            const assignedProjectIds = (scopedData.assignments || [])
              .filter((a) => a.storeId === store.id && a.status === 'ACTIVE')
              .map((a) => a.projectId);
            const assignedProjects = (scopedData.projects || []).filter((p) =>
              p?.id ? assignedProjectIds.includes(p.id) : false
            );

            // Registrations
            const storeRegistrations = (scopedData.registrations || []).filter((r) => r.storeId === store.id);
            const activeRegs = storeRegistrations.filter((r) => r.status === 'ACTIVE').length;

            return (
              <div
                key={store.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top: Name, Code & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900">{store.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {store.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {store.city} {store.district} {store.address}
                        </span>
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                        store.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                          : store.status === 'DISABLED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-300'
                          : 'bg-amber-50 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {store.status === 'ACTIVE' ? '正常營業' : store.status === 'DISABLED' ? '已停用' : '待啟用'}
                    </span>
                  </div>

                  {/* Manager & Contact */}
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px]">店長 / 窗口</span>
                      <strong className="text-slate-800">
                        {store.managerName || (store.contactPerson ? `${store.contactPerson} (對接窗口)` : '待指派店長')}
                      </strong>
                    </div>
                    {(store.phone || store.contactPhone) && (
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">門店電話</span>
                        <span className="text-slate-700">{store.phone || store.contactPhone}</span>
                      </div>
                    )}
                  </div>

                  {/* 3 Metric Pills */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <span className="text-slate-400 text-[10px]">授權案源</span>
                      <strong className="text-slate-900 text-sm mt-0.5 block">
                        {assignedProjects.length} 案
                      </strong>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                      <span className="text-emerald-700 text-[10px]">保留客戶</span>
                      <strong className="text-emerald-800 text-sm mt-0.5 block">
                        {activeRegs} 位
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <span className="text-slate-400 text-[10px]">在職同仁</span>
                      <strong className="text-slate-900 text-sm mt-0.5 block">
                        {totalStaffCount} 名
                      </strong>
                    </div>
                  </div>

                  {/* Service Areas & Specialties badges */}
                  <div className="space-y-1.5 pt-1">
                    {store.serviceAreas && store.serviceAreas.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-400">區域：</span>
                        {store.serviceAreas.slice(0, 3).map((area) => (
                          <span
                            key={area}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200"
                          >
                            {area}
                          </span>
                        ))}
                        {store.serviceAreas.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{store.serviceAreas.length - 3}</span>
                        )}
                      </div>
                    )}

                    {store.specialties && store.specialties.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-400">擅長：</span>
                        {store.specialties.slice(0, 2).map((spec) => (
                          <span
                            key={spec}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assigned projects pill previews */}
                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                      授權聯銷建案：
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {assignedProjects.slice(0, 2).map((p) => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 rounded-lg text-[11px] bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1 truncate max-w-[140px]"
                        >
                          <Building2 className="w-3 h-3 text-rose-600 shrink-0" />
                          <span className="truncate">{p.name}</span>
                        </span>
                      ))}
                      {assignedProjects.length > 2 && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-500 font-semibold">
                          +{assignedProjects.length - 2} 案
                        </span>
                      )}
                      {assignedProjects.length === 0 && (
                        <span className="text-slate-400 text-xs italic">尚未指派案源</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenDetail(store)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    查看門店詳情
                  </button>

                  <div className="flex items-center gap-1.5">
                    {currentUser.role === 'center_admin' && (
                      <button
                        onClick={() => handleOpenEditStore(store)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        編輯
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Store Create/Edit Modal */}
      <StoreModal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
        storeToEdit={storeToEdit}
      />

      {/* Store Detail Modal */}
      <StoreDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        store={selectedStoreForDetail}
        onEditStore={(s) => {
          setIsDetailModalOpen(false);
          handleOpenEditStore(s);
        }}
        onOpenAssignProject={onOpenAssignStore}
        onAddPersonnelToStore={(sId) => {
          handleOpenAddPersonnel(sId);
        }}
      />

      {/* Add Personnel Modal for Store */}
      <PersonnelModal
        isOpen={isAddPersonnelOpen}
        onClose={() => setIsAddPersonnelOpen(false)}
        defaultStoreId={targetStoreIdForPersonnel}
      />
    </div>
  );
};
