/**
 * 太平洋房屋｜預售與新成屋聯銷平台
 * 全域應用程式 Context (對接後端 Node.js MongoDB 資料庫)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '../types';
import { repository, ScopedDataState } from '../services/repository';
import { apiClient } from '../services/apiClient';

export type NavTab =
  | 'dashboard'
  | 'projects'
  | 'units'
  | 'assignments'
  | 'stores'
  | 'customers'
  | 'viewings'
  | 'transactions'
  | 'commission'
  | 'users'
  | 'audit'
  | 'audit_logs'
  | 'issues'
  | 'architecture';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'pending_approval' | 'disabled' | 'unauthenticated';

interface AppContextType {
  currentUser: User;
  allUsers: User[];
  setCurrentUser: (user: User) => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  // 身分驗證與帳號狀態
  authStatus: AuthStatus;
  isDemoSession: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithDemo: (username: string) => Promise<void>;
  logout: () => void;
  // 管理員專屬：帳號審核與指派
  adminUsers: User[];
  fetchAdminUsers: () => Promise<void>;
  approveUser: (userId: string, role: string, storeId?: string, storeName?: string) => Promise<void>;
  toggleUserStatus: (userId: string, status: 'ACTIVE' | 'DISABLED') => Promise<void>;
  // 儀表板點擊連動過濾條件
  customerFilterStatus: string | null;
  setCustomerFilterStatus: (status: string | null) => void;
  transactionFilterStage: string | null;
  setTransactionFilterStage: (stage: string | null) => void;
  // 資料層
  scopedData: ScopedDataState;
  loading: boolean;
  refreshData: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  // 連線狀態
  dbConnected: boolean;
  // 提示訊息
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  // 切換選單 (手機板)
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const allUsers = useMemo(() => repository.getUsers(), []);
  
  // 預設登入身分
  const [currentUser, setCurrentUser] = useState<User>(() => {
    return allUsers.find((u) => u.username === 'center_admin') || allUsers[0];
  });

  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [isDemoSession, setIsDemoSession] = useState<boolean>(true);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [customerFilterStatus, setCustomerFilterStatus] = useState<string | null>(null);
  const [transactionFilterStage, setTransactionFilterStage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [scopedData, setScopedData] = useState<ScopedDataState>(() => repository.getScopedData(currentUser));
  const [loading, setLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(true);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 從 Node.js MongoDB API 獲取資料
  const refreshData = useCallback(async () => {
    try {
      const data = await repository.fetchScopedData(currentUser);
      setScopedData(data);
      setDbConnected(true);
    } catch (err: any) {
      console.error('Failed to load data from backend:', err);
      if (err.status === 401 || err.code === 'USER_NOT_FOUND' || err.code === 'INVALID_SESSION') {
        apiClient.clearToken();
        try {
          const demoRes = await apiClient.authDemo(currentUser.username || 'center_admin');
          setCurrentUser(demoRes.user);
          setIsDemoSession(true);
          const data = await repository.fetchScopedData(demoRes.user);
          setScopedData(data);
          setDbConnected(true);
          return;
        } catch {}
      }
      setDbConnected(false);
      addToast({
        type: 'error',
        title: '無法同步 MongoDB 資料庫',
        message: err?.message || '後端伺服器或資料庫連線中斷',
      });
    }
  }, [currentUser, addToast]);

  // 管理者拉取系統用戶清單
  const fetchAdminUsers = useCallback(async () => {
    if (currentUser.role !== 'center_admin' || authStatus !== 'authenticated') return;
    try {
      const res = await apiClient.getAdminUsers();
      if (res && res.users) {
        setAdminUsers(res.users);
      } else if (Array.isArray(res)) {
        setAdminUsers(res);
      }
    } catch (err: any) {
      console.error('Failed to fetch admin users:', err);
    }
  }, [currentUser.role, authStatus]);

  // 開通審核用戶
  const approveUser = useCallback(async (userId: string, role: string, storeId?: string, storeName?: string) => {
    try {
      await apiClient.approveUser(userId, role, storeId, storeName);
      addToast({
        type: 'success',
        title: '審核成功',
        message: '已正式開通該帳號並指派所屬角色與門店。',
      });
      await fetchAdminUsers();
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '審核失敗',
        message: err?.message || '無法開通使用者',
      });
      throw err;
    }
  }, [addToast, fetchAdminUsers, refreshData]);

  // 啟用 / 停用用戶
  const toggleUserStatus = useCallback(async (userId: string, status: 'ACTIVE' | 'DISABLED') => {
    try {
      await apiClient.toggleUserStatus(userId, status);
      addToast({
        type: 'info',
        title: status === 'ACTIVE' ? '帳號已啟用' : '帳號已停用',
        message: `使用者狀態已更新為 ${status}。`,
      });
      await fetchAdminUsers();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '更新狀態失敗',
        message: err?.message || '無法更新使用者狀態',
      });
      throw err;
    }
  }, [addToast, fetchAdminUsers]);

  // 登入方法
  const loginWithGoogle = useCallback(async (credential: string) => {
    setLoading(true);
    try {
      const res = await apiClient.authWithGoogle(credential);
      setCurrentUser(res.user);
      setIsDemoSession(false);
      if (res.isPending || res.user.status === 'PENDING_APPROVAL') {
        setAuthStatus('pending_approval');
        addToast({
          type: 'warning',
          title: '帳號待開通審核',
          message: '您的 Google 帳號已建立，目前需由代銷中心管理員審核並指派門店角色。',
        });
      } else if (res.user.status === 'DISABLED') {
        setAuthStatus('disabled');
      } else {
        setAuthStatus('authenticated');
        addToast({
          type: 'success',
          title: 'Google 登入成功',
          message: `歡迎回來，${res.user.name}（${res.user.role === 'center_admin' ? '總部管理員' : res.user.storeName || '營業員'}）`,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Google 登入失敗',
        message: err?.message || '請確認 Google 憑證或稍後再試',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const loginWithDemo = useCallback(async (username: string) => {
    setLoading(true);
    try {
      const res = await apiClient.authDemo(username);
      setCurrentUser(res.user);
      setIsDemoSession(true);
      setAuthStatus('authenticated');
      addToast({
        type: 'info',
        title: '已切換示範身分',
        message: `目前以【${res.user.name}】（${res.user.title}）視角操作，所有變更隔離於示範空間。`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '示範登入失敗',
        message: err?.message || '無法切換示範身分',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const logout = useCallback(() => {
    apiClient.clearToken();
    loginWithDemo('center_admin');
    setActiveTab('dashboard');
  }, [loginWithDemo]);

  // 初始化檢查 Session Token
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const existingToken = apiClient.getToken();
      if (existingToken) {
        try {
          const res = await apiClient.getMe();
          if (!isMounted) return;
          setCurrentUser(res.user);
          setIsDemoSession(res.isDemo);
          if (res.user.status === 'PENDING_APPROVAL') {
            setAuthStatus('pending_approval');
          } else if (res.user.status === 'DISABLED') {
            setAuthStatus('disabled');
          } else {
            setAuthStatus('authenticated');
          }
          return;
        } catch {
          // Token expired or invalid, fallback to default demo
          apiClient.clearToken();
        }
      }

      // Default boot into demo admin
      try {
        const demoRes = await apiClient.authDemo('center_admin');
        if (!isMounted) return;
        setCurrentUser(demoRes.user);
        setIsDemoSession(true);
        setAuthStatus('authenticated');
      } catch (e) {
        console.error('Initial demo auth failed:', e);
        if (isMounted) setAuthStatus('authenticated');
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // 當切換使用者時自動重新獲取對應視野的資料
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return;
    }

    let isMounted = true;
    setLoading(true);
    repository
      .fetchScopedData(currentUser)
      .then((data) => {
        if (isMounted) {
          setScopedData(data);
          setDbConnected(true);
        }
      })
      .catch(async (err) => {
        if (!isMounted) return;
        console.error('fetchScopedData error:', err);
        // 若 Token 失效或找不到使用者，自動重新透過 demo center_admin 建立有效 Session
        if (err.status === 401 || err.code === 'USER_NOT_FOUND' || err.code === 'INVALID_SESSION') {
          apiClient.clearToken();
          try {
            const demoRes = await apiClient.authDemo(currentUser.username || 'center_admin');
            if (isMounted) {
              setCurrentUser(demoRes.user);
              setIsDemoSession(true);
              const data = await repository.fetchScopedData(demoRes.user);
              setScopedData(data);
              setDbConnected(true);
            }
            return;
          } catch (demoErr) {
            console.error('Recovery demo login failed:', demoErr);
          }
        }
        setDbConnected(false);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    if (currentUser.role === 'center_admin') {
      fetchAdminUsers();
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser, authStatus, fetchAdminUsers]);

  // 定期檢查 MongoDB 連線狀態
  useEffect(() => {
    apiClient
      .getHealth()
      .then(() => setDbConnected(true))
      .catch(() => setDbConnected(false));
  }, []);

  const resetDemoData = async () => {
    setLoading(true);
    try {
      await repository.resetToInitialMockData();
      await refreshData();
      addToast({
        type: 'success',
        title: 'MongoDB 資料庫已重設',
        message: '已透過後端 Node.js API 成功將 MongoDB 示範資料回復至初始狀態。',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: '重設資料失敗',
        message: err?.message || '無法清除並重設 MongoDB 資料',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        allUsers,
        setCurrentUser: (u) => {
          loginWithDemo(u.username);
        },
        activeTab,
        setActiveTab,
        authStatus,
        isDemoSession,
        loginWithGoogle,
        loginWithDemo,
        logout,
        adminUsers,
        fetchAdminUsers,
        approveUser,
        toggleUserStatus,
        customerFilterStatus,
        setCustomerFilterStatus,
        transactionFilterStage,
        setTransactionFilterStage,
        scopedData,
        loading,
        refreshData,
        resetDemoData,
        dbConnected,
        toasts,
        addToast,
        removeToast,
        mobileMenuOpen,
        setMobileMenuOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
