import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { Project, ProjectType, BuildingType, CompletionDateType, ProjectStatus } from '../../types';
import {
  Building2,
  X,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  MapPin,
  Phone,
  Shield,
  Layers,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProject?: Project | null;
  onSuccess?: (project: Project) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  initialProject,
  onSuccess,
}) => {
  const { currentUser, refreshData, addToast } = useApp();
  const isEditing = Boolean(initialProject);

  const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'contact' | 'materials'>('basic');

  // 基本資料
  const [name, setName] = useState('');
  const [developer, setDeveloper] = useState('');
  const [productType, setProductType] = useState<ProjectType>('PRE_SALE');
  const [buildingType, setBuildingType] = useState<BuildingType>('BUILDING');
  const [city, setCity] = useState('台北市');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [receptionAddress, setReceptionAddress] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('ON_SALE');

  // 規劃與規格
  const [baseAreaPings, setBaseAreaPings] = useState<string>('');
  const [floorPlanInfo, setFloorPlanInfo] = useState('');
  const [roomTypes, setRoomTypes] = useState('');
  const [pingRange, setPingRange] = useState('');
  const [parkingType, setParkingType] = useState('');
  const [completionDateType, setCompletionDateType] = useState<CompletionDateType>('ESTIMATED');
  const [completionDate, setCompletionDate] = useState('');

  // 說明與特色
  const [description, setDescription] = useState('');
  const [highlightsInput, setHighlightsInput] = useState('');

  // 聯絡人與內部備註
  const [centerContactPerson, setCenterContactPerson] = useState('');
  const [centerContactPhone, setCenterContactPhone] = useState('');
  const [centerContactEmail, setCenterContactEmail] = useState('');
  const [receptionContact, setReceptionContact] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // 銷售素材
  const [coverImage, setCoverImage] = useState('');
  const [exteriorImages, setExteriorImages] = useState<string[]>([]);
  const [realImages, setRealImages] = useState<string[]>([]);
  const [amenityImages, setAmenityImages] = useState<string[]>([]);
  const [sampleHouseImages, setSampleHouseImages] = useState<string[]>([]);
  const [floorPlans, setFloorPlans] = useState<string[]>([]);
  const [layoutPlans, setLayoutPlans] = useState<string[]>([]);
  const [specifications, setSpecifications] = useState('');
  const [salesBrochure, setSalesBrochure] = useState('');

  // 暫存 URL 輸入
  const [newExteriorUrl, setNewExteriorUrl] = useState('');
  const [newFloorPlanUrl, setNewFloorPlanUrl] = useState('');
  const [newAmenityUrl, setNewAmenityUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialProject) {
      setName(initialProject.name || '');
      setDeveloper(initialProject.developer || '');
      setProductType(initialProject.productType || 'PRE_SALE');
      setBuildingType(initialProject.buildingType || 'BUILDING');
      setCity(initialProject.city || '台北市');
      setDistrict(initialProject.district || '');
      setAddress(initialProject.address || '');
      setReceptionAddress(initialProject.receptionAddress || '');
      setStatus(initialProject.status || 'ON_SALE');
      setBaseAreaPings(initialProject.baseAreaPings !== undefined ? String(initialProject.baseAreaPings) : '');
      setFloorPlanInfo(initialProject.floorPlanInfo || '');
      setRoomTypes(initialProject.roomTypes || '');
      setPingRange(initialProject.pingRange || '');
      setParkingType(initialProject.parkingType || '');
      setCompletionDateType(initialProject.completionDateType || 'ESTIMATED');
      setCompletionDate(initialProject.completionDate || '');
      setDescription(initialProject.description || '');
      setHighlightsInput((initialProject.highlights || []).join(' · '));
      setCenterContactPerson(initialProject.centerContactPerson || '');
      setCenterContactPhone(initialProject.centerContactPhone || '');
      setCenterContactEmail(initialProject.centerContactEmail || '');
      setReceptionContact(initialProject.receptionContact || '');
      setInternalNotes(initialProject.internalNotes || '');
      setCoverImage(initialProject.coverImage || '');
      setExteriorImages(initialProject.exteriorImages || []);
      setRealImages(initialProject.realImages || []);
      setAmenityImages(initialProject.amenityImages || []);
      setSampleHouseImages(initialProject.sampleHouseImages || []);
      setFloorPlans(initialProject.floorPlans || []);
      setLayoutPlans(initialProject.layoutPlans || []);
      setSpecifications(initialProject.specifications || '');
      setSalesBrochure(initialProject.salesBrochure || '');
    } else {
      // 預設空白，不自動補造假資料
      setName('');
      setDeveloper('');
      setProductType('PRE_SALE');
      setBuildingType('BUILDING');
      setCity('台北市');
      setDistrict('');
      setAddress('');
      setReceptionAddress('');
      setStatus('ON_SALE');
      setBaseAreaPings('');
      setFloorPlanInfo('');
      setRoomTypes('');
      setPingRange('');
      setParkingType('坡道平面');
      setCompletionDateType('ESTIMATED');
      setCompletionDate('');
      setDescription('');
      setHighlightsInput('');
      setCenterContactPerson(currentUser.name || '');
      setCenterContactPhone(currentUser.phone || '');
      setCenterContactEmail(currentUser.email || '');
      setReceptionContact('');
      setInternalNotes('');
      setCoverImage('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80');
      setExteriorImages([]);
      setRealImages([]);
      setAmenityImages([]);
      setSampleHouseImages([]);
      setFloorPlans([]);
      setLayoutPlans([]);
      setSpecifications('');
      setSalesBrochure('');
    }
  }, [initialProject, isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({
        type: 'error',
        title: '請填寫必填欄位',
        message: '建案名稱為必填項目。',
      });
      setActiveTab('basic');
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const highlights = highlightsInput
        .split(/[·,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: Partial<Project> = {
        name: name.trim(),
        developer: developer.trim(),
        productType,
        buildingType,
        city: city.trim(),
        district: district.trim(),
        address: address.trim(),
        receptionAddress: receptionAddress.trim(),
        receptionContact: receptionContact.trim(),
        status,
        baseAreaPings: baseAreaPings ? Number(baseAreaPings) : undefined,
        floorPlanInfo: floorPlanInfo.trim(),
        roomTypes: roomTypes.trim(),
        pingRange: pingRange.trim(),
        parkingType: parkingType.trim(),
        completionDateType,
        completionDate: completionDate.trim(),
        description: description.trim(),
        highlights,
        centerContactPerson: centerContactPerson.trim(),
        centerContactPhone: centerContactPhone.trim(),
        centerContactEmail: centerContactEmail.trim(),
        internalNotes: internalNotes.trim(),
        coverImage: coverImage.trim(),
        exteriorImages,
        realImages,
        amenityImages,
        sampleHouseImages,
        floorPlans,
        layoutPlans,
        specifications: specifications.trim(),
        salesBrochure: salesBrochure.trim(),
        updatedAt: nowIso,
      };

      if (isEditing && initialProject) {
        payload.id = initialProject.id;
        const res = await repository.updateProject(initialProject.id, payload, currentUser);
        addToast({
          type: 'success',
          title: '建案資料更新成功！',
          message: `建案「${name}」已成功儲存至後端資料庫。`,
        });
        if (onSuccess && res?.project) onSuccess(res.project);
      } else {
        payload.id = `proj_${Date.now()}`;
        payload.createdAt = nowIso;
        const res = await repository.saveProject(payload, currentUser);
        addToast({
          type: 'success',
          title: '新代理建案建立成功！',
          message: `建案「${name}」已建檔並寫入 MongoDB，可直接進入戶別管理進行戶別開案。`,
        });
        if (onSuccess && res?.project) onSuccess(res.project);
      }

      await refreshData();
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: isEditing ? '更新失敗' : '建檔失敗',
        message: err.message || '伺服器處理異常',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const addImageUrl = (type: 'exterior' | 'floor' | 'amenity') => {
    if (type === 'exterior' && newExteriorUrl.trim()) {
      setExteriorImages([...exteriorImages, newExteriorUrl.trim()]);
      setNewExteriorUrl('');
    } else if (type === 'floor' && newFloorPlanUrl.trim()) {
      setFloorPlans([...floorPlans, newFloorPlanUrl.trim()]);
      setNewFloorPlanUrl('');
    } else if (type === 'amenity' && newAmenityUrl.trim()) {
      setAmenityImages([...amenityImages, newAmenityUrl.trim()]);
      setNewAmenityUrl('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 my-6 flex flex-col max-h-[92vh] overflow-hidden">
        {/* 頂部標題與狀態 */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {isEditing ? `編輯建案 · ${initialProject?.name}` : '代銷中心 · 建立代理建案'}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700">
                  代銷總部端
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                建案可獨立建立，不需先指定門店或業務。資料將即時寫入 MongoDB 資料庫。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 分頁選單 */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-slate-200 bg-white text-xs font-medium overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`px-3.5 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'basic'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            基本資料與基地地址
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`px-3.5 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'specs'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            規劃坪數與完工日期
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`px-3.5 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'contact'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            聯絡窗口與內部備註
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('materials')}
            className={`px-3.5 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'materials'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            銷售素材與照片
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* 1. 基本資料 */}
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    建案名稱 <span className="text-rose-500">* (必填)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例：太平洋敦南馥境、信義天際"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">建商名稱</label>
                  <input
                    type="text"
                    value={developer}
                    onChange={(e) => setDeveloper(e.target.value)}
                    placeholder="例：太平洋建設股份有限公司"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">產品類型</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as ProjectType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="PRE_SALE">預售屋 (PRE-SALE)</option>
                    <option value="NEW_CONSTRUCTION">新成屋 (NEW)</option>
                    <option value="SURPLUS_HOUSE">餘屋代銷 (SURPLUS)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">建物型態</label>
                  <select
                    value={buildingType}
                    onChange={(e) => setBuildingType(e.target.value as BuildingType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="BUILDING">住宅大樓 (11樓以上)</option>
                    <option value="MANSION">華廈 (7~10樓)</option>
                    <option value="TOWNHOUSE">透天 / 別墅</option>
                    <option value="OTHER">商辦 / 其他複合</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">銷售公開狀態</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="ON_SALE">上架熱銷中 (ON_SALE)</option>
                    <option value="DRAFT">草稿建檔中 (DRAFT)</option>
                    <option value="PAUSED">暫停聯銷 (PAUSED)</option>
                    <option value="CLOSED">完銷結案 (CLOSED)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <MapPin className="w-4 h-4 text-rose-600" /> 基地與接待中心地理位置
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">縣市</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="例：台北市"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">行政區</label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="例：大安區"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">基地地址</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="例：敦化南路一段 188 號"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    接待中心地址 (未知允許留空)
                  </label>
                  <input
                    type="text"
                    value={receptionAddress}
                    onChange={(e) => setReceptionAddress(e.target.value)}
                    placeholder="例：台北市大安區忠孝東路四段 200 號 (接待會館)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">建案介紹與規劃背景</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="請詳述建案地段優勢、周邊機能與聯銷代理主軸..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1 flex items-center justify-between">
                  <span>產品特色標籤 (以中圓點 · 或逗號分隔)</span>
                  <span className="text-slate-400 font-normal">例：雙捷運站 · 鋼骨制震 · 耐震標章</span>
                </label>
                <input
                  type="text"
                  value={highlightsInput}
                  onChange={(e) => setHighlightsInput(e.target.value)}
                  placeholder="雙捷運交會 · 鋼骨制震建築 · 萬坪綠意公園首排 · 頂級迎賓大廳"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          )}

          {/* 2. 規格與完工日期 */}
          {activeTab === 'specs' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    基地面積 <span className="text-slate-500">(單位：坪)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseAreaPings}
                    onChange={(e) => setBaseAreaPings(e.target.value)}
                    placeholder="例：850.5"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">樓層規劃</label>
                  <input
                    type="text"
                    value={floorPlanInfo}
                    onChange={(e) => setFloorPlanInfo(e.target.value)}
                    placeholder="例：地上 18 層、地下 4 層"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">房型規劃</label>
                  <input
                    type="text"
                    value={roomTypes}
                    onChange={(e) => setRoomTypes(e.target.value)}
                    placeholder="例：2~4 房"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    坪數範圍 <span className="text-slate-500">(單位：坪)</span>
                  </label>
                  <input
                    type="text"
                    value={pingRange}
                    onChange={(e) => setPingRange(e.target.value)}
                    placeholder="例：26 ~ 58 坪"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">車位類型</label>
                  <input
                    type="text"
                    value={parkingType}
                    onChange={(e) => setParkingType(e.target.value)}
                    placeholder="例：坡道平面、升降機械"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 完工期程規範 (區分實際與預計)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">完工狀態類別</label>
                    <select
                      value={completionDateType}
                      onChange={(e) => setCompletionDateType(e.target.value as CompletionDateType)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                    >
                      <option value="ESTIMATED">預計完工 (預售期間推定日期)</option>
                      <option value="ACTUAL">實際已完工 (已取得使用執照)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">完工日期 / 年月</label>
                    <input
                      type="text"
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      placeholder="例：2027 年 Q3 或 2026-12"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  ＊ 規則依循：坪數、金額及日期均明確標示單位；若建商尚未確定期程，允許留空，系統不自動偽造數據。
                </p>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 text-xs">
                <span className="font-bold block">💡 可售戶數與總戶數統計規則：</span>
                依業務規範，本案總戶數與可售戶數將於儲存後由「可售戶別清單」自動動態計算（狀態為可售的戶別即時計入），不需手動輸入數字以杜絕資料脫節。
              </div>
            </div>
          )}

          {/* 3. 聯絡窗口與內部備註 */}
          {activeTab === 'contact' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Phone className="w-4 h-4 text-rose-600" /> 代銷中心專案承辦人
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">承辦人姓名</label>
                    <input
                      type="text"
                      value={centerContactPerson}
                      onChange={(e) => setCenterContactPerson(e.target.value)}
                      placeholder="例：王專案協理"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">聯絡電話 / 分機</label>
                    <input
                      type="text"
                      value={centerContactPhone}
                      onChange={(e) => setCenterContactPhone(e.target.value)}
                      placeholder="例：02-8772-9988 #801"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">電子信箱</label>
                    <input
                      type="email"
                      value={centerContactEmail}
                      onChange={(e) => setCenterContactEmail(e.target.value)}
                      placeholder="例：project@pacific-realty.com.tw"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">案場現場聯絡電話 / 接待專線</label>
                <input
                  type="text"
                  value={receptionContact}
                  onChange={(e) => setReceptionContact(e.target.value)}
                  placeholder="例：02-2708-8899 (現場接待會館專線)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-rose-900 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-rose-600" />
                    代銷中心內部專屬備註 (機密防護)
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-800">
                    僅代銷中心可視
                  </span>
                </div>
                <p className="text-[11px] text-rose-700">
                  此欄位記錄建商底價談判、特殊撥款期程、建商回扣協議等內部重要備忘，後端 API 已強制對所有加盟門店及經紀人剝除，外部人員無法窺視。
                </p>
                <textarea
                  rows={3}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="填寫建商內部約定條款、總部底價談判空間或預計加推戶別規劃..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          )}

          {/* 4. 銷售素材與照片 */}
          {activeTab === 'materials' && (
            <div className="space-y-4 animate-in fade-in">
              {/* 封面照片 */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">建案封面照片 URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  {coverImage && (
                    <div className="w-12 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                      <img
                        src={coverImage}
                        alt="封面預覽"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 外觀照片清單 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">外觀建築照片 ({exteriorImages.length} 張)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newExteriorUrl}
                    onChange={(e) => setNewExteriorUrl(e.target.value)}
                    placeholder="輸入外觀照片 URL"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => addImageUrl('exterior')}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                  >
                    加入照片
                  </button>
                </div>
                {exteriorImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                    {exteriorImages.map((url, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 h-20">
                        <img src={url} alt="外觀" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setExteriorImages(exteriorImages.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 格局圖與樓層配置圖 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">格局圖與樓層配置圖 ({floorPlans.length} 張)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newFloorPlanUrl}
                    onChange={(e) => setNewFloorPlanUrl(e.target.value)}
                    placeholder="輸入格局圖 / 全區配置圖 URL"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => addImageUrl('floor')}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                  >
                    加入圖面
                  </button>
                </div>
                {floorPlans.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                    {floorPlans.map((url, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 h-20 bg-white">
                        <img src={url} alt="格局圖" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setFloorPlans(floorPlans.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 建材設備說明 */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">建材設備資料說明</label>
                <textarea
                  rows={2}
                  value={specifications}
                  onChange={(e) => setSpecifications(e.target.value)}
                  placeholder="例：日本 YKK AP 水密氣密窗、6+6mm Low-E 複層玻璃、德國 LEICHT 廚具、TOTO 全自動智慧馬桶..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* 銷售說明 */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">銷售說明與經紀人話術指南</label>
                <textarea
                  rows={2}
                  value={salesBrochure}
                  onChange={(e) => setSalesBrochure(e.target.value)}
                  placeholder="供各門店業務員聯銷推案之重點話術與接待守則..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          )}

          {/* 表單底部操作 */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>所有變更將直接儲存至後端資料庫，重整頁面依然完整保留。</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {submitting ? '儲存中...' : isEditing ? '儲存建案更新' : '完成並建立建案'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
