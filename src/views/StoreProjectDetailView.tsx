import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiClient } from '../services/apiClient';
import { formatBuildingUnit } from '../rules';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  Layers,
  Phone,
  Mail,
  UserPlus,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Download,
  Eye,
  Percent,
  Clock,
  ExternalLink,
  ShieldCheck,
  Home,
  Info,
} from 'lucide-react';

interface StoreProjectDetailViewProps {
  projectId: string;
  onBack: () => void;
  onOpenRegisterModal: (projectId: string) => void;
  onOpenViewingModal?: (projectId: string) => void;
}

export const StoreProjectDetailView: React.FC<StoreProjectDetailViewProps> = ({
  projectId,
  onBack,
  onOpenRegisterModal,
  onOpenViewingModal,
}) => {
  const { currentUser, addToast } = useApp();

  const [projectData, setProjectData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'units' | 'materials' | 'specs'>('units');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    apiClient
      .getStoreProjectDetail(projectId)
      .then((data) => {
        if (mounted) {
          setProjectData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch store project detail:', err);
        if (mounted) {
          setError(err.message || '無法載入此建案詳情或權限不足');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
        <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold">門店案源資料載入與安全校驗中...</p>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">無法開啟建案詳情</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">{error || '找不到此建案或該建案已非授權狀態。'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> 返回我的建案
        </button>
      </div>
    );
  }

  const {
    project,
    assignment,
    commissionVersion,
    units = [],
    materials = {},
    centerContact = {},
  } = projectData;

  const validUnits = units.filter((u: any) => u.status !== 'DISABLED');
  const availableUnits = validUnits.filter((u: any) => u.status === 'AVAILABLE');

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* 頂部導覽列 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          返回「我的建案」列表
        </button>

        <div className="flex items-center gap-2">
          {onOpenViewingModal && (
            <button
              onClick={() => onOpenViewingModal(project.id)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <CalendarCheck className="w-4 h-4 text-slate-600" />
              預約現場帶看
            </button>
          )}

          <button
            onClick={() => onOpenRegisterModal(project.id)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            立即為客戶登記 (新登報備)
          </button>
        </div>
      </div>

      {/* 建案基本資料 Header 卡片 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                {project.productType === 'PRE_SALE' ? '預售案' : '新成屋'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                🟢 聯銷熱銷中
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold">
                {project.city} {project.district}
              </span>
            </div>

            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.name}</h1>

            <p className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
              <span>建商／投資興建：<strong className="text-slate-800">{project.developer || '未公開'}</strong></span>
              <span>營造廠商：<strong className="text-slate-800">{project.constructor || '未公開'}</strong></span>
              <span>基地地址：<strong className="text-slate-800">{project.address || `${project.city}${project.district}`}</strong></span>
            </p>
          </div>

          <div className="text-right shrink-0 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] text-slate-500 font-bold block">可售戶數 / 總戶數</span>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl font-black text-emerald-600">{availableUnits.length}</span>
              <span className="text-xs font-semibold text-slate-400">/ 共 {validUnits.length} 戶</span>
            </div>
            <p className="text-[10px] text-slate-400">授權指派日：{assignment?.assignedAt ? new Date(assignment.assignedAt).toLocaleDateString() : '近日'}</p>
          </div>
        </div>

        {/* 中心給門店的銷售說明專區 (中心端指派時輸入的 salesNotesForStore) */}
        {assignment?.salesNotesForStore && (
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <Info className="w-4 h-4 text-amber-600" />
              代銷中心重要銷售說明與叮嚀（本店專屬）
            </div>
            <p className="text-amber-800 leading-relaxed whitespace-pre-wrap pl-6">
              {assignment.salesNotesForStore}
            </p>
          </div>
        )}

        {/* 本建案分佣方案看板 (含法規規章規定之不可變快照聲明) */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-rose-600" />
              <h4 className="font-bold text-slate-900 text-xs">目前適用分佣條件方案</h4>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">
                {commissionVersion?.versionNumber || 'V1.0 生效中'}
              </span>
            </div>

            <div className="text-xs font-semibold text-slate-700 flex items-center gap-3">
              <span>總佣金率：<strong className="text-slate-900">{commissionVersion?.percentage || 3.0}%</strong></span>
              <span>門店拆分比：<strong className="text-rose-600">{commissionVersion?.storePercentage || 70}%</strong></span>
              <span>(預估實收約 <strong className="text-emerald-700">{((commissionVersion?.percentage || 3.0) * ((commissionVersion?.storePercentage || 70) / 100)).toFixed(2)}%</strong>)</span>
            </div>
          </div>

          {/* 規章要求的重要警示文字 */}
          <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>重要規範聲明：</strong>本頁顯示目前建案之生效分佣條件；個別客戶之分佣權益一律以正式登記鎖定時之不可變快照為準，不受後續版本調整影響。
            </span>
          </div>
        </div>

        {/* 接待中心與專案聯絡人 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 block">現場接待中心資訊</span>
            <p className="text-slate-800 font-semibold">{project.receptionAddress || project.address || '接待會館請電洽專案'}</p>
            <p className="text-slate-500 text-[11px]">營業時間：平日 10:00 - 18:00 / 假日 09:30 - 19:00</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 block">代銷中心承辦窗口</span>
            <p className="text-slate-800 font-semibold">{centerContact.person || '總部代銷處專案部'}</p>
            <p className="text-slate-600 text-[11px] flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-rose-600" /> {centerContact.phone || '未公開'}
              {centerContact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {centerContact.email}
                </span>
              )}
            </p>
          </div>
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
          目前可售戶別清單 ({validUnits.length})
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'materials'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          銷售素材與格局圖
        </button>

        <button
          onClick={() => setActiveTab('specs')}
          className={`py-3 px-3 border-b-2 font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'specs'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          建築規格與特色
        </button>
      </div>

      {/* Tab 1: 可售戶別清單 (嚴格白名單：徹底排除 basePrice 底價) */}
      {activeTab === 'units' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">建案可售與保留戶別</h3>
              <p className="text-[11px] text-slate-500">門店端僅呈現公開開價與戶別規格，協助經紀人向客戶推薦。</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              可售 {availableUnits.length} 戶
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold">
                  <th className="py-3 px-4">棟別／戶號</th>
                  <th className="py-3 px-4">樓層</th>
                  <th className="py-3 px-4">格局房型</th>
                  <th className="py-3 px-4">權狀坪數</th>
                  <th className="py-3 px-4">車位規格</th>
                  <th className="py-3 px-4">戶別總開價</th>
                  <th className="py-3 px-4">銷售狀態</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {validUnits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      目前代銷中心尚未建立或開放此案戶別。
                    </td>
                  </tr>
                ) : (
                  validUnits.map((u: any) => {
                    const isAvail = u.status === 'AVAILABLE';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatBuildingUnit(u.building, u.unitNumber)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{u.floor ? `${u.floor}F` : '標準層'}</td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{u.pattern || '格局未填'}</td>
                        <td className="py-3 px-4 text-slate-700">{u.ping ? `${u.ping} 坪` : '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{u.parkingSpaceInfo || '無/選配'}</td>
                        <td className="py-3 px-4 font-bold text-rose-600">
                          {u.listPrice ? (
                            <>
                              {(u.listPrice / 10000).toLocaleString('zh-TW')} <span className="text-[10px] text-slate-500 font-normal">萬元</span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-normal">洽詢現場</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.status === 'AVAILABLE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : u.status === 'NEGOTIATING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : u.status === 'RESERVED_DEPOSIT'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {u.status === 'AVAILABLE'
                              ? '🟢 可售'
                              : u.status === 'NEGOTIATING'
                              ? '🟡 洽談保留中'
                              : u.status === 'RESERVED_DEPOSIT'
                              ? '🔵 已收訂'
                              : u.status === 'SIGNED'
                              ? '🔴 已簽約'
                              : u.status === 'DEAL_CLOSED'
                              ? '⚫ 已完銷'
                              : u.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onOpenRegisterModal(project.id)}
                            disabled={!isAvail}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                              isAvail
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isAvail ? '指定此戶登記' : '已保留'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: 銷售素材與格局圖 */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900">原廠宣傳素材與公設照片</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              由代銷中心授權門店業務向買方推廣使用。點擊照片可放大檢視。
            </p>
          </div>

          {/* 照片展示 Grid */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 text-xs">外觀與宣傳照片</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {materials.coverImage && (
                <div
                  onClick={() => setPreviewImage(materials.coverImage)}
                  className="h-40 rounded-xl overflow-hidden border border-slate-200 relative group cursor-pointer bg-slate-100"
                >
                  <img src={materials.coverImage} alt="封面" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-white rounded text-[10px] font-bold">
                    主宣傳封面
                  </span>
                </div>
              )}

              {(materials.exteriorImages || []).map((imgUrl: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setPreviewImage(imgUrl)}
                  className="h-40 rounded-xl overflow-hidden border border-slate-200 relative group cursor-pointer bg-slate-100"
                >
                  <img src={imgUrl} alt={`外觀 ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-white rounded text-[10px] font-bold">
                    外觀 {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 銷售指南文字 */}
          {materials.salesBrochure && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-rose-600" /> 經紀人銷售重點指南 (Brochure)
              </h4>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                {materials.salesBrochure}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: 建築規格與特色 */}
      {activeTab === 'specs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 text-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900">建築規格與建案詳情</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">提供向買方說明之完整結構、基地與營造資訊。</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">建築型態</span>
              <p className="font-bold text-slate-800">{project.buildingType || '電梯大樓'}</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">規劃坪數</span>
              <p className="font-bold text-slate-800">{project.pingRange || '洽詢現場'}</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">基地面積</span>
              <p className="font-bold text-slate-800">{project.baseAreaPings ? `${project.baseAreaPings} 坪` : '詳洽現場'}</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">公設比</span>
              <p className="font-bold text-slate-800">{project.publicRatio ? `${project.publicRatio}%` : '約 33-35%'}</p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">完工期程</span>
              <p className="font-bold text-slate-800">
                {project.completionDateType === 'ACTUAL' ? '已於 ' : '預計於 '}
                {project.completionDate || '待定'} 完工
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">樓層規劃</span>
              <p className="font-bold text-slate-800">{project.floorPlanInfo || '地上14層，地下3層'}</p>
            </div>
          </div>

          {project.highlights && project.highlights.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-xs">建案核心亮點</h4>
              <div className="flex flex-wrap gap-2">
                {project.highlights.map((h: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs"
                  >
                    ✦ {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {project.description && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-800 text-xs">企劃文案介紹</h4>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
        </div>
      )}

      {/* 照片預覽 Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-pointer backdrop-blur-xs animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={previewImage} alt="預覽" referrerPolicy="no-referrer" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
            <p className="text-center text-xs text-white/80 mt-2">點擊任意處關閉放大視窗</p>
          </div>
        </div>
      )}
    </div>
  );
};
