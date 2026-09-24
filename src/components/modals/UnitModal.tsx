import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { Unit, UnitStatus } from '../../types';
import { formatBuildingUnit } from '../../rules';
import {
  Home,
  X,
  CheckCircle2,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Info,
  DollarSign,
  Layers,
} from 'lucide-react';

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  initialUnit?: Unit | null;
  onSuccess?: (unit: Unit) => void;
}

export const UnitModal: React.FC<UnitModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId,
  initialUnit,
  onSuccess,
}) => {
  const { currentUser, scopedData, refreshData, addToast } = useApp();
  const isEditing = Boolean(initialUnit);

  const [projectId, setProjectId] = useState(
    initialUnit?.projectId || defaultProjectId || scopedData.projects[0]?.id || ''
  );
  const [building, setBuilding] = useState('A');
  const [unitNumber, setUnitNumber] = useState('12F-1');
  const [floor, setFloor] = useState<number>(12);

  // 格局
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [livingRooms, setLivingRooms] = useState<number>(2);
  const [bathrooms, setBathrooms] = useState<number>(2);

  // 坪數規格
  const [totalPing, setTotalPing] = useState<string>('45.6');
  const [includesParking, setIncludesParking] = useState<boolean>(true);
  const [mainPing, setMainPing] = useState<string>('26.8');
  const [subPing, setSubPing] = useState<string>('3.2');
  const [commonPing, setCommonPing] = useState<string>('15.6');
  const [parkingPing, setParkingPing] = useState<string>('9.5');

  // 車位資訊
  const [parkingNumber, setParkingNumber] = useState('B2-108');
  const [parkingType, setParkingType] = useState('坡道平面');

  // 金額 (單位：萬元)
  const [housePrice, setHousePrice] = useState<string>('2450');
  const [parkingPrice, setParkingPrice] = useState<string>('250');
  const [listPrice, setListPrice] = useState<string>('2700'); // 總開價
  const [bottomPrice, setBottomPrice] = useState<string>('2480'); // 僅中心可見

  const [status, setStatus] = useState<UnitStatus>('AVAILABLE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 檢查此戶別是否已有審核中/進行中交易
  const activeTx = initialUnit
    ? scopedData.transactions.find(
        (t) =>
          t.unitId === initialUnit.id &&
          t.stage !== 'CANCELLED'
      )
    : null;

  useEffect(() => {
    if (initialUnit) {
      setProjectId(initialUnit.projectId);
      setBuilding(initialUnit.building || '');
      setUnitNumber(initialUnit.unitNumber || '');
      setFloor(initialUnit.floor || 1);
      setBedrooms(initialUnit.bedrooms !== undefined ? initialUnit.bedrooms : 3);
      setLivingRooms(initialUnit.livingRooms !== undefined ? initialUnit.livingRooms : 2);
      setBathrooms(initialUnit.bathrooms !== undefined ? initialUnit.bathrooms : 2);
      setTotalPing(String(initialUnit.totalPing || initialUnit.areaPings || ''));
      setIncludesParking(initialUnit.includesParking ?? true);
      setMainPing(initialUnit.mainPing !== undefined ? String(initialUnit.mainPing) : '');
      setSubPing(initialUnit.subPing !== undefined ? String(initialUnit.subPing) : '');
      setCommonPing(initialUnit.commonPing !== undefined ? String(initialUnit.commonPing) : '');
      setParkingPing(initialUnit.parkingPing !== undefined ? String(initialUnit.parkingPing) : '');
      setParkingNumber(initialUnit.parkingNumber || '');
      setParkingType(initialUnit.parkingType || '坡道平面');
      setHousePrice(initialUnit.housePrice !== undefined ? String(initialUnit.housePrice / 10000) : '');
      setParkingPrice(initialUnit.parkingPrice !== undefined ? String(initialUnit.parkingPrice / 10000) : '');
      setListPrice(initialUnit.listPrice !== undefined ? String(initialUnit.listPrice / 10000) : '');
      setBottomPrice(initialUnit.bottomPrice !== undefined ? String(initialUnit.bottomPrice / 10000) : '');
      setStatus(initialUnit.status);
      setNotes(initialUnit.notes || '');
    } else {
      setProjectId(defaultProjectId || scopedData.projects[0]?.id || '');
      setBuilding('A');
      setUnitNumber('10F-1');
      setFloor(10);
      setBedrooms(3);
      setLivingRooms(2);
      setBathrooms(2);
      setTotalPing('');
      setIncludesParking(true);
      setMainPing('');
      setSubPing('');
      setCommonPing('');
      setParkingPing('');
      setParkingNumber('');
      setParkingType('坡道平面');
      setHousePrice('');
      setParkingPrice('');
      setListPrice('');
      setBottomPrice('');
      setStatus('AVAILABLE');
      setNotes('');
    }
  }, [initialUnit, defaultProjectId, isOpen, scopedData.projects]);

  if (!isOpen) return null;

  // 自動依房屋開價與車位開價計算建議總開價
  const handleAutoCalculateTotal = () => {
    const hp = Number(housePrice) || 0;
    const pp = Number(parkingPrice) || 0;
    if (hp > 0) {
      setListPrice(String(hp + pp));
      addToast({
        type: 'info',
        title: '已自動加總',
        message: `總開價已更新為房屋 (${hp} 萬) + 車位 (${pp} 萬) = ${hp + pp} 萬元。`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      addToast({ type: 'error', title: '請選擇建案', message: '所屬建案代碼不能為空。' });
      return;
    }
    if (!building.trim() || !unitNumber.trim()) {
      addToast({ type: 'error', title: '請填寫戶別代號', message: '棟別與戶號皆為必填項目。' });
      return;
    }

    // 規則 1：同建案「棟別＋戶號」唯一性前端預先檢查
    const duplicate = scopedData.units.find(
      (u) =>
        u.projectId === projectId &&
        u.building?.trim().toUpperCase() === building.trim().toUpperCase() &&
        u.unitNumber?.trim().toUpperCase() === unitNumber.trim().toUpperCase() &&
        (!isEditing || u.id !== initialUnit?.id) &&
        u.status !== 'DISABLED'
    );
    if (duplicate) {
      addToast({
        type: 'error',
        title: '棟別與戶號重複',
        message: `建案中已存在「${formatBuildingUnit(building, unitNumber)}」，請確認後重填。`,
      });
      return;
    }

    // 規則 2：金額不得為負值；缺漏金額不能當成 0
    if (!listPrice || listPrice.trim() === '') {
      addToast({
        type: 'error',
        title: '缺少總開價',
        message: '請填寫戶別總開價金額，缺漏金額不得當成 0。',
      });
      return;
    }
    const numListPrice = Number(listPrice);
    if (isNaN(numListPrice) || numListPrice < 0) {
      addToast({ type: 'error', title: '金額錯誤', message: '總開價金額必須大於或等於 0，不可為負值。' });
      return;
    }

    const numHousePrice = housePrice !== '' ? Number(housePrice) : undefined;
    if (numHousePrice !== undefined && (isNaN(numHousePrice) || numHousePrice < 0)) {
      addToast({ type: 'error', title: '金額錯誤', message: '房屋開價不可為負值。' });
      return;
    }

    const numParkingPrice = parkingPrice !== '' ? Number(parkingPrice) : undefined;
    if (numParkingPrice !== undefined && (isNaN(numParkingPrice) || numParkingPrice < 0)) {
      addToast({ type: 'error', title: '金額錯誤', message: '車位價格不可為負值。' });
      return;
    }

    const numBottomPrice = bottomPrice !== '' ? Number(bottomPrice) : undefined;
    if (numBottomPrice !== undefined && (isNaN(numBottomPrice) || numBottomPrice < 0)) {
      addToast({ type: 'error', title: '金額錯誤', message: '底價不可為負值。' });
      return;
    }

    // 儲存單位統一為「元」
    const yuanListPrice = Math.round(numListPrice * 10000);
    const yuanHousePrice = numHousePrice !== undefined ? Math.round(numHousePrice * 10000) : undefined;
    const yuanParkingPrice = numParkingPrice !== undefined ? Math.round(numParkingPrice * 10000) : undefined;
    const yuanBottomPrice = numBottomPrice !== undefined ? Math.round(numBottomPrice * 10000) : undefined;

    // 規則 5：已有交易的戶別不可透過一般編輯切換狀態
    if (activeTx && status !== initialUnit?.status) {
      addToast({
        type: 'error',
        title: '狀態受交易審核監管',
        message: `此戶別已有進行中的交易紀錄 (${activeTx.stage})，狀態必須走交易審核流程變更！`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const pattern = `${bedrooms}房${livingRooms}廳${bathrooms}衛`;
      const numTotalPing = totalPing ? Number(totalPing) : 0;

      const payload: Partial<Unit> = {
        projectId,
        building: building.trim(),
        unitNumber: unitNumber.trim(),
        floor: Number(floor) || 1,
        pattern,
        bedrooms: Number(bedrooms),
        livingRooms: Number(livingRooms),
        bathrooms: Number(bathrooms),
        totalPing: numTotalPing,
        areaPings: numTotalPing,
        includesParking,
        mainPing: mainPing ? Number(mainPing) : undefined,
        subPing: subPing ? Number(subPing) : undefined,
        commonPing: commonPing ? Number(commonPing) : undefined,
        parkingPing: parkingPing ? Number(parkingPing) : undefined,
        parkingNumber: parkingNumber.trim(),
        parkingType: parkingType.trim(),
        parkingInfo: parkingNumber ? `${parkingNumber} (${parkingType || '平面式'})` : '',
        housePrice: yuanHousePrice,
        parkingPrice: yuanParkingPrice,
        listPrice: yuanListPrice,
        bottomPrice: currentUser.role === 'center_admin' ? yuanBottomPrice : undefined,
        status,
        notes: notes.trim(),
        updatedAt: nowIso,
      };

      if (isEditing && initialUnit) {
        payload.id = initialUnit.id;
        const res = await repository.updateUnit(initialUnit.id, payload, currentUser);
        addToast({
          type: 'success',
          title: '戶別更新成功',
          message: `戶別「${formatBuildingUnit(building, unitNumber)}」已更新，建案可售戶數已重新計算。`,
        });
        if (onSuccess && res?.unit) onSuccess(res.unit);
      } else {
        payload.id = `u_${projectId}_${building.trim()}_${unitNumber.trim()}_${Date.now()}`;
        payload.createdAt = nowIso;
        const res = await repository.saveUnit(payload, currentUser);
        addToast({
          type: 'success',
          title: '戶別新增成功',
          message: `戶別「${formatBuildingUnit(building, unitNumber)}」已新增，開價 ${numListPrice} 萬元。`,
        });
        if (onSuccess && res?.unit) onSuccess(res.unit);
      }

      await refreshData();
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: isEditing ? '更新失敗' : '新增失敗',
        message: err.message || '伺服器處理失敗',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 my-6 flex flex-col max-h-[92vh] overflow-hidden">
        {/* 頂部標題 */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {isEditing ? `編輯戶別 · ${formatBuildingUnit(initialUnit?.building, initialUnit?.unitNumber)}` : '新增建案可售戶別'}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700">
                  中心戶別管理
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                嚴格遵循防重複棟別戶號、不可負值金額、總價含車位區分與交易審核聯動規範。
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

        {/* 表單本體 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* 所屬建案 */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              所屬建案 <span className="text-rose-500">*</span>
            </label>
            <select
              value={projectId}
              disabled={isEditing}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium bg-white disabled:bg-slate-100"
            >
              {scopedData.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.city}{p.district} · {p.developer || '建商未提供'})
                </option>
              ))}
            </select>
          </div>

          {/* 1. 棟別、戶號、樓層 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Layers className="w-4 h-4 text-rose-600" /> 戶別定位標示 (規則 1：同建案「棟別＋戶號」不得重複)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  棟別 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="例：A 或 A棟"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  戶號 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="例：12F-1 或 A1"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">樓層 (F)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={floor}
                  onChange={(e) => setFloor(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>
            </div>

            {/* 格局：房、廳、衛 */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">房間數 (房)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">客餐廳 (廳)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={livingRooms}
                  onChange={(e) => setLivingRooms(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">衛浴數 (衛)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>

          {/* 2. 坪數結構與車位標記 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs">坪數與面積結構 (單位：坪)</h4>
              {/* 規則 3：明確區分總價與登記坪數是否含車位 */}
              <label className="flex items-center gap-2 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <input
                  type="checkbox"
                  checked={includesParking}
                  onChange={(e) => setIncludesParking(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-slate-800 text-[11px]">
                  總登記坪數與總價含車位
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  建物登記總坪數 <span className="text-rose-500">* (坪)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalPing}
                  onChange={(e) => setTotalPing(e.target.value)}
                  placeholder="例：45.8"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  車位坪數 <span className="text-slate-400 font-normal">(選填，單位：坪)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={parkingPing}
                  onChange={(e) => setParkingPing(e.target.value)}
                  placeholder="例：9.5"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block font-medium text-slate-600 mb-1">主建物坪數</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={mainPing}
                  onChange={(e) => setMainPing(e.target.value)}
                  placeholder="例：26.5"
                  className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">附屬建物坪數</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={subPing}
                  onChange={(e) => setSubPing(e.target.value)}
                  placeholder="例：3.2 (陽台等)"
                  className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">共有部分坪數</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={commonPing}
                  onChange={(e) => setCommonPing(e.target.value)}
                  placeholder="例：16.1 (公設)"
                  className="w-full px-2.5 py-1 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            {/* 車位編號與型式 */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">車位編號</label>
                <input
                  type="text"
                  value={parkingNumber}
                  onChange={(e) => setParkingNumber(e.target.value)}
                  placeholder="例：B2-108 或 無車位"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">車位類型</label>
                <select
                  value={parkingType}
                  onChange={(e) => setParkingType(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="坡道平面">坡道平面 (平面大車位)</option>
                  <option value="坡道機械">坡道機械</option>
                  <option value="升降機械">升降機械</option>
                  <option value="升降平面">升降平面</option>
                  <option value="無車位">無附屬車位</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. 金額欄位 (規則 2：不可為負值，缺漏不可當成 0，清楚標示單位「萬元」) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                價格設定 <span className="text-emerald-700 font-bold">(標示單位：萬元)</span>
              </h4>
              <button
                type="button"
                onClick={handleAutoCalculateTotal}
                className="text-[11px] px-2 py-0.5 text-rose-600 hover:text-rose-700 font-semibold underline"
              >
                自動依房屋+車位試算總開價
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">房屋開價 (萬元)</label>
                <input
                  type="number"
                  min="0"
                  value={housePrice}
                  onChange={(e) => setHousePrice(e.target.value)}
                  placeholder="例：2450"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">車位價格 (萬元)</label>
                <input
                  type="number"
                  min="0"
                  value={parkingPrice}
                  onChange={(e) => setParkingPrice(e.target.value)}
                  placeholder="例：250"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  總開價 <span className="text-rose-500">* (萬元)</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="例：2700"
                  className="w-full px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50/30 text-rose-900 font-bold"
                />
              </div>
            </div>

            {/* 底價：僅中心管理員可查看與編輯 */}
            {currentUser.role === 'center_admin' && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-bold text-rose-900 text-xs">底價 (僅代銷中心內部可視)</span>
                    <p className="text-[10px] text-rose-700">門店端 API 徹底剝除此欄位，保障總部底價談判空間。</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 w-36">
                  <input
                    type="number"
                    min="0"
                    value={bottomPrice}
                    onChange={(e) => setBottomPrice(e.target.value)}
                    placeholder="底價 (萬元)"
                    className="w-full px-2.5 py-1 rounded border border-rose-300 bg-white font-bold text-rose-900 text-xs"
                  />
                  <span className="text-[11px] text-rose-800 font-semibold shrink-0">萬</span>
                </div>
              </div>
            )}
          </div>

          {/* 4. 銷售狀態與審核鎖定提示 (規則 5) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">銷售狀態</label>
              {activeTx ? (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    已受交易審核流程監管
                  </div>
                  <p className="text-[11px] text-amber-700">
                    此戶別目前有進行中的交易（交易階段：{activeTx.stage}）。依照規章，不可透過一般戶別編輯隨意更動狀態。
                  </p>
                  <div className="font-bold text-slate-800 pt-1">目前狀態：{status}</div>
                </div>
              ) : (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UnitStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium bg-white"
                >
                  <option value="AVAILABLE">可售 (AVAILABLE)</option>
                  <option value="NEGOTIATING">洽談保留中 (NEGOTIATING)</option>
                  <option value="RESERVED_DEPOSIT">已收訂保留 (RESERVED_DEPOSIT)</option>
                  <option value="SIGNED">已簽約 (SIGNED)</option>
                  <option value="DEAL_CLOSED">已成交結案 (DEAL_CLOSED)</option>
                  <option value="PAUSED">暫停銷售 (PAUSED)</option>
                  <option value="DISABLED">停用 (DISABLED)</option>
                </select>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">戶別備註說明</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例：邊間三面採光、次頂樓無遮蔽綠意景觀、附贈大金冷暖變頻室外機..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* 表單底部操作 */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
              <span>儲存後將同步自動重新校正建案之「可售戶數」與「總戶數」。</span>
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
                {submitting ? '儲存中...' : isEditing ? '儲存戶別變更' : '新增此戶別'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
