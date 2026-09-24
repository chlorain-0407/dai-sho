import React, { useState, useEffect } from 'react';
import { Store } from '../../types';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import {
  Store as StoreIcon,
  X,
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  FileText,
  Check,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeToEdit?: Store | null;
  onSuccess?: () => void;
}

const COMMON_CITIES = [
  '台北市',
  '新北市',
  '基隆市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '台中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '台南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '台東縣',
];

const DEFAULT_SPECIALTIES = [
  '預售屋',
  '新成屋',
  '餘屋出清',
  '豪宅大戶',
  '捷運景觀宅',
  '透天別墅',
  '商辦廠辦',
  '重劃區首購',
];

const PRESET_SERVICE_AREAS: Record<string, string[]> = {
  '台北市': ['大安區', '信義區', '中正區', '中山區', '松山區', '內湖區', '南港區', '士林區', '北投區', '文山區'],
  '新北市': ['板橋區', '新莊區', '中和區', '永和區', '三重區', '新店區', '土城區', '蘆洲區', '汐止區', '林口區', '淡水區'],
  '桃園市': ['桃園區', '中壢區', '平鎮區', '八德區', '蘆竹區', '龜山區', '青埔特區'],
  '新竹縣': ['竹北市', '竹東鎮', '新豐鄉', '湖口鄉'],
  '新竹市': ['東區', '北區', '香山區'],
  '台中市': ['西屯區', '南屯區', '北屯區', '西區', '北區', '南區'],
};

export const StoreModal: React.FC<StoreModalProps> = ({
  isOpen,
  onClose,
  storeToEdit,
  onSuccess,
}) => {
  const { refreshData, addToast } = useApp();
  const isEditing = !!storeToEdit;

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [city, setCity] = useState('台北市');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [managerName, setManagerName] = useState('');
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [customAreaInput, setCustomAreaInput] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [internalNotes, setInternalNotes] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'DISABLED'>('ACTIVE');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (storeToEdit) {
      setName(storeToEdit.name || '');
      setCode(storeToEdit.code || '');
      setCompanyName(storeToEdit.companyName || '');
      setTaxId(storeToEdit.taxId || '');
      setCity(storeToEdit.city || '台北市');
      setDistrict(storeToEdit.district || '');
      setAddress(storeToEdit.address || '');
      setPhone(storeToEdit.phone || '');
      setContactPerson(storeToEdit.contactPerson || '');
      setContactPhone(storeToEdit.contactPhone || '');
      setContactEmail(storeToEdit.contactEmail || '');
      setManagerName(storeToEdit.managerName || '');
      setServiceAreas(storeToEdit.serviceAreas || []);
      setSpecialties(storeToEdit.specialties || []);
      setInternalNotes(storeToEdit.internalNotes || '');
      setStatus((storeToEdit.status as any) || 'ACTIVE');
    } else {
      setName('');
      setCode('');
      setCompanyName('');
      setTaxId('');
      setCity('台北市');
      setDistrict('大安區');
      setAddress('');
      setPhone('');
      setContactPerson('');
      setContactPhone('');
      setContactEmail('');
      setManagerName('');
      setServiceAreas(['大安區', '信義區']);
      setSpecialties(['預售屋', '新成屋']);
      setInternalNotes('');
      setStatus('ACTIVE');
    }
    setErrorMessage(null);
  }, [storeToEdit, isOpen]);

  if (!isOpen) return null;

  const safeSpecialties = specialties || [];
  const safeServiceAreas = serviceAreas || [];

  const toggleSpecialty = (item: string) => {
    if (safeSpecialties.includes(item)) {
      setSpecialties(safeSpecialties.filter((s) => s !== item));
    } else {
      setSpecialties([...safeSpecialties, item]);
    }
  };

  const toggleServiceArea = (area: string) => {
    if (safeServiceAreas.includes(area)) {
      setServiceAreas(safeServiceAreas.filter((a) => a !== area));
    } else {
      setServiceAreas([...safeServiceAreas, area]);
    }
  };

  const handleAddCustomArea = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = customAreaInput.trim();
    if (trimmed && !safeServiceAreas.includes(trimmed)) {
      setServiceAreas([...safeServiceAreas, trimmed]);
      setCustomAreaInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!code.trim()) {
      setErrorMessage('請填寫門店代碼（唯一識別碼，如 S004、PAC-005）');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('請填寫門店完整名稱（如：太平洋房屋 敦南旗艦加盟店）');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        companyName: companyName.trim(),
        taxId: taxId.trim(),
        city: city.trim(),
        district: district.trim(),
        address: address.trim(),
        phone: phone.trim(),
        contactPerson: contactPerson.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        managerName: managerName.trim(),
        serviceAreas,
        specialties,
        internalNotes: internalNotes.trim(),
        status,
      };

      if (isEditing && storeToEdit) {
        await apiClient.updateStore(storeToEdit.id, payload);
        addToast({
          type: 'success',
          title: '門店資料更新成功',
          message: `門店 [${name}] 基本資料與服務設定已儲存。`,
        });
      } else {
        await apiClient.createStore(payload);
        addToast({
          type: 'success',
          title: '加盟門店新增成功',
          message: `加盟門店 [${name}] (代碼: ${code.toUpperCase()}) 已建立並開放加入同仁。`,
        });
      }

      await refreshData();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Save store error:', err);
      setErrorMessage(err.message || '儲存門店失敗，請檢查輸入內容');
    } finally {
      setSubmitting(false);
    }
  };

  const availablePresetAreas = PRESET_SERVICE_AREAS[city] || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-rose-600/30 text-rose-400 border border-rose-500/30">
              <StoreIcon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {isEditing ? `編輯門店資料 — ${storeToEdit?.name}` : '新增門店'}
              </h2>
              <p className="text-xs text-slate-400">
                門店可先建立基本資料與服務區塊，後續再加入人員或指派代銷案源
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1 text-slate-800">
          {/* Section 1: 基本識別 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-rose-600" />
              一、門店代碼與基本資料
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  門店代碼 <span className="text-rose-600 font-bold">*</span>
                  <span className="text-[11px] text-slate-400 font-normal ml-1">
                    （必填且唯一識別鍵）
                  </span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="例：S004 或 PAC-004"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono uppercase"
                  disabled={isEditing}
                />
                {isEditing && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    為維護關聯資料完整性，門店建立後代碼不提供直接更名。
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  門店名稱 <span className="text-rose-600 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例：太平洋房屋 敦南旗艦店"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  所屬加盟公司抬頭 (選填)
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="例：敦南不動產仲介經紀股份有限公司"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  統一編號 (選填)
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="8位數字統一編號"
                  maxLength={8}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  門店目前狀態
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  <option value="ACTIVE">啟用 (正常聯銷營運中)</option>
                  <option value="INACTIVE">待啟用 (籌備/資料建立中)</option>
                  <option value="DISABLED">停用 (暫停銷售業務存取)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  店長姓名
                </label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="例：林店長 (可於人員建立後指派)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: 地址與聯絡方式 */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
              二、地址與聯絡資訊
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">縣市</label>
                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    const defaultDist = PRESET_SERVICE_AREAS[e.target.value]?.[0] || '';
                    setDistrict(defaultDist);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  {COMMON_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">行政區</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="例：大安區"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">門店電話</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="例：02-2771-8899"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">完整營業地址</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="例：台北市大安區敦化南路二段 88 號 1 樓"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">對接窗口姓名</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="例：陳秘書 / 王主任"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">聯絡人手機/分機</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="例：0912-345-678"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">公務電子信箱</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="例：store_dunnan@pacific.com.tw"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: 主要服務區域與擅長產品 */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              三、服務區域與擅長產品類型 (可複選)
            </h3>

            {/* Service Areas */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                主要經營區域：
              </label>
              {availablePresetAreas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {availablePresetAreas.map((area) => {
                    const selected = safeServiceAreas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleServiceArea(area)}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
                          selected
                            ? 'bg-rose-50 border-rose-300 text-rose-800 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-rose-600" />}
                        {area}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected or Custom tags */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {serviceAreas.map((area) => (
                  <span
                    key={area}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 text-white flex items-center gap-1"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => toggleServiceArea(area)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={customAreaInput}
                    onChange={(e) => setCustomAreaInput(e.target.value)}
                    onKeyDown={handleAddCustomArea}
                    placeholder="輸入自訂區域後按 Enter"
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500 w-44"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomArea}
                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Specialties */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                擅長產品類型：
              </label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_SPECIALTIES.map((spec) => {
                  const selected = safeSpecialties.includes(spec);
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => toggleSpecialty(spec)}
                      className={`px-3 py-1.5 text-xs rounded-xl border transition-colors flex items-center gap-1.5 ${
                        selected
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      {spec}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4: 內部備註 (僅代銷中心可見) */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              代銷中心內部備註
              <span className="text-[11px] text-amber-700 font-normal ml-1">
                （僅總部管理員可見，門店人員無權調閱）
              </span>
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              placeholder="例：該店業務團隊以信義區豪宅為主攻領域；預計 Q3 展開竹北高鐵聯銷合作..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? '儲存中...' : isEditing ? '儲存變更' : '確認新增門店'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
