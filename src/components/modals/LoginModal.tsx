import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Sparkles,
  AlertCircle,
  Mail,
  Lock,
  ArrowRight,
  Info,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginWithDemo, allUsers, isDemoSession, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'google' | 'demo'>('google');
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Setup Google Identity Services if client ID is provided
  useEffect(() => {
    if (!isOpen || !googleClientId) return;

    const handleGoogleCallback = async (response: any) => {
      if (response.credential) {
        setLoading(true);
        setErrorMsg('');
        try {
          await loginWithGoogle(response.credential);
          onClose();
        } catch (err: any) {
          setErrorMsg(err.message || 'Google 登入驗證失敗');
        } finally {
          setLoading(false);
        }
      }
    };

    // Dynamically load Google script if needed
    const scriptId = 'google-gsi-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    script.onload = () => {
      if ((window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCallback,
          auto_select: false,
        });

        const btnDiv = document.getElementById('googleSignInBtnContainer');
        if (btnDiv) {
          (window as any).google.accounts.id.renderButton(btnDiv, {
            theme: 'filled_blue',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 320,
          });
        }
      }
    };
  }, [isOpen, googleClientId, loginWithGoogle, onClose]);

  if (!isOpen) return null;

  // 模擬產生 JWT 憑證送往後端進行正式 Google 註冊與待開通審核
  const handleSimulateGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      setErrorMsg('請輸入有效的 Google 電子郵件信箱');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      // 構建 JWT 結構以符合後端 Google Token 驗證或自解格式
      const name = testName || testEmail.split('@')[0];
      const payload = {
        email: testEmail.trim().toLowerCase(),
        name,
        sub: `google_oauth_${Math.random().toString(36).substring(2, 10)}`,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      };

      // Base64Url encode payload
      const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const simulatedJwt = `simulated_header.${encodedPayload}.simulated_signature`;

      await loginWithGoogle(simulatedJwt);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemoUser = async (username: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      await loginWithDemo(username);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '示範登入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-600/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">太平洋房屋｜系統身分登入</h2>
              <p className="text-xs text-slate-500">預售與新成屋加盟聯銷平台</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* 標籤頁切換 */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('google')}
            className={`flex-1 pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'google'
                ? 'text-rose-600 border-b-2 border-rose-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            正式 Google 登入 / 註冊
          </button>
          <button
            onClick={() => setActiveTab('demo')}
            className={`flex-1 pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'demo'
                ? 'text-rose-600 border-b-2 border-rose-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            快速切換示範角色 (免密碼)
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google 登入分頁 */}
        {activeTab === 'google' && (
          <div className="space-y-5">
            {googleClientId ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div id="googleSignInBtnContainer" className="flex justify-center" />
                <p className="text-[11px] text-slate-500 text-center">
                  已連結 Google OAuth 用戶端，可直接以公司或個人 Google 帳號授權
                </p>
              </div>
            ) : null}

            {/* 快速 Google 帳號登入 / 註冊表單 */}
            <form onSubmit={handleSimulateGoogleLogin} className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-rose-600" />
                    輸入 Google 帳號登入 / 新增業務開通申請
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-1">Google Email 電子郵件</label>
                    <input
                      type="email"
                      required
                      placeholder="例如：agent.wang@pacific-realty.com.tw"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">使用者姓名 (選填)</label>
                    <input
                      type="text"
                      placeholder="例如：王小明"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  <span>太平洋房屋資安規範與審核機制：</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  登入成功不代表自動取得業務資料權限。新使用者註冊後預設為<strong>「待開通 (PENDING_APPROVAL)」</strong>，需由代銷中心管理員核實加盟門店資格並指派角色後方可進入工作區。
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? '驗證中...' : '進行 Google 授權與審核登記'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* 示範角色切換分頁 */}
        {activeTab === 'demo' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              選擇不同層級之免密碼示範身分，快速體驗「中心總部」、「加盟店長」與「專任營業員」之嚴格資料隔離視野：
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {allUsers.map((u) => {
                const isCurrent = isDemoSession && currentUser.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleSelectDemoUser(u.username)}
                    disabled={loading}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'border-rose-600 bg-rose-50/50 ring-1 ring-rose-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                        {u.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{u.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border">
                            {u.role === 'center_admin'
                              ? '代銷中心總部'
                              : u.role === 'store_manager'
                              ? '加盟店長'
                              : '專任業務'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{u.storeName || u.title}</p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="text-xs text-rose-600 font-bold">目前使用中</span>
                    ) : (
                      <span className="text-xs text-slate-400 group-hover:text-slate-600">切換 ➔</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
