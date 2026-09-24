import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { repository } from '../services/repository';
import { apiClient } from '../services/apiClient';
import { Project, Unit, UnitStatus, ProjectStatus, ProjectAssignment, AssignmentStatus } from '../types';
import { ProjectModal } from './modals/ProjectModal';
import { UnitModal } from './modals/UnitModal';
import { AssignStoresModal } from './modals/AssignStoresModal';
import { AssignmentStatusModal } from './modals/AssignmentStatusModal';
import { formatBuildingUnit } from '../rules';
import {
  ArrowLeft,
  Building2,
  Edit3,
  Plus,
  Home,
  MapPin,
  Calendar,
  Layers,
  Phone,
  Shield,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  ShieldCheck,
  Check,
  Lock,
  PauseCircle,
  PlayCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  History,
  Store,
  UserCheck,
  Sparkles,
} from 'lucide-react';

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ project, onBack }) => {
  const { currentUser, scopedData, refreshData, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'units' | 'info' | 'materials' | 'assignments'>('units');
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // 戶別篩選
  const [unitSearch, setUnitSearch] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  const [selectedUnitStatus, setSelectedUnitStatus] = useState<string>('ALL');

  // 門店指派狀態與 Modal
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [isAssignStoresOpen, setIsAssignStoresOpen] = useState(false);
  const [statusModalConfig, setStatusModalConfig] = useState<{
    isOpen: boolean;
    assignment: ProjectAssignment | null;
    targetStatus: AssignmentStatus;
  }>({
    isOpen: false,
    assignment: null,
    targetStatus: 'ACTIVE',
  });
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'REVOKED'>('ALL');
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});

  // 載入本建案之門店指派紀錄 (僅中心管理員)
  const loadProjectAssignments = async () => {
    if (currentUser.role !== 'center_admin') return;
    setLoadingAssignments(true);
    try {
      const data = await apiClient.getProjectAssignments(project.id);
      setProjectAssignments(data);
    } catch (err) {
      console.error('Failed to load project assignments:', err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    loadProjectAssignments();
  }, [project.id]);

  const toggleHistory = (assignmentId: string) => {
    setExpandedHistories((prev) => ({
      ...prev,
      [assignmentId]: !prev[assignmentId],
    }));
  };

  // 取出本建案在 scopedData 的即時資料（確保資料最新）
  const liveProject = useMemo(() => {
    return scopedData.projects.find((p) => p.id === project.id) || project;
  }, [scopedData.projects, project]);

  // 取出本建案的所有戶別
  const projectUnits = useMemo(() => {
    return scopedData.units.filter((u) => u.projectId === liveProject.id);
  }, [scopedData.units, liveProject.id]);

  // 統計數值
  const stats = useMemo(() => {
    const validUnits = projectUnits.filter((u) => u && u.status !== 'DISABLED');
    const availableUnits = validUnits.filter((u) => u.status === 'AVAILABLE').length;
    const reservedUnits = validUnits.filter((u) => u.status && ['NEGOTIATING', 'RESERVED_DEPOSIT'].includes(u.status)).length;
    const closedUnits = validUnits.filter((u) => u.status && ['SIGNED', 'DEAL_CLOSED'].includes(u.status)).length;

    // 價格區間計算 (單位：萬元)
    const pricesWan = validUnits
      .map((u) => u.listPrice)
      .filter((p) => p !== undefined && p !== null && !isNaN(p) && p > 0)
      .map((p) => Math.round(p / 10000));
    const minPrice = pricesWan.length > 0 ? Math.min(...pricesWan) : 0;
    const maxPrice = pricesWan.length > 0 ? Math.max(...pricesWan) : 0;

    return {
      totalUnits: validUnits.length,
      availableUnits,
      reservedUnits,
      closedUnits,
      minPrice,
      maxPrice,
    };
  }, [projectUnits]);

  // 棟別清單
  const buildingOptions = useMemo(() => {
    const set = new Set<string>();
    projectUnits.forEach((u) => {
      if (u.building) set.add(u.building);
    });
    return Array.from(set).sort();
  }, [projectUnits]);

  // 篩選後戶別
  const filteredUnits = useMemo(() => {
    return projectUnits.filter((u) => {
      if (selectedBuilding !== 'ALL' && u.building !== selectedBuilding) return false;
      if (selectedUnitStatus !== 'ALL' && u.status !== selectedUnitStatus) return false;
      if (unitSearch.trim()) {
        const q = unitSearch.trim().toLowerCase();
        const matchNumber = u.unitNumber ? u.unitNumber.toLowerCase().includes(q) : false;
        const matchBuilding = u.building ? u.building.toLowerCase().includes(q) : false;
        const matchPattern = u.pattern ? u.pattern.toLowerCase().includes(q) : false;
        const matchNotes = u.notes ? u.notes.toLowerCase().includes(q) : false;
        if (!matchNumber && !matchBuilding && !matchPattern && !matchNotes) return false;
      }
      return true;
    });
  }, [projectUnits, selectedBuilding, selectedUnitStatus, unitSearch]);

  // 篩選後門店指派清單
  const filteredAssignments = useMemo(() => {
    return projectAssignments.filter((a) => {
      if (assignmentStatusFilter !== 'ALL' && a.status !== assignmentStatusFilter) return false;
      if (assignmentSearch.trim()) {
        const q = assignmentSearch.trim().toLowerCase();
        const matchName = a.storeName ? a.storeName.toLowerCase().includes(q) : false;
        const matchCode = a.storeCode ? a.storeCode.toLowerCase().includes(q) : false;
        const matchReason = a.reason ? a.reason.toLowerCase().includes(q) : false;
        const matchNotes = a.salesNotesForStore ? a.salesNotesForStore.toLowerCase().includes(q) : false;
        if (!matchName && !matchCode && !matchReason && !matchNotes) return false;
      }
      return true;
    });
  }, [projectAssignments, assignmentStatusFilter, assignmentSearch]);

  const activeAssignmentsCount = projectAssignments.filter((a) => a.status === 'ACTIVE').length;
  const pausedAssignmentsCount = projectAssignments.filter((a) => a.status === 'PAUSED').length;
  const revokedAssignmentsCount = projectAssignments.filter((a) => a.status === 'REVOKED').length;

  // 快速切換建案狀態
  const handleStatusChange = async (newStatus: ProjectStatus) => {
    try {
      await repository.updateProjectStatus(liveProject.id, newStatus, currentUser);
      addToast({
        type: 'success',
        title: '建案狀態已更新',
        message: `建案「${liveProject.name}」狀態已切換為 [${newStatus}]。`,
      });
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '狀態變更失敗',
        message: err.message || '伺服器處理錯誤',
      });
    }
  };

  // 刪除 / 停用戶別 (規則 6：若有關聯紀錄則後端自動轉停用)
  const handleDeleteUnit = async (u: Unit) => {
    const unitLabel = formatBuildingUnit(u.building, u.unitNumber);
    const confirmMsg = `確定要刪除或移除戶別「${unitLabel}」嗎？\n\n＊ 若此戶別已有交易、帶看或客戶意向紀錄，系統將自動轉為「停用 (DISABLED)」狀態，完整保留歷史稽核軌跡。`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await repository.deleteUnit(u.id, currentUser);
      if (res?.action === 'DISABLED') {
        addToast({
          type: 'info',
          title: '戶別已轉為停用',
          message: res.message || '已安全轉為停用並保留歷程。',
        });
      } else {
        addToast({
          type: 'success',
          title: '戶別已刪除',
          message: `戶別「${unitLabel}」已順利移除。`,
        });
      }
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '操作失敗',
        message: err.message || '伺服器處理錯誤',
      });
    }
  };

  // 輔助標籤：產品型態文字
  const getProductTypeLabel = (type?: string) => {
    switch (type) {
      case 'PRE_SALE':
        return '預售屋';
      case 'NEW_CONSTRUCTION':
        return '新成屋';
      case 'SURPLUS_HOUSE':
        return '餘屋代銷';
      default:
        return '住宅案';
    }
  };

  // 輔助標籤：建物型態文字
  const getBuildingTypeLabel = (type?: string) => {
    switch (type) {
      case 'BUILDING':
        return '大樓';
      case 'MANSION':
        return '華廈';
      case 'TOWNHOUSE':
        return '透天別墅';
      case 'OTHER':
        return '複合商辦';
      default:
        return '集合住宅';
    }
  };

  // 輔助狀態樣式
  const getUnitStatusBadge = (st: UnitStatus) => {
    switch (st) {
      case 'AVAILABLE':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">可售</span>;
      case 'NEGOTIATING':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">洽談保留</span>;
      case 'RESERVED_DEPOSIT':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">已收訂</span>;
      case 'SIGNED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">已簽約</span>;
      case 'DEAL_CLOSED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">已成交</span>;
      case 'PAUSED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">暫停銷售</span>;
      case 'DISABLED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">已停用(留存)</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{st}</span>;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* 頂部導航列與功能列 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 font-semibold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            返回建案列表
          </button>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div>
            <span className="text-xs text-slate-400">代銷中心案源詳情管理</span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              {liveProject.name}
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                {getProductTypeLabel(liveProject.productType)}
              </span>
            </h1>
          </div>
        </div>

        {/* 狀態切換與操作按鈕 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">建案狀態：</span>
            <select
              value={liveProject.status || 'ON_SALE'}
              onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ON_SALE">🟢 上架熱銷 (ON_SALE)</option>
              <option value="DRAFT">⚪ 草稿建檔 (DRAFT)</option>
              <option value="PAUSED">🟡 暫停推案 (PAUSED)</option>
              <option value="CLOSED">🔴 結案完銷 (CLOSED)</option>
            </select>
          </div>

          <button
            onClick={() => setIsEditProjectOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            編輯基本資料
          </button>

          <button
            onClick={() => setIsAddUnitOpen(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            新增戶別
          </button>
        </div>
      </div>

      {/* 核心資訊與動態統計看板 (規則 4：可售戶數由戶別資料計算，不以手動數字代替) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">可售戶數 / 總戶數</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{stats.availableUnits}</span>
            <span className="text-xs font-bold text-slate-400">/ 共 {stats.totalUnits} 戶</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">＊系統動態加總，隨戶別即時連動</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">戶別總開價區間</span>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate">
            {stats.minPrice > 0 ? (
              <>
                {stats.minPrice.toLocaleString()} ~ {stats.maxPrice.toLocaleString()} <span className="text-xs font-normal text-slate-500">萬元</span>
              </>
            ) : (
              <span className="text-xs text-slate-400">尚未建立開價</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">單位標示：新台幣萬元</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">建築規格與坪數</span>
          <div className="text-sm font-bold text-slate-800 truncate">
            {getBuildingTypeLabel(liveProject.buildingType)} · {liveProject.pingRange || '坪數未載'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            基地：{liveProject.baseAreaPings ? `${liveProject.baseAreaPings} 坪` : '面積未填'} · {liveProject.floorPlanInfo || '樓層未載'}
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">完工狀態與期程</span>
          <div className="text-sm font-bold text-slate-800 truncate">
            {liveProject.completionDateType === 'ACTUAL' ? '實際已完工' : '預計完工'} · {liveProject.completionDate || '待定'}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            {liveProject.city}{liveProject.district} · {liveProject.developer || '建商未公開'}
          </p>
        </div>
      </div>

      {/* 分頁 Tab 切換 */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 rounded-xl text-xs font-medium">
        <button
          onClick={() => setActiveTab('units')}
          className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'units'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Home className="w-4 h-4" />
          可售戶別清單 ({projectUnits.length})
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'info'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          建案基本資料與規格
        </button>
        <button
          onClick={() => setActiveTab('materials')}
          className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'materials'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          銷售素材專區
        </button>
        {currentUser.role === 'center_admin' && (
          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'assignments'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            銷售門店 ({projectAssignments.length})
          </button>
        )}
      </div>

      {/* Tab 1: 可售戶別清單管理 */}
      {activeTab === 'units' && (
        <div className="space-y-3.5">
          {/* 搜尋與篩選列 */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder="搜尋戶號、棟別、格局或備註..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
                />
              </div>

              {/* 棟別快選 */}
              {buildingOptions.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[11px]">棟別：</span>
                  <select
                    value={selectedBuilding}
                    onChange={(e) => setSelectedBuilding(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    <option value="ALL">全部棟別</option>
                    {buildingOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}棟
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 狀態篩選 */}
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[11px]">狀態：</span>
                <select
                  value={selectedUnitStatus}
                  onChange={(e) => setSelectedUnitStatus(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="ALL">全部狀態</option>
                  <option value="AVAILABLE">可售 (AVAILABLE)</option>
                  <option value="NEGOTIATING">洽談保留 (NEGOTIATING)</option>
                  <option value="RESERVED_DEPOSIT">已收訂 (RESERVED)</option>
                  <option value="SIGNED">已簽約 (SIGNED)</option>
                  <option value="DEAL_CLOSED">已成交 (DEAL_CLOSED)</option>
                  <option value="PAUSED">暫停 (PAUSED)</option>
                  <option value="DISABLED">已停用 (DISABLED)</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setIsAddUnitOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              新增戶別
            </button>
          </div>

          {/* 戶別表格 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredUnits.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Home className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">目前尚無符合條件之戶別</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  可點擊上方「新增戶別」按鈕為此建案建立戶別資料，戶別開價與可售狀態將即時同步至總覽。
                </p>
                <button
                  onClick={() => setIsAddUnitOpen(true)}
                  className="mt-4 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  立即新增第一筆戶別
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-3.5">戶別編號</th>
                      <th className="py-3 px-3.5">格局規劃</th>
                      <th className="py-3 px-3.5">建物登記坪數</th>
                      <th className="py-3 px-3.5">車位規格</th>
                      <th className="py-3 px-3.5 text-right">房屋開價</th>
                      <th className="py-3 px-3.5 text-right">車位開價</th>
                      <th className="py-3 px-3.5 text-right font-black text-slate-900">總開價 (萬元)</th>
                      {currentUser.role === 'center_admin' && (
                        <th className="py-3 px-3.5 text-right text-rose-700 bg-rose-50/30">
                          底價 (中心專屬)
                        </th>
                      )}
                      <th className="py-3 px-3.5 text-center">銷售狀態</th>
                      <th className="py-3 px-3.5 text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUnits.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900 text-sm">
                            {formatBuildingUnit(u.building, u.unitNumber)}
                          </div>
                          <span className="text-[11px] text-slate-400">{u.floor} 樓</span>
                        </td>

                        <td className="py-3 px-3.5">
                          <span className="font-semibold text-slate-800">{u.pattern || '格局未填'}</span>
                          {u.notes && (
                            <p className="text-[10px] text-slate-500 truncate max-w-[140px]" title={u.notes}>
                              {u.notes}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <span>{u.totalPing || u.areaPings || 0} 坪</span>
                            {u.includesParking ? (
                              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                                含車位
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                車位另計
                              </span>
                            )}
                          </div>
                          {(u.mainPing || u.commonPing) && (
                            <span className="text-[10px] text-slate-400 block">
                              主 {u.mainPing || '-'} 坪 · 公設 {u.commonPing || '-'} 坪
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3.5">
                          <span className="text-slate-800 font-medium">{u.parkingNumber || '無車位'}</span>
                          {u.parkingType && (
                            <span className="text-[10px] text-slate-400 block">{u.parkingType}</span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 text-right font-medium text-slate-700">
                          {u.housePrice ? `${(u.housePrice / 10000).toLocaleString('zh-TW')} 萬` : '-'}
                        </td>

                        <td className="py-3 px-3.5 text-right font-medium text-slate-700">
                          {u.parkingPrice ? `${(u.parkingPrice / 10000).toLocaleString('zh-TW')} 萬` : '-'}
                        </td>

                        <td className="py-3 px-3.5 text-right font-black text-rose-700 text-sm">
                          {u.listPrice ? `${(u.listPrice / 10000).toLocaleString('zh-TW')} 萬` : '未載'}
                        </td>

                        {currentUser.role === 'center_admin' && (
                          <td className="py-3 px-3.5 text-right font-bold text-rose-900 bg-rose-50/20">
                            {u.bottomPrice !== undefined && u.bottomPrice !== null ? (
                              <span className="inline-flex items-center gap-1">
                                <Lock className="w-3 h-3 text-rose-500" />
                                {(u.bottomPrice / 10000).toLocaleString('zh-TW')} 萬
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        )}

                        <td className="py-3 px-3.5 text-center">{getUnitStatusBadge(u.status)}</td>

                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingUnit(u)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => handleDeleteUnit(u)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="移除或停用戶別 (若具關聯紀錄則自動停用留存)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: 建案基本資料與規格 (完整展現 Section 二所有欄位) */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6 text-xs animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">建案基本資料與規劃規格表</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                欄位均依業務規範建立，標明坪數、金額與日期單位。未知資料允許留空，不自動偽造。
              </p>
            </div>
            <button
              onClick={() => setIsEditProjectOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              修改資料
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基本資料卡 */}
            <div className="space-y-3.5 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-rose-600" /> 建案基礎與地理區位
              </h4>
              <dl className="grid grid-cols-3 gap-2">
                <dt className="text-slate-500 font-medium">建案名稱：</dt>
                <dd className="col-span-2 font-bold text-slate-900">{liveProject.name}</dd>

                <dt className="text-slate-500 font-medium">投資興建：</dt>
                <dd className="col-span-2 text-slate-800">{liveProject.developer || '尚未載明'}</dd>

                <dt className="text-slate-500 font-medium">產品類型：</dt>
                <dd className="col-span-2 font-semibold text-slate-800">
                  {getProductTypeLabel(liveProject.productType)}
                </dd>

                <dt className="text-slate-500 font-medium">建物型態：</dt>
                <dd className="col-span-2 text-slate-800">{getBuildingTypeLabel(liveProject.buildingType)}</dd>

                <dt className="text-slate-500 font-medium">基地地址：</dt>
                <dd className="col-span-2 text-slate-800">
                  {liveProject.city}{liveProject.district} {liveProject.address || '（地址未提供）'}
                </dd>

                <dt className="text-slate-500 font-medium">接待中心：</dt>
                <dd className="col-span-2 text-slate-800">{liveProject.receptionAddress || '同基地現場'}</dd>

                <dt className="text-slate-500 font-medium">接待電話：</dt>
                <dd className="col-span-2 text-slate-800">{liveProject.receptionContact || '未提供'}</dd>
              </dl>
            </div>

            {/* 建築規模與規劃規格 */}
            <div className="space-y-3.5 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-rose-600" /> 建築規模與規劃規格
              </h4>
              <dl className="grid grid-cols-3 gap-2">
                <dt className="text-slate-500 font-medium">基地面積：</dt>
                <dd className="col-span-2 font-semibold text-slate-800">
                  {liveProject.baseAreaPings ? `${liveProject.baseAreaPings} 坪` : '未載明'}
                </dd>

                <dt className="text-slate-500 font-medium">樓層規劃：</dt>
                <dd className="col-span-2 text-slate-800">{liveProject.floorPlanInfo || '未載明'}</dd>

                <dt className="text-slate-500 font-medium">房型規劃：</dt>
                <dd className="col-span-2 text-slate-800">{liveProject.roomTypes || '未載明'}</dd>

                <dt className="text-slate-500 font-medium">坪數範圍：</dt>
                <dd className="col-span-2 text-slate-800">{liveProject.pingRange ? `${liveProject.pingRange} 坪` : '未載明'}</dd>

                <dt className="text-slate-500 font-medium">車位類型：</dt>
                <dd className="col-span-2 text-slate-800">{liveProject.parkingType || '未載明'}</dd>

                <dt className="text-slate-500 font-medium">完工時程：</dt>
                <dd className="col-span-2 font-semibold text-slate-800">
                  {liveProject.completionDateType === 'ACTUAL' ? '實際已完工' : '預計完工'}：
                  {liveProject.completionDate || '待公布'}
                </dd>

                <dt className="text-slate-500 font-medium">戶數統計：</dt>
                <dd className="col-span-2 font-bold text-emerald-700">
                  可售 {stats.availableUnits} 戶 / 總計 {stats.totalUnits} 戶 (系統依戶別清單實時加總)
                </dd>
              </dl>
            </div>
          </div>

          {/* 特色與介紹 */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs">建案介紹及產品特色</h4>
            <p className="text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {liveProject.description || '暫無詳細文字介紹。'}
            </p>
            {liveProject.highlights && liveProject.highlights.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {liveProject.highlights.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]"
                  >
                    ✦ {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 窗口與內部備註 (內部備註僅中心管理員可視) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-rose-600" /> 代銷中心專案承辦人
              </h4>
              <p className="text-slate-700">
                承辦專員：<span className="font-semibold">{liveProject.centerContactPerson || '總部代銷處'}</span>
              </p>
              <p className="text-slate-700">
                聯絡電話：<span className="font-semibold">{liveProject.centerContactPhone || '未提供'}</span>
              </p>
              <p className="text-slate-700">
                電子信箱：<span className="font-semibold">{liveProject.centerContactEmail || '未提供'}</span>
              </p>
            </div>

            {currentUser.role === 'center_admin' && (
              <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-rose-600" /> 代銷中心內部專屬備註 (機密保護)
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 bg-rose-200 text-rose-800 rounded font-bold">
                    僅中心管理員可見
                  </span>
                </div>
                <p className="text-rose-900 whitespace-pre-wrap leading-relaxed">
                  {liveProject.internalNotes || '無特殊內部備忘條款。'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: 銷售素材專區 (完整展現 Section 四照片與說明) */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6 text-xs animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">建案銷售素材專區</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                包含封面、外觀實景、公設樣品屋照片、格局圖、建材設備與經紀人銷售說明。
              </p>
            </div>
            <button
              onClick={() => setIsEditProjectOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              維護素材
            </button>
          </div>

          {/* 封面與外觀展示 */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-rose-600" /> 建案封面與建築外觀
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 h-48 rounded-xl overflow-hidden border border-slate-200 relative group bg-slate-100">
                <img
                  src={liveProject.coverImage || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'}
                  alt="建案封面"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-white rounded text-[10px] font-bold">
                  主宣傳封面
                </span>
              </div>

              {liveProject.exteriorImages && liveProject.exteriorImages.length > 0 ? (
                liveProject.exteriorImages.map((url, idx) => (
                  <div key={idx} className="h-48 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100">
                    <img src={url} alt={`外觀 ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-white rounded text-[10px] font-bold">
                      外觀照片 {idx + 1}
                    </span>
                  </div>
                ))
              ) : (
                <div className="sm:col-span-2 h-48 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                  <ImageIcon className="w-8 h-8 mb-1" />
                  <span>尚未新增外觀多視角照片</span>
                </div>
              )}
            </div>
          </div>

          {/* 格局圖與樓層全區圖 */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-rose-600" /> 格局圖與全區樓層配置圖
            </h4>
            {liveProject.floorPlans && liveProject.floorPlans.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {liveProject.floorPlans.map((url, idx) => (
                  <div key={idx} className="h-40 rounded-xl overflow-hidden border border-slate-200 bg-white p-2">
                    <img src={url} alt={`格局圖 ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                    <p className="text-[10px] text-center text-slate-500 font-semibold mt-1">格局圖樣 {idx + 1}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 bg-slate-50/50">
                尚未上傳格局圖樣，可點選右上角「維護素材」加入格局圖網址。
              </div>
            )}
          </div>

          {/* 建材設備與銷售指引 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <h4 className="font-bold text-slate-900 text-xs">建材設備資料說明</h4>
              <p className="text-slate-700 leading-relaxed">
                {liveProject.specifications || '尚未輸入建材規格說明。'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <h4 className="font-bold text-slate-900 text-xs">銷售說明與經紀人推案指引</h4>
              <p className="text-slate-700 leading-relaxed">
                {liveProject.salesBrochure || '尚未輸入銷售指南。'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: 銷售門店管理（中心端專用） */}
      {activeTab === 'assignments' && (
        <div className="space-y-4 text-xs animate-in fade-in">
          {/* 指派統計看板與指派按鈕 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">本建案銷售門店指派名單</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  共指派 {projectAssignments.length} 家門店
                </span>
              </div>
              <p className="text-slate-500 text-[11px] mt-1">
                由代銷中心人工指派加盟門店，每家門店僅保留一筆最新關係，歷次暫停、恢復與撤銷異動均存檔保留。
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsAssignStoresOpen(true)}
                disabled={liveProject.status !== 'ON_SALE'}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                指派新門店銷售
              </button>
            </div>
          </div>

          {/* 若建案非 ON_SALE 警示 */}
          {liveProject.status !== 'ON_SALE' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>建案非上架狀態提示：</strong>依業務規章，建案狀態目前為「{liveProject.status}」，僅已上架 (ON_SALE) 之建案允許新增或恢復門店銷售指派。
              </span>
            </div>
          )}

          {/* 指派狀態統計卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs text-center">
              <span className="text-[11px] text-slate-500 block">有效聯銷中 (ACTIVE)</span>
              <span className="text-xl font-black text-emerald-600">{activeAssignmentsCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">門店可開展推案報備</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs text-center">
              <span className="text-[11px] text-slate-500 block">暫停銷售 (PAUSED)</span>
              <span className="text-xl font-black text-amber-600">{pausedAssignmentsCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">阻斷新客登記，保障已登客戶</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs text-center">
              <span className="text-[11px] text-slate-500 block">已撤銷指派 (REVOKED)</span>
              <span className="text-xl font-black text-slate-500">{revokedAssignmentsCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">終止合作，快照保障留存</span>
            </div>
          </div>

          {/* 搜尋與篩選列 */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜尋已指派門店名稱、代碼、原因..."
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">指派狀態：</span>
              <select
                value={assignmentStatusFilter}
                onChange={(e) => setAssignmentStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value="ALL">全部狀態 ({projectAssignments.length})</option>
                <option value="ACTIVE">有效聯銷中 ({activeAssignmentsCount})</option>
                <option value="PAUSED">暫停銷售 ({pausedAssignmentsCount})</option>
                <option value="REVOKED">已撤銷 ({revokedAssignmentsCount})</option>
              </select>
            </div>
          </div>

          {/* 門店指派清單 */}
          {loadingAssignments ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-2">
              <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">門店指派清單載入中...</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Store className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">
                {assignmentSearch || assignmentStatusFilter !== 'ALL'
                  ? '沒有符合搜尋條件的門店指派'
                  : '目前本建案尚未指派任何加盟門店'}
              </h4>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                {liveProject.status === 'ON_SALE'
                  ? '請點擊上方「指派新門店銷售」按鈕，依行政區域與產品專長人工挑選門店加入銷售。'
                  : '本建案需調整為「上架熱銷 (ON_SALE)」狀態後方可指派門店。'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssignments.map((assignment) => {
                const isExpanded = Boolean(expandedHistories[assignment.id]);
                const isAssignmentActive = assignment.status === 'ACTIVE';
                const isAssignmentPaused = assignment.status === 'PAUSED';
                const isAssignmentRevoked = assignment.status === 'REVOKED';

                return (
                  <div
                    key={assignment.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors p-4 space-y-3"
                  >
                    {/* 上方：門店基本資訊與狀態 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{assignment.storeName}</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold">
                          {assignment.storeCode}
                        </span>
                        {assignment.storeCity && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {assignment.storeCity} {assignment.storeDistrict}
                          </span>
                        )}
                        {assignment.contactPerson && (
                          <span className="text-[11px] text-slate-500">
                            聯絡人：{assignment.contactPerson} ({assignment.contactPhone || '無電話'})
                          </span>
                        )}
                      </div>

                      {/* 狀態 Badge 與操作按鈕 */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                            isAssignmentActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isAssignmentPaused
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isAssignmentActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          {isAssignmentPaused && <PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
                          {isAssignmentRevoked && <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                          {isAssignmentActive
                            ? '🟢 有效聯銷中'
                            : isAssignmentPaused
                            ? '🟡 已暫停銷售'
                            : '⚪ 已撤銷指派'}
                        </span>

                        {/* 狀態變更動作按鈕 */}
                        {isAssignmentActive && (
                          <>
                            <button
                              onClick={() =>
                                setStatusModalConfig({
                                  isOpen: true,
                                  assignment,
                                  targetStatus: 'PAUSED',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <PauseCircle className="w-3.5 h-3.5" /> 暫停銷售
                            </button>
                            <button
                              onClick={() =>
                                setStatusModalConfig({
                                  isOpen: true,
                                  assignment,
                                  targetStatus: 'REVOKED',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" /> 撤銷指派
                            </button>
                          </>
                        )}

                        {isAssignmentPaused && (
                          <>
                            <button
                              onClick={() =>
                                setStatusModalConfig({
                                  isOpen: true,
                                  assignment,
                                  targetStatus: 'ACTIVE',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <PlayCircle className="w-3.5 h-3.5" /> 恢復指派
                            </button>
                            <button
                              onClick={() =>
                                setStatusModalConfig({
                                  isOpen: true,
                                  assignment,
                                  targetStatus: 'REVOKED',
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" /> 撤銷指派
                            </button>
                          </>
                        )}

                        {isAssignmentRevoked && (
                          <button
                            onClick={() =>
                              setStatusModalConfig({
                                isOpen: true,
                                assignment,
                                targetStatus: 'ACTIVE',
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <PlayCircle className="w-3.5 h-3.5" /> 重新恢復授權
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 中間：指派時間、操作人與原因 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>
                            指派生效日：{assignment.assignedAt ? new Date(assignment.assignedAt).toLocaleString() : '近日'}
                          </span>
                          <span>操作人：{assignment.assignedByName || '代銷中心總部'}</span>
                        </div>
                        <p className="text-slate-800">
                          <strong className="text-slate-900">指派原因：</strong>
                          {assignment.reason || '代銷中心年度推案聯銷名冊授權。'}
                        </p>
                      </div>

                      {/* 門店可見銷售說明 */}
                      <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1 text-amber-900">
                        <span className="font-bold text-[10px] text-amber-800 block">
                          門店可見的銷售說明（前線可見）：
                        </span>
                        <p className="line-clamp-2 text-amber-900">
                          {assignment.salesNotesForStore || '無填寫特殊推案指示。'}
                        </p>
                      </div>
                    </div>

                    {/* 中心內部備註 (僅中心可見) */}
                    {assignment.internalNotes && (
                      <div className="p-2.5 bg-rose-50/50 rounded-xl border border-rose-200/60 text-[11px] text-rose-900 flex items-start gap-2">
                        <Shield className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[10px] text-rose-800">
                            中心內部備註（機密保護，門店不可見）：
                          </span>
                          <p className="mt-0.5 leading-relaxed">{assignment.internalNotes}</p>
                        </div>
                      </div>
                    )}

                    {/* 歷次異動紀錄 (可收合/展開) */}
                    {assignment.history && assignment.history.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleHistory(assignment.id)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                        >
                          <History className="w-3 h-3 text-slate-400" />
                          歷次變更歷程 ({assignment.history.length} 筆)
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 pl-4 border-l-2 border-slate-200 space-y-2 py-1 text-[11px]">
                            {assignment.history.map((h, idx) => (
                              <div key={idx} className="space-y-0.5">
                                <div className="flex items-center gap-2 text-slate-500">
                                  <span>{new Date(h.changedAt || h.timestamp || Date.now()).toLocaleString()}</span>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-700">{h.operatorName}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-700">
                                    {h.action}
                                  </span>
                                  {h.fromStatus && (
                                    <span className="text-slate-400">
                                      ({h.fromStatus} ➔ {h.toStatus})
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-800">
                                  變更原因：<span className="font-medium">{h.reason}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 規範說明 Footer Banner */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-slate-600 text-[11px]">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              業務與分佣鎖定規章指引
            </div>
            <p className="leading-relaxed">
              • <strong>案源與門店門檻：</strong>建案需為「上架熱銷 (ON_SALE)」狀態、門店需為「啟用中 (ACTIVE)」狀態，方可執行指派或恢復授權。
            </p>
            <p className="leading-relaxed">
              • <strong>單一關係與歷程保存：</strong>同建案、同門店僅保留一筆最新有效關係，歷次操作另存歷史軌跡，嚴禁物理刪除。
            </p>
            <p className="leading-relaxed">
              • <strong>分佣快照不因指派變更而動搖：</strong>指派變更不自動重算客戶佣金；既有客戶之分佣比率一律以初次登記時鎖定之不可變快照為準，確保門店同仁與中心權益獲得終身保障。
            </p>
          </div>
        </div>
      )}

      {/* 批次指派門店 Modal */}
      <AssignStoresModal
        isOpen={isAssignStoresOpen}
        onClose={() => setIsAssignStoresOpen(false)}
        project={liveProject}
        existingAssignments={projectAssignments}
        onSuccess={async () => {
          await loadProjectAssignments();
          await refreshData();
        }}
      />

      {/* 指派狀態調整 (暫停 / 恢復 / 撤銷) Modal */}
      {statusModalConfig.assignment && (
        <AssignmentStatusModal
          isOpen={statusModalConfig.isOpen}
          onClose={() =>
            setStatusModalConfig({
              isOpen: false,
              assignment: null,
              targetStatus: 'ACTIVE',
            })
          }
          project={liveProject}
          assignment={statusModalConfig.assignment}
          targetStatus={statusModalConfig.targetStatus}
          onSuccess={async () => {
            await loadProjectAssignments();
            await refreshData();
          }}
        />
      )}

      {/* 編輯建案 Modal */}
      <ProjectModal
        isOpen={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
        initialProject={liveProject}
      />

      {/* 新增戶別 Modal */}
      <UnitModal
        isOpen={isAddUnitOpen}
        onClose={() => setIsAddUnitOpen(false)}
        defaultProjectId={liveProject.id}
      />

      {/* 編輯戶別 Modal */}
      {editingUnit && (
        <UnitModal
          isOpen={Boolean(editingUnit)}
          onClose={() => setEditingUnit(null)}
          defaultProjectId={liveProject.id}
          initialUnit={editingUnit}
        />
      )}
    </div>
  );
};

