import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { apiClient } from '../services/apiClient';
import { StoreVisibleProject } from '../types';
import { StoreProjectDetailView } from './StoreProjectDetailView';
import {
  Building2,
  Search,
  Filter,
  ArrowUpDown,
  Home,
  UserPlus,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Tag,
  DollarSign,
  Percent,
  Layers,
  Sparkles,
  Info,
  Archive,
} from 'lucide-react';

interface MyProjectsViewProps {
  onOpenRegisterModal: (projectId?: string) => void;
  onOpenViewingModal?: (projectId?: string) => void;
}

export const MyProjectsView: React.FC<MyProjectsViewProps> = ({
  onOpenRegisterModal,
  onOpenViewingModal,
}) => {
  const { currentUser, addToast } = useApp();

  const [projects, setProjects] = useState<StoreVisibleProject[]>([]);
  const [historicalProjects, setHistoricalProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  // 篩選與搜尋
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('ALL');
  const [filterProductType, setFilterProductType] = useState('ALL');
  const [filterPriceRange, setFilterPriceRange] = useState('ALL');
  const [filterCompletion, setFilterCompletion] = useState('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST_ASSIGNED' | 'PRICE_ASC' | 'PRICE_DESC' | 'MOST_UNITS'>('NEWEST_ASSIGNED');

  const fetchMyProjects = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getStoreMyProjects();
      setProjects(data);

      // 同步取得歷史案源
      const hist = await apiClient.getStoreHistoricalProjects();
      setHistoricalProjects(hist);
    } catch (err: any) {
      console.error('Failed to load store projects:', err);
      addToast({
        type: 'error',
        title: '案源清單載入失敗',
        message: err.message || '伺服器處理錯誤',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProjects();
  }, []);

  // 城市清單
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.city) set.add(p.city);
    });
    return Array.from(set).sort();
  }, [projects]);

  // 篩選後清單
  const filteredProjects = useMemo(() => {
    const list = viewMode === 'ACTIVE' ? projects : (historicalProjects as any[]);

    return list.filter((p) => {
      // 關鍵字
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchName = p.name ? p.name.toLowerCase().includes(q) : false;
        const matchDev = p.developer ? p.developer.toLowerCase().includes(q) : false;
        const matchDist = p.district ? p.district.toLowerCase().includes(q) : false;
        const matchCity = p.city ? p.city.toLowerCase().includes(q) : false;
        if (!matchName && !matchDev && !matchDist && !matchCity) return false;
      }

      // 縣市
      if (filterCity !== 'ALL' && p.city !== filterCity) return false;

      // 產品類型 (預售 / 新成屋)
      if (filterProductType !== 'ALL' && p.productType !== filterProductType) return false;

      // 總價區間
      if (filterPriceRange !== 'ALL') {
        const minP = p.priceRange?.min || 0;
        const maxP = p.priceRange?.max || 0;
        if (filterPriceRange === 'UNDER_1500') {
          if (minP > 1500) return false;
        } else if (filterPriceRange === '1500_2500') {
          if (maxP < 1500 || minP > 2500) return false;
        } else if (filterPriceRange === '2500_4000') {
          if (maxP < 2500 || minP > 4000) return false;
        } else if (filterPriceRange === 'OVER_4000') {
          if (maxP < 4000) return false;
        }
      }

      // 完工狀態
      if (filterCompletion !== 'ALL') {
        if (filterCompletion === 'ACTUAL' && p.completionDateType !== 'ACTUAL') return false;
        if (filterCompletion === 'ESTIMATED' && p.completionDateType === 'ACTUAL') return false;
      }

      return true;
    });
  }, [
    projects,
    historicalProjects,
    viewMode,
    searchTerm,
    filterCity,
    filterProductType,
    filterPriceRange,
    filterCompletion,
  ]);

  // 排序
  const sortedProjects = useMemo(() => {
    const copy = [...filteredProjects];
    if (sortBy === 'NEWEST_ASSIGNED') {
      copy.sort((a, b) => new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime());
    } else if (sortBy === 'PRICE_ASC') {
      copy.sort((a, b) => (a.priceRange?.min || 0) - (b.priceRange?.min || 0));
    } else if (sortBy === 'PRICE_DESC') {
      copy.sort((a, b) => (b.priceRange?.max || 0) - (a.priceRange?.max || 0));
    } else if (sortBy === 'MOST_UNITS') {
      copy.sort((a, b) => (b.activeUnitsCount || 0) - (a.activeUnitsCount || 0));
    }
    return copy;
  }, [filteredProjects, sortBy]);

  // 若使用者點選某建案詳情，顯示專用 StoreProjectDetailView
  if (selectedProjectId) {
    return (
      <StoreProjectDetailView
        projectId={selectedProjectId}
        onBack={() => setSelectedProjectId(null)}
        onOpenRegisterModal={(pId) => onOpenRegisterModal(pId)}
        onOpenViewingModal={onOpenViewingModal}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 標題與指派統計 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">我的建案（獲授權聯銷案源）</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            由代銷中心正式指派予貴門店之「已上架」預售與新成屋案源，隨時掌握最新開價、分佣方案與銷售重點。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 切換正常聯銷與歷史案源 */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setViewMode('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                viewMode === 'ACTIVE'
                  ? 'bg-white text-rose-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              正常銷售中 ({projects.length})
            </button>
            <button
              onClick={() => setViewMode('HISTORY')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                viewMode === 'HISTORY'
                  ? 'bg-white text-slate-800 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              歷史案源入口 ({historicalProjects.length})
            </button>
          </div>

          <button
            onClick={() => onOpenRegisterModal()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            新客登記報備
          </button>
        </div>
      </div>

      {/* 搜尋與篩選工具列 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          {/* 關鍵字搜尋 */}
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋建案名稱、行政區、建商..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white transition-all"
            />
          </div>

          {/* 區域篩選 */}
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white"
          >
            <option value="ALL">全部縣市區域</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* 產品類型 */}
          <select
            value={filterProductType}
            onChange={(e) => setFilterProductType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white"
          >
            <option value="ALL">全部產品類型</option>
            <option value="PRE_SALE">預售屋</option>
            <option value="NEW_CONSTRUCT">新成屋</option>
          </select>

          {/* 總價區間 */}
          <select
            value={filterPriceRange}
            onChange={(e) => setFilterPriceRange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white"
          >
            <option value="ALL">全部總價區間</option>
            <option value="UNDER_1500">1,500 萬以下</option>
            <option value="1500_2500">1,500 ~ 2,500 萬</option>
            <option value="2500_4000">2,500 ~ 4,000 萬</option>
            <option value="OVER_4000">4,000 萬以上</option>
          </select>
        </div>

        {/* 完工狀態篩選與排序 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>完工狀態：</span>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'ALL', label: '全部' },
                { id: 'ESTIMATED', label: '施工預售' },
                { id: 'ACTUAL', label: '成屋現況' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilterCompletion(item.id)}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                    filterCompletion === item.id
                      ? 'bg-rose-50 text-rose-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>排序方式：</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="NEWEST_ASSIGNED">最新指派優先</option>
              <option value="PRICE_ASC">開價：由低到高</option>
              <option value="PRICE_DESC">開價：由高到低</option>
              <option value="MOST_UNITS">可售戶數最多</option>
            </select>
          </div>
        </div>
      </div>

      {/* 建案卡片清單 */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 space-y-3 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold">門店案源載入中...</p>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {viewMode === 'ACTIVE' ? '目前尚無符合篩選條件的授權建案' : '目前尚無歷史指派紀錄'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {viewMode === 'ACTIVE'
              ? '代銷中心指派建案後，啟用中門店將即刻於此同步接收案源與銷售素材。'
              : '過去曾被暫停或撤銷之案源將自動歸檔於此處供查閱。'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedProjects.map((project) => {
            const hasNotes = Boolean(project.salesNotesForStore);
            const isPausedOrRevoked = project.assignmentStatus !== 'ACTIVE';

            return (
              <div
                key={project.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
              >
                {/* 封面相片 */}
                <div className="h-44 bg-slate-100 relative overflow-hidden">
                  <img
                    src={
                      project.coverImage ||
                      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'
                    }
                    alt={project.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* 標籤 */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold">
                      {project.productType === 'PRE_SALE' ? '預售' : '新成屋'}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold">
                      {project.city} {project.district}
                    </span>
                  </div>

                  {/* 狀態標示 */}
                  <div className="absolute top-3 right-3">
                    {project.assignmentStatus === 'ACTIVE' ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        正常聯銷中
                      </span>
                    ) : project.assignmentStatus === 'PAUSED' ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                        <AlertTriangle className="w-3 h-3" />
                        指派暫停中
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-700/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                        已撤銷 (歷史)
                      </span>
                    )}
                  </div>

                  {/* 底部摘要 */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="font-bold text-base tracking-tight truncate">{project.name}</h3>
                    <p className="text-[11px] text-slate-200 mt-0.5 truncate">
                      建商：{project.developer || '未公開'} · {project.buildingType || '大樓'}
                    </p>
                  </div>
                </div>

                {/* 卡片內容資訊 */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                  {/* 開價與可售戶數 */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">戶別總開價區間</span>
                      <div className="font-black text-rose-600 text-sm mt-0.5 truncate">
                        {project.priceRange && project.priceRange.min > 0 ? (
                          <>
                            {project.priceRange.min.toLocaleString()} ~ {project.priceRange.max.toLocaleString()}{' '}
                            <span className="text-[10px] text-slate-500 font-normal">萬</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-normal">洽詢現場</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">可售戶數</span>
                      <div className="font-black text-emerald-600 text-sm mt-0.5">
                        {project.activeUnitsCount}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">戶</span>
                      </div>
                    </div>
                  </div>

                  {/* 目前分佣條件摘要 */}
                  <div className="flex items-center justify-between text-[11px] px-1 text-slate-600">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-rose-600" />
                      分佣拆比：
                      <strong className="text-slate-900">
                        門店 {project.commissionRule?.storeSharePercent || 70}%
                      </strong>
                    </span>
                    <span className="text-slate-400">
                      指派日：
                      {project.assignedAt ? new Date(project.assignedAt).toLocaleDateString() : '近日'}
                    </span>
                  </div>

                  {/* 中心銷售重點摘要 (salesNotesForStore) */}
                  {hasNotes ? (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1 text-[11px]">
                        <Info className="w-3 h-3 text-amber-600" /> 中心銷售重點：
                      </div>
                      <p className="line-clamp-2 text-amber-800 leading-relaxed">
                        {project.salesNotesForStore}
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Info className="w-3 h-3" />
                      中心未填寫特殊銷售叮嚀，可依標準宣傳材料推廣。
                    </div>
                  )}

                  {/* 警示標示 (若暫停中) */}
                  {isPausedOrRevoked && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-700 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      此案指派已{project.assignmentStatus === 'PAUSED' ? '暫停' : '撤銷'}，暫無法登記新客戶。
                    </div>
                  )}

                  {/* 操作按鈕 */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedProjectId(project.id)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      查看詳情
                    </button>

                    <button
                      onClick={() => onOpenRegisterModal(project.id)}
                      disabled={isPausedOrRevoked}
                      className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs ${
                        !isPausedOrRevoked
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      登記客戶
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
