import React, { useState, useEffect } from 'react';
import { User, Store } from '../../types';
import { apiClient } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import {
  User as UserIcon,
  X,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  FileBadge,
  AlertCircle,
  FileText,
  KeyRound,
} from 'lucide-react';

interface PersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: User | null;
  defaultStoreId?: string;
  onSuccess?: () => void;
}

export const PersonnelModal: React.FC<PersonnelModalProps> = ({
  isOpen,
  onClose,
  userToEdit,
  defaultStoreId,
  onSuccess,
}) => {
  const { currentUser, scopedData, fetchAdminUsers, refreshData, addToast } = useApp();
  const isEditing = !!userToEdit;

  // Form states
  const [name, setName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [role, setRole] = useState<string>('agent');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [status, setStatus] = useState<string>('ACTIVE');
  const [boundEmail, setBoundEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableStores = scopedData.stores;

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name || '');
      setStoreId(userToEdit.storeId || defaultStoreId || availableStores[0]?.id || '');
      setRole(userToEdit.role || 'agent');
      setTitle(userToEdit.title || '');
      setPhone(userToEdit.phone || '');
      setMobilePhone(userToEdit.mobilePhone || '');
      setEmail(userToEdit.email || '');
      setLicenseNumber(userToEdit.licenseNumber || '');
      setStatus(userToEdit.status || 'ACTIVE');
      setBoundEmail(userToEdit.boundEmail || '');
      setNotes(userToEdit.notes || '');
    } else {
      setName('');
      // If store_manager, lock to their store
      const initialStoreId =
        currentUser.role === 'store_manager'
          ? currentUser.storeId || ''
          : defaultStoreId || availableStores[0]?.id || '';
      setStoreId(initialStoreId);
      setRole('agent');
      setTitle('營業員');
      setPhone('');
      setMobilePhone('');
      setEmail('');
      setLicenseNumber('');
      setStatus('PENDING_BINDING');
      setBoundEmail('');
      setNotes('');
    }
    setErrorMessage(null);
  }, [userToEdit, isOpen, defaultStoreId, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('請填寫同仁姓名（必填）');
      return;
    }

    if (role !== 'center_admin' && !storeId) {
      setErrorMessage('請選擇所屬加盟門店（必選）');
      return;
    }

    setSubmitting(true);
    try {
      const selectedStore = availableStores.find((s) => s.id === storeId);
      const storeName = role === 'center_admin' ? '代銷中心' : selectedStore?.name || '';

      const payload: Partial<User> = {
        name: name.trim(),
        storeId: role === 'center_admin' ? undefined : storeId,
        storeName,
        role: role as any,
        title: title.trim() || (role === 'center_admin' ? '中心專案主管' : role === 'store_manager' ? '加盟店長' : '營業員'),
        phone: phone.trim(),
        mobilePhone: mobilePhone.trim(),
        email: email.trim(),
        licenseNumber: licenseNumber.trim(),
        status: status as any,
        boundEmail: boundEmail.trim() || undefined,
        isBound: !!boundEmail.trim(),
        notes: notes.trim(),
      };

      if (isEditing && userToEdit) {
        await apiClient.updateUser(userToEdit.id, payload);
        addToast({
          type: 'success',
          title: '同仁資料已更新',
          message: `同仁 [${name}] 的資料與登入設定已儲存。`,
        });
      } else {
        await apiClient.createUser(payload);
        addToast({
          type: 'success',
          title: '同仁資料建立成功',
          message: `已建立同仁 [${name}] 資料。${
            boundEmail
              ? `已設定預先綁定 Google 帳號 (${boundEmail})。`
              : '同仁後續可透過 Google 登入後進行帳號綁定。'
          }`,
        });
      }

      await fetchAdminUsers();
      await refreshData();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Save personnel error:', err);
      setErrorMessage(err.message || '儲存同仁失敗，請檢查輸入內容');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              <UserIcon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {isEditing ? `編輯人員資料 — ${userToEdit?.name}` : '建立新進同仁資料'}
              </h2>
              <p className="text-xs text-slate-400">
                可先建立同仁基本資料，同仁以 Google 登入後再綁定；亦可預先指定 Google 信箱
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
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1 text-slate-800">
          {/* Section 1: 基本資訊 */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
              一、基本資料與門店歸屬
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  同仁姓名 <span className="text-rose-600 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例：王小明"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  所屬加盟門店 <span className="text-rose-600 font-bold">*</span>
                </label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  disabled={currentUser.role === 'store_manager'}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100"
                >
                  <option value="">-- 請選擇加盟門店 --</option>
                  {availableStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
                {currentUser.role === 'store_manager' && (
                  <p className="text-[11px] text-slate-400 mt-1">店長僅可管理所屬門店同仁</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  角色身分 <span className="text-rose-600 font-bold">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    const r = e.target.value;
                    setRole(r);
                    if (r === 'store_manager' && !title) setTitle('加盟店長');
                    if (r === 'agent' && !title) setTitle('營業員');
                  }}
                  disabled={currentUser.role !== 'center_admin'}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100"
                >
                  <option value="agent">營業員 (經手客戶與帶看)</option>
                  <option value="store_manager">加盟店長 (綜理門店案源與同仁)</option>
                  {currentUser.role === 'center_admin' && (
                    <option value="center_admin">代銷中心管理員 (總部全權限)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  自訂職稱文字
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：資深專案經理 / 副店長"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  營業員/經紀人證號
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="例：(111)登字第425890號"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  同仁在職狀態
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="ACTIVE">在職/啟用 (可正常登入與接單)</option>
                  <option value="PENDING_BINDING">待綁定 Google (資料已立，待綁帳號)</option>
                  <option value="PENDING_APPROVAL">待審核開通 (待總部開通核可)</option>
                  <option value="DISABLED">停用/停職 (停止所有存取)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: 聯絡方式 */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-indigo-600" />
              二、聯絡電話與電子信箱
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">公務手機</label>
                <input
                  type="tel"
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  placeholder="例：0912-345-678"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">公司分機/市話</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="例：02-2771-8899 #102"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">公務電子信箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="例：wang@pacific.com.tw"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: 登入身分與 Google 帳號綁定 */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              三、登入身分（Google 帳號預先綁定）
            </h3>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                預先指定綁定之 Google 帳號 (Email)
                <span className="text-[11px] text-slate-400 font-normal ml-1">
                  （選填；填寫後該信箱首次以 Google 登入即自動匹配並認領此人員）
                </span>
              </label>
              <input
                type="email"
                value={boundEmail}
                onChange={(e) => setBoundEmail(e.target.value)}
                placeholder="例：sales.wang@gmail.com"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                流程說明：若暫不輸入，同仁後續可先以 Google 登入產生申請，再由代銷中心或店長於後台點擊「綁定帳號」連結兩者。
              </p>
            </div>
          </div>

          {/* Section 4: 內部備註 */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              同仁內部備註
              <span className="text-[11px] text-slate-400 font-normal ml-1">
                （僅代銷中心與所屬門店店長可見）
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="例：2026/03 到職；具備地政士及不動產營業員雙證照..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? '儲存中...' : isEditing ? '儲存同仁變更' : '建立人員資料'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
