import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../services/repository';
import { ShieldAlert, UserPlus, X, Lock, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { formatDateTaipei, formatCurrencyNTD, formatBuildingUnit } from '../../rules';

interface RegisterCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  initialProjectId?: string;
}

export const RegisterCustomerModal: React.FC<RegisterCustomerModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId,
  initialProjectId,
}) => {
  const { currentUser, scopedData, refreshData, addToast, allUsers } = useApp();
  const activeDefaultProjectId = defaultProjectId || initialProjectId;

  // 表單輸入狀態
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [projectId, setProjectId] = useState(activeDefaultProjectId || '');
  const [intendedUnitId, setIntendedUnitId] = useState('');
  const [budgetMin, setBudgetMin] = useState<number | string>(2500);
  const [budgetMax, setBudgetMax] = useState<number | string>(4500);
  const [roomsRequired, setRoomsRequired] = useState('3房');
  const [parkingRequired, setParkingRequired] = useState('需要平面車位');
  const [preferredDistricts, setPreferredDistricts] = useState('');
  const [purchasePurpose, setPurchasePurpose] = useState('自住');
  const [expectedPurchaseTime, setExpectedPurchaseTime] = useState('3個月內');
  const [source, setSource] = useState('門店在地轉介');
  const [notes, setNotes] = useState('');

  // 門店與業務指派狀態
  const [storeId, setStoreId] = useState(currentUser.storeId || '');
  const [agentId, setAgentId] = useState(currentUser.id);
  const [submitting, setSubmitting] = useState(false);

  // 取得當前使用者門店獲授權聯銷的建案清單（若是代銷中心則可見全數上架建案）
  const selectableProjects = scopedData.projects.filter((p) => {
    if (p.status !== 'ON_SALE') return false;
    if (currentUser.role === 'center_admin') return true;
    const assignment = scopedData.assignments.find(
      (a: any) => a.projectId === p.id && a.storeId === currentUser.storeId && a.status === 'ACTIVE'
    );
    return Boolean(assignment);
  });

  // 當所屬門店或專案改變時，自動調整選擇項
  useEffect(() => {
    if (selectableProjects.length > 0) {
      if (!projectId || !selectableProjects.some((p) => p.id === projectId)) {
        setProjectId(activeDefaultProjectId || selectableProjects[0].id);
      }
    }
  }, [selectableProjects, activeDefaultProjectId, projectId]);

  // 角色權限初始化承辦業務與門店
  useEffect(() => {
    if (currentUser.role === 'agent') {
      // 業務新增：自動帶入所屬門店及本人，不需且不可手動修改
      setAgentId(currentUser.id);
      setStoreId(currentUser.storeId || '');
    } else if (currentUser.role === 'store_manager') {
      // 店長新增：固定為本店，可選擇本店啟用中業務負責
      setStoreId(currentUser.storeId || '');
      setAgentId(currentUser.id);
    } else if (currentUser.role === 'center_admin') {
      if (!storeId && scopedData.stores.length > 0) {
        setStoreId(scopedData.stores[0].id);
      }
    }
  }, [currentUser, scopedData.stores, storeId]);

  // 取得所選建案之戶別列表
  const projectUnits = scopedData.units.filter((u) => u.projectId === projectId);

  // 取得所屬門店「啟用中」的業務同仁名單（不可指定其他門店人員）
  const storeActiveAgents = allUsers.filter((u) => {
    if (currentUser.role === 'store_manager') {
      return u.storeId === currentUser.storeId && u.role === 'agent' && u.status === 'ACTIVE';
    }
    if (currentUser.role === 'center_admin') {
      return storeId ? u.storeId === storeId && u.status === 'ACTIVE' : u.status === 'ACTIVE';
    }
    return u.id === currentUser.id;
  });

  // 當前選中建案的分佣版本預覽
  const selectedProject = scopedData.projects.find((p) => p.id === projectId);
  const activeCommissionVersion =
    scopedData.commissionVersions.find((v) => v.id === selectedProject?.currentCommissionVersionId) ||
    scopedData.commissionVersions.find((v) => v.projectId === projectId);

  // 檢查是否有生效且完整的分佣方案
  const isCommissionComplete = Boolean(
    activeCommissionVersion &&
      activeCommissionVersion.formulaType &&
      ((activeCommissionVersion.formulaType === 'PERCENTAGE_TOTAL' && activeCommissionVersion.percentage) ||
        (activeCommissionVersion.formulaType === 'FIXED_AMOUNT' && activeCommissionVersion.fixedAmount)) &&
      activeCommissionVersion.storePercentage !== undefined &&
      activeCommissionVersion.storePercentage !== null &&
      activeCommissionVersion.centerPercentage !== undefined &&
      activeCommissionVersion.centerPercentage !== null
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      addToast({ type: 'error', title: '請填寫必填欄位', message: '客戶稱呼為必填欄位。' });
      return;
    }
    if (!phone.trim()) {
      addToast({ type: 'error', title: '請填寫必填欄位', message: '聯絡電話為必填欄位。' });
      return;
    }
    if (!projectId) {
      addToast({ type: 'error', title: '請填寫必填欄位', message: '請選擇意向建案。' });
      return;
    }

    if (!isCommissionComplete) {
      addToast({
        type: 'error',
        title: '分佣方案未就緒',
        message: '該建案尚無已生效且完整的分佣方案，無法進行客戶登記，請聯絡代銷中心設定建案分佣方案。',
      });
      return;
    }

    const nBudgetMin = budgetMin !== '' ? Number(budgetMin) : undefined;
    const nBudgetMax = budgetMax !== '' ? Number(budgetMax) : undefined;
    if (nBudgetMin !== undefined && nBudgetMax !== undefined && nBudgetMax < nBudgetMin) {
      addToast({ type: 'error', title: '預算填寫錯誤', message: '預算上限不得低於預算下限。' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await repository.registerCustomer({
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        projectId,
        intendedUnitId: intendedUnitId || undefined,
        budgetMin: nBudgetMin,
        budgetMax: nBudgetMax,
        roomsRequired,
        parkingRequired,
        preferredDistricts: preferredDistricts.trim() || undefined,
        purchasePurpose,
        expectedPurchaseTime,
        source,
        notes: notes.trim() || undefined,
        storeId: currentUser.role === 'center_admin' ? storeId : currentUser.storeId,
        agentId: currentUser.role === 'agent' ? currentUser.id : agentId,
        operator: currentUser,
      });

      await refreshData();

      if (result.isConflict) {
        addToast({
          type: 'warning',
          title: '已進入中心歸屬待判定',
          message: result.message || '此客戶資料需要中心確認歸屬',
        });
      } else {
        addToast({
          type: 'success',
          title: '客戶登記成功！',
          message: '已取得 30 天專屬保留期，並鎖定不可變分佣快照。',
        });
      }

      onClose();
      // 成功後清空完整表單 (第三階段規範：每次新增應初始化整份表單，預算不得沿用)
      setCustomerName('');
      setPhone('');
      setEmail('');
      setIntendedUnitId('');
      setBudgetMin(2500);
      setBudgetMax(4500);
      setRoomsRequired('3房');
      setParkingRequired('需要平面車位');
      setPreferredDistricts('');
      setPurchasePurpose('自住');
      setExpectedPurchaseTime('3個月內');
      setSource('門店在地轉介');
      setNotes('');
    } catch (err: any) {
      // 失敗時保留已輸入內容，不清除表單
      addToast({
        type: 'error',
        title: '登記未完成',
        message: err.message || '發生錯誤，請檢查建案指派授權或稍後重試。',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <UserPlus className="w-5 h-5 text-rose-600" />
            新增客戶專屬保留登記（30天保護期）
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 示範安全告示牌與用途提醒 (依規定固定顯示) */}
        <div className="my-3 space-y-2">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">示範環境個資安全規範：</strong>
              本系統為示範環境，<span className="font-bold underline">不得輸入真實個人資料</span>。請使用虛構客戶稱呼與測試電話（如「林先生 / 0912-000-001」）。
            </div>
          </div>
          <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>資料用途提醒：</strong>
              本登記將建立專屬 30 天保護期、不可變分佣快照，並作為代銷中心與門店跨案排他權益依據。
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 客戶基本資料 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                客戶稱呼 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="例如：張先生（示範客戶）"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                聯絡電話 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例如：0912-345-678"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">電子郵件（選填）</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例如：client@example.demo"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* 意向建案與意向戶別 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                意向建案 <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setIntendedUnitId('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              >
                {selectableProjects.length === 0 ? (
                  <option value="">（無可選的上架授權建案）</option>
                ) : (
                  selectableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.city}{p.district} · {p.productType === 'PRE_SALE' ? '預售屋' : p.productType === 'NEW_CONSTRUCTION' ? '新成屋' : '餘屋'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">意向戶別（選填）</label>
              <select
                value={intendedUnitId}
                onChange={(e) => setIntendedUnitId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              >
                <option value="">-- 尚未指定特定戶別 --</option>
                {projectUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {formatBuildingUnit(u.building, u.unitNumber)} ({u.pattern} · {u.areaPings || u.totalPing}坪 · 開價 {(u.listPrice / 10000).toLocaleString('zh-TW')} 萬元)
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                <span>💡 客戶保留不等於戶別保留；選擇戶別僅供意向記錄，不鎖定戶別亦不影響他人看屋。</span>
              </div>
            </div>
          </div>

          {/* 購屋需求欄位矩陣 */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>購屋需求條件</span>
              <span className="text-[11px] text-slate-500 font-normal">（與本次建案登記綁定，不覆寫其他門店資料）</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  預算範圍下限 <span className="text-slate-500">(單位：萬元)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="例如：2500"
                    className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-medium">萬元</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  預算範圍上限 <span className="text-slate-500">(單位：萬元)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="例如：4500"
                    className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-medium">萬元</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">房型需求</label>
                <select
                  value={roomsRequired}
                  onChange={(e) => setRoomsRequired(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  <option value="1房">1 房</option>
                  <option value="2房">2 房</option>
                  <option value="3房">3 房</option>
                  <option value="4房以上">4 房以上</option>
                  <option value="不拘">不拘</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">車位需求</label>
                <select
                  value={parkingRequired}
                  onChange={(e) => setParkingRequired(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  <option value="不需要車位">不需要車位</option>
                  <option value="需要平面車位">需要平面車位</option>
                  <option value="需要機械車位">需要機械車位</option>
                  <option value="車位不拘">車位不拘</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">購屋目的</label>
                <select
                  value={purchasePurpose}
                  onChange={(e) => setPurchasePurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  <option value="自住">自住</option>
                  <option value="換屋">換屋</option>
                  <option value="投資">投資</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">預計購屋時間</label>
                <select
                  value={expectedPurchaseTime}
                  onChange={(e) => setExpectedPurchaseTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  <option value="1個月內">1 個月內（急迫）</option>
                  <option value="3個月內">3 個月內</option>
                  <option value="半年內">半年內</option>
                  <option value="1年以上">1 年以上</option>
                  <option value="積極評估中">積極評估中</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">區域需求</label>
                <input
                  type="text"
                  value={preferredDistricts}
                  onChange={(e) => setPreferredDistricts(e.target.value)}
                  placeholder="例如：大安區、文山區、捷運沿線"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">客戶來源</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  <option value="門店在地轉介">門店在地轉介</option>
                  <option value="展場自來客">展場自來客</option>
                  <option value="網路預約">網路預約</option>
                  <option value="親友轉介">親友轉介</option>
                  <option value="電話行銷開發">電話行銷開發</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>
          </div>

          {/* 承辦業務與門店設定 (依使用者角色保護) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">承辦門店</label>
              {currentUser.role === 'center_admin' ? (
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {scopedData.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={currentUser.storeName || '所屬門店'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-medium"
                />
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                負責業務同仁
                {currentUser.role === 'store_manager' && (
                  <span className="text-[11px] text-slate-500 ml-1 font-normal">(可指定本店啟用中業務或店長自辦)</span>
                )}
                {currentUser.role === 'agent' && (
                  <span className="text-[11px] text-slate-500 ml-1 font-normal">(業務本人承辦，系統鎖定)</span>
                )}
              </label>
              {currentUser.role === 'agent' ? (
                <input
                  type="text"
                  disabled
                  value={`${currentUser.name} (${currentUser.title || '專案業務'})`}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-medium"
                />
              ) : currentUser.role === 'store_manager' ? (
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  <option value={currentUser.id}>{currentUser.name} (店長自辦)</option>
                  {storeActiveAgents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.title || '業務同仁'})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                >
                  {storeActiveAgents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.storeName} · {ag.title})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">備註說明</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="填寫客戶初次聯繫重點、特殊交涉需求或洽談指引..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* 分佣快照即時預覽卡片 */}
          {isCommissionComplete ? (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-slate-700 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px] leading-relaxed w-full">
                <div className="flex items-center justify-between font-bold text-emerald-900">
                  <span>鎖定分佣快照預覽 [{activeCommissionVersion?.versionNumber || 'V1.0'}]</span>
                  <span className="text-emerald-700 font-medium">生效日期：{formatDateTaipei(activeCommissionVersion?.effectiveDate || activeCommissionVersion?.createdAt)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-emerald-200/60 text-slate-700">
                  <div>
                    <span className="text-slate-500">計算方式：</span>
                    <strong className="text-slate-800">
                      {activeCommissionVersion?.formulaType === 'PERCENTAGE_TOTAL'
                        ? `成交總價 ${activeCommissionVersion?.percentage}%`
                        : `固定每戶 ${formatCurrencyNTD(activeCommissionVersion?.fixedAmount || 0)}`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">門店拆分：</span>
                    <strong className="text-emerald-700">{activeCommissionVersion?.storePercentage}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">代銷中心拆分：</span>
                    <strong className="text-slate-700">{activeCommissionVersion?.centerPercentage}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">適用條件：</span>
                    <strong className="text-slate-700">{activeCommissionVersion?.applicableConditions || '需完成聯銷合約成約'}</strong>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-800 pt-0.5">
                  ★ 成功登記時將以此條件自動建立不可覆寫分佣快照，並享有以客戶＋建案為單位之 30 天專屬保護期。
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <strong className="font-bold">分佣方案未就緒（禁止登記）：</strong>
                <p>
                  該建案尚無已生效且完整的分佣方案，無法進行客戶登記。請聯絡代銷中心設定建案分佣方案後再行登記，系統不會使用 0 或預設比例代替。
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !isCommissionComplete}
              className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? '登記處理中...' : '確認登記並取得30天保留'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
