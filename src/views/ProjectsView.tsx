import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { repository } from '../services/repository';
import { Project, ProjectType, ProjectStatus } from '../types';
import { ProjectModal } from '../components/modals/ProjectModal';
import { UnitModal } from '../components/modals/UnitModal';
import { ProjectDetailView } from '../components/ProjectDetailView';
import { MyProjectsView } from './MyProjectsView';
import {
  Building2,
  MapPin,
  Plus,
  Home,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  Edit3,
  Clock,
  ChevronRight,
  Sparkles,
  DollarSign,
  Store,
  Percent,
} from 'lucide-react';

interface ProjectsViewProps {
  onOpenNewProject?: () => void;
  onOpenAssignStore?: (project?: Project) => void;
  onOpenNewCommission?: (project: Project) => void;
  onOpenNewUnit?: (projectId: string) => void;
  onOpenRegisterModal?: (projectId?: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = (props) => {
  const { currentUser } = useApp();

  // 若為門店人員（店長或經紀人），呈現專屬「我的建案」視圖（嚴格限制可見案源與欄位）
  if (currentUser.role !== 'center_admin') {
    return (
      <MyProjectsView
        onOpenRegisterModal={(pId) => props.onOpenRegisterModal && props.onOpenRegisterModal(pId)}
      />
    );
  }

  return <CenterAdminProjectsView {...props} />;
};

const CenterAdminProjectsView: React.FC<ProjectsViewProps> = ({
  onOpenNewProject,
  onOpenAssignStore,
  onOpenNewCommission,
  onOpenNewUnit,
  onOpenRegisterModal,
}) => {
  const { scopedData, currentUser, refreshData, addToast } = useApp();

  // 狀態篩選與搜尋
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProductType, setFilterProductType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCity, setFilterCity] = useState<string>('ALL');

  // Modal 狀態
  const [selectedProjectDetail, setSelectedProjectDetail] = useState<Project | null>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [quickAddUnitProjectId, setQuickAddUnitProjectId] = useState<string | null>(null);

  // 城市清單
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    scopedData.projects.forEach((p) => {
      if (p.city) set.add(p.city);
    });
    return Array.from(set);
  }, [scopedData.projects]);

  // 依條件篩選建案
  const filteredProjects = useMemo(() => {
    return scopedData.projects.filter((p) => {
      if (filterProductType !== 'ALL' && p.productType !== filterProductType) return false;
      if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
      if (filterCity !== 'ALL' && p.city !== filterCity) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchName = p.name ? p.name.toLowerCase().includes(q) : false;
        const matchDeveloper = p.developer ? p.developer.toLowerCase().includes(q) : false;
        const matchDistrict = p.district ? p.district.toLowerCase().includes(q) : false;
        const matchAddress = p.address ? p.address.toLowerCase().includes(q) : false;
        const matchHighlights = p.highlights ? p.highlights.some((h) => h ? h.toLowerCase().includes(q) : false) : false;
        if (!matchName && !matchDeveloper && !matchDistrict && !matchAddress && !matchHighlights) {
          return false;
        }
      }
      return true;
    });
  }, [scopedData.projects, filterProductType, filterStatus, filterCity, searchTerm]);

  // 快速切換建案狀態
  const handleQuickStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    try {
      await repository.updateProjectStatus(projectId, newStatus, currentUser);
      addToast({
        type: 'success',
        title: '建案狀態已更新',
        message: `建案已切換至 [${newStatus}] 狀態。`,
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

  // 格式化日期時間
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '未記錄';
    try {
      const d = new Date(isoString);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return isoString;
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
        return '透天';
      case 'OTHER':
        return '其他';
      default:
        return '大樓';
    }
  };

  // 如果使用者點擊深入詳情，顯示詳情視圖
  if (selectedProjectDetail) {
    return (
      <ProjectDetailView
        project={selectedProjectDetail}
        onBack={() => setSelectedProjectDetail(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 頁面標題與建案管理入口 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6 text-rose-600" />
              代銷中心 · 建案資料管理
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              全端實時同步
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            建案可獨立建立，不需先指定門店或業務。完整管理建案基本資料、規格、銷售素材及可售戶別開價。
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {currentUser.role === 'center_admin' && (
            <button
              onClick={() => setIsNewProjectOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增代理建案
            </button>
          )}

          {onOpenRegisterModal && (
            <button
              onClick={() => onOpenRegisterModal()}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <UserPlus className="w-4 h-4 text-rose-400" />
              登記意向客戶
            </button>
          )}
        </div>
      </div>

      {/* 搜尋與篩選列 (產品類型、狀態、城市、關鍵字) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* 搜尋框 */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋建案名稱、建商、行政區、基地地址或建案特色..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50/50"
            />
          </div>

          {/* 狀態選單 */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">狀態：</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="ALL">全部狀態 ({scopedData.projects.length})</option>
              <option value="ON_SALE">🟢 上架熱銷 ({scopedData.projects.filter((p) => p.status === 'ON_SALE').length})</option>
              <option value="DRAFT">⚪ 草稿建檔 ({scopedData.projects.filter((p) => p.status === 'DRAFT').length})</option>
              <option value="PAUSED">🟡 暫停推案 ({scopedData.projects.filter((p) => p.status === 'PAUSED').length})</option>
              <option value="CLOSED">🔴 完銷結案 ({scopedData.projects.filter((p) => p.status === 'CLOSED').length})</option>
            </select>
          </div>

          {/* 縣市選單 */}
          {cityOptions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">區域：</span>
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ALL">全部縣市</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 產品類型分類按鈕標籤 */}
        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2.5 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setFilterProductType('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterProductType === 'ALL'
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            全部產品 ({scopedData.projects.length})
          </button>
          <button
            onClick={() => setFilterProductType('PRE_SALE')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterProductType === 'PRE_SALE'
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            預售屋 ({scopedData.projects.filter((p) => p.productType === 'PRE_SALE').length})
          </button>
          <button
            onClick={() => setFilterProductType('NEW_CONSTRUCTION')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterProductType === 'NEW_CONSTRUCTION'
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            新成屋 ({scopedData.projects.filter((p) => p.productType === 'NEW_CONSTRUCTION').length})
          </button>
          <button
            onClick={() => setFilterProductType('SURPLUS_HOUSE')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterProductType === 'SURPLUS_HOUSE'
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            餘屋代銷 ({scopedData.projects.filter((p) => p.productType === 'SURPLUS_HOUSE').length})
          </button>
        </div>
      </div>

      {/* 建案列表：符合規格要求的清單顯示（封面、建案名稱、建商、所在區域、產品類型、可售戶數、價格區間、狀態與更新時間） */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">查無符合條件之代理建案</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            未搜尋到符合條件的建案。您可以清除搜尋關鍵字，或點擊「新增代理建案」以獨立建立新案源。
          </p>
          {currentUser.role === 'center_admin' && (
            <button
              onClick={() => setIsNewProjectOpen(true)}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              建立新代理建案
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map((project) => {
            // 取出本建案的戶別資料以即時動態統計
            const projectUnits = scopedData.units.filter((u) => u.projectId === project.id);
            const validUnits = projectUnits.filter((u) => u.status !== 'DISABLED');
            const availableUnits = validUnits.filter((u) => u.status === 'AVAILABLE').length;

            // 即時動態計算價格區間 (單位：萬元)
            const unitPricesWan = validUnits
              .map((u) => u.listPrice)
              .filter((p) => p !== undefined && p !== null && !isNaN(p) && p > 0)
              .map((p) => Math.round(p / 10000));
            const minPrice = unitPricesWan.length > 0 ? Math.min(...unitPricesWan) : 0;
            const maxPrice = unitPricesWan.length > 0 ? Math.max(...unitPricesWan) : 0;

            const coverUrl =
              project.coverImage ||
              'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';

            return (
              <div
                key={project.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* 卡片本體 */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* 1. 封面與頂部主要資訊 */}
                  <div className="flex gap-4 items-start">
                    {/* 封面圖片 */}
                    <div
                      onClick={() => setSelectedProjectDetail(project)}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-slate-200 shrink-0 relative cursor-pointer bg-slate-100"
                    >
                      <img
                        src={coverUrl}
                        alt={project.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                        {getProductTypeLabel(project.productType)}
                      </span>
                    </div>

                    {/* 建案名稱、建商、所在區域、狀態 */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3
                            onClick={() => setSelectedProjectDetail(project)}
                            className="text-base sm:text-lg font-black text-slate-900 hover:text-rose-600 transition-colors cursor-pointer truncate"
                          >
                            {project.name}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium truncate">
                            建商：{project.developer || '建商未提供'}
                          </p>
                        </div>

                        {/* 狀態切換選單 */}
                        {currentUser.role === 'center_admin' ? (
                          <select
                            value={project.status || 'ON_SALE'}
                            onChange={(e) =>
                              handleQuickStatusChange(project.id, e.target.value as ProjectStatus)
                            }
                            className="px-2 py-1 rounded-lg text-[11px] font-bold border border-slate-200 bg-slate-50 text-slate-800 cursor-pointer focus:outline-none"
                          >
                            <option value="ON_SALE">🟢 上架熱銷</option>
                            <option value="DRAFT">⚪ 草稿建檔</option>
                            <option value="PAUSED">🟡 暫停推案</option>
                            <option value="CLOSED">🔴 完銷結案</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              project.status === 'ON_SALE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : project.status === 'PAUSED'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {project.status === 'ON_SALE'
                              ? '上架熱銷'
                              : project.status === 'PAUSED'
                              ? '暫停'
                              : '結案'}
                          </span>
                        )}
                      </div>

                      {/* 所在區域 */}
                      <p className="text-xs text-slate-600 flex items-center gap-1 truncate pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>
                          {project.city}
                          {project.district} · {project.address || '基地地址未公開'}
                        </span>
                      </p>

                      {/* 產品與建物標籤 */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {getProductTypeLabel(project.productType)}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {getBuildingTypeLabel(project.buildingType)}
                        </span>
                        {project.pingRange && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                            {project.pingRange} 坪
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. 核心指標列：可售戶數 (即時動態統計) 與 價格區間 (單位：萬元) */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold block">
                        可售戶數 / 總戶數
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-black text-emerald-600">{availableUnits}</span>
                        <span className="text-slate-400 font-medium">/ 共 {validUnits.length} 戶</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 font-semibold block">
                        價格區間 (總開價)
                      </span>
                      <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 truncate">
                        {minPrice > 0 ? (
                          <>
                            {minPrice.toLocaleString()} ~ {maxPrice.toLocaleString()} <span className="font-normal text-slate-500">萬元</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-medium">尚未開價</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 特色亮點或簡述 */}
                  {project.highlights && project.highlights.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {project.highlights.slice(0, 3).map((h, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                        >
                          ✦ {h}
                        </span>
                      ))}
                    </div>
                  ) : (
                    project.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{project.description}</p>
                    )
                  )}

                  {/* 更新時間標示 */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      更新時間：{formatDateTime(project.updatedAt || project.createdAt)}
                    </span>
                    <span>
                      {project.completionDateType === 'ACTUAL' ? '完工' : '預計完工'}：
                      {project.completionDate || '待定'}
                    </span>
                  </div>
                </div>

                {/* 卡片底部操作列 */}
                <div className="px-4 py-3 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedProjectDetail(project)}
                      className="px-3 py-1.5 rounded-xl font-bold bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      建案詳情與戶別 ({projectUnits.length})
                    </button>

                    {currentUser.role === 'center_admin' && (
                      <button
                        onClick={() => setEditingProject(project)}
                        className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                        title="編輯建案基本資料"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    {currentUser.role === 'center_admin' && (
                      <button
                        onClick={() => setQuickAddUnitProjectId(project.id)}
                        className="px-2.5 py-1.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 flex items-center gap-1 transition-colors"
                        title="加開新戶別"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        加開戶別
                      </button>
                    )}
                  </div>

                  {onOpenRegisterModal && (
                    <button
                      onClick={() => onOpenRegisterModal(project.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      登記客戶
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新增建案 Modal */}
      <ProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onSuccess={(createdProj) => {
          setSelectedProjectDetail(createdProj);
        }}
      />

      {/* 編輯建案 Modal */}
      {editingProject && (
        <ProjectModal
          isOpen={Boolean(editingProject)}
          onClose={() => setEditingProject(null)}
          initialProject={editingProject}
        />
      )}

      {/* 快捷加開戶別 Modal */}
      {quickAddUnitProjectId && (
        <UnitModal
          isOpen={Boolean(quickAddUnitProjectId)}
          onClose={() => setQuickAddUnitProjectId(null)}
          defaultProjectId={quickAddUnitProjectId}
        />
      )}
    </div>
  );
};
