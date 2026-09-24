import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/Toasts';

// Views
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { UnitsView } from './views/UnitsView';
import { StoresView } from './views/StoresView';
import { CustomersView } from './views/CustomersView';
import { ViewingsView } from './views/ViewingsView';
import { TransactionsView } from './views/TransactionsView';
import { CommissionView } from './views/CommissionView';
import { AuditLogsView } from './views/AuditLogsView';
import { ArchitectureView } from './views/ArchitectureView';
import { UsersView } from './views/UsersView';
import { IssuesView } from './views/IssuesView';
import { PendingApprovalView } from './components/PendingApprovalView';

// Modals
import { LoginModal } from './components/modals/LoginModal';
import { ReportIssueModal } from './components/modals/ReportIssueModal';
import { RegisterCustomerModal } from './components/modals/RegisterCustomerModal';
import { CustomerDetailModal } from './components/modals/CustomerDetailModal';
import { FollowUpModal } from './components/modals/FollowUpModal';
import { ViewingModal } from './components/modals/ViewingModal';
import { RenewalModal } from './components/modals/RenewalModal';
import { ReviewRenewalModal } from './components/modals/ReviewRenewalModal';
import { ResolveConflictModal } from './components/modals/ResolveConflictModal';
import { TransactionReportModal } from './components/modals/TransactionReportModal';
import { TransactionConfirmModal } from './components/modals/TransactionConfirmModal';
import { NewCommissionVersionModal } from './components/modals/NewCommissionVersionModal';
import { AssignStoreModal } from './components/modals/AssignStoreModal';
import { ResetDataModal } from './components/modals/ResetDataModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { NewUnitModal } from './components/modals/NewUnitModal';

// Types
import {
  CustomerRegistration,
  RenewalRequest,
  Transaction,
  Project,
  Viewing,
} from './types';

const MainAppContent: React.FC = () => {
  const { activeTab, authStatus } = useApp();

  // Modal States
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerProjectId, setRegisterProjectId] = useState<string | undefined>();

  const [selectedCustomerReg, setSelectedCustomerReg] = useState<CustomerRegistration | null>(null);

  const [followUpReg, setFollowUpReg] = useState<CustomerRegistration | null>(null);

  const [viewingReg, setViewingReg] = useState<CustomerRegistration | null>(null);
  const [editingViewing, setEditingViewing] = useState<Viewing | undefined>();
  const [isViewingModalOpen, setIsViewingModalOpen] = useState(false);

  const [renewalReg, setRenewalReg] = useState<CustomerRegistration | null>(null);

  const [reviewRenewalRequest, setReviewRenewalRequest] = useState<RenewalRequest | null>(null);

  const [conflictReg, setConflictReg] = useState<CustomerRegistration | null>(null);

  const [reportTxReg, setReportTxReg] = useState<CustomerRegistration | null>(null);

  const [confirmTx, setConfirmTx] = useState<Transaction | null>(null);

  const [isAssignStoreOpen, setIsAssignStoreOpen] = useState(false);
  const [assignStoreProject, setAssignStoreProject] = useState<Project | undefined>();

  const [commissionProject, setCommissionProject] = useState<Project | null>(null);

  const [isResetDataOpen, setIsResetDataOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isNewUnitOpen, setIsNewUnitOpen] = useState(false);
  const [newUnitProjectId, setNewUnitProjectId] = useState<string | undefined>();

  // Handlers
  const handleOpenRegister = (projectId?: string) => {
    setRegisterProjectId(projectId);
    setIsRegisterOpen(true);
  };

  const handleOpenViewingWithReg = (reg: CustomerRegistration) => {
    setViewingReg(reg);
    setEditingViewing(undefined);
    setIsViewingModalOpen(true);
  };

  const handleOpenViewingDirect = (viewing?: Viewing) => {
    setViewingReg(null);
    setEditingViewing(viewing);
    setIsViewingModalOpen(true);
  };

  const handleOpenAssignStore = (project?: Project) => {
    setAssignStoreProject(project);
    setIsAssignStoreOpen(true);
  };

  const handleOpenNewCommission = (project: Project) => {
    setCommissionProject(project);
  };

  const handleOpenNewUnit = (projectId?: string) => {
    setNewUnitProjectId(projectId);
    setIsNewUnitOpen(true);
  };

  if (authStatus === 'pending_approval') {
    return <PendingApprovalView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <Header
        onOpenRegisterModal={() => handleOpenRegister()}
        onOpenResetModal={() => setIsResetDataOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenReportModal={() => setIsReportIssueOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar onOpenRegisterModal={() => handleOpenRegister()} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto pb-16">
            {activeTab === 'dashboard' && (
              <DashboardView
                onOpenRegisterModal={() => handleOpenRegister()}
                onSelectCustomer={(reg) => setSelectedCustomerReg(reg)}
                onOpenResolveConflict={(reg) => setConflictReg(reg)}
                onOpenReviewRenewal={(req) => setReviewRenewalRequest(req)}
                onOpenConfirmTransaction={(tx) => setConfirmTx(tx)}
                onOpenNewProject={() => setIsNewProjectOpen(true)}
                onOpenNewUnit={() => handleOpenNewUnit()}
                onOpenAssignStore={() => handleOpenAssignStore()}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsView
                onOpenNewProject={() => setIsNewProjectOpen(true)}
                onOpenAssignStore={(p) => handleOpenAssignStore(p)}
                onOpenNewCommission={(p) => handleOpenNewCommission(p)}
                onOpenNewUnit={(pId) => handleOpenNewUnit(pId)}
                onOpenRegisterModal={(pId) => handleOpenRegister(pId)}
              />
            )}

            {activeTab === 'units' && (
              <UnitsView
                onOpenNewUnit={(pId) => handleOpenNewUnit(pId)}
                onOpenRegisterModal={(pId) => handleOpenRegister(pId)}
              />
            )}

            {(activeTab === 'stores' || (activeTab as string) === 'assignments') && (
              <StoresView onOpenAssignStore={(p) => handleOpenAssignStore(p)} />
            )}

            {activeTab === 'customers' && (
              <CustomersView
                onOpenRegisterModal={() => handleOpenRegister()}
                onSelectCustomer={(reg) => setSelectedCustomerReg(reg)}
                onOpenFollowUp={(reg) => setFollowUpReg(reg)}
                onOpenViewing={(reg) => handleOpenViewingWithReg(reg)}
                onOpenRenewal={(reg) => setRenewalReg(reg)}
                onOpenReportTransaction={(reg) => setReportTxReg(reg)}
                onOpenResolveConflict={(reg) => setConflictReg(reg)}
                onOpenReviewRenewal={(req) => setReviewRenewalRequest(req)}
              />
            )}

            {activeTab === 'viewings' && (
              <ViewingsView onOpenViewingModal={(v) => handleOpenViewingDirect(v)} />
            )}

            {activeTab === 'transactions' && (
              <TransactionsView onOpenConfirmModal={(tx) => setConfirmTx(tx)} />
            )}

            {activeTab === 'commission' && (
              <CommissionView onOpenNewCommission={(p) => handleOpenNewCommission(p)} />
            )}

            {activeTab === 'users' && <UsersView />}

            {(activeTab === 'audit' || (activeTab as string) === 'audit_logs') && <AuditLogsView />}

            {activeTab === 'issues' && (
              <IssuesView onOpenReportModal={() => setIsReportIssueOpen(true)} />
            )}

            {activeTab === 'architecture' && <ArchitectureView />}

            {/* 個人資料保護與隱私權規範法規遵循聲明 */}
            <div className="mt-12 p-4 rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                  <span className="font-bold text-rose-600">保</span>
                </span>
                <p>
                  <strong>個人資料保護與隱私權規範遵循公告：</strong>
                  本系統客戶資料均受中華民國《個人資料保護法》及太平洋房屋加盟聯銷競業協議嚴格保護。各加盟門店僅限檢視專屬保留案源與客戶，未經總部核可嚴禁越權調閱或洩漏。
                </p>
              </div>
              <div className="text-[11px] text-slate-400 shrink-0 font-medium">
                太平洋房屋代銷中心總部 · 資安控管版本 v2.4
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <ReportIssueModal
        isOpen={isReportIssueOpen}
        onClose={() => setIsReportIssueOpen(false)}
        onSuccess={() => {
          // 若在 issues 頁面，可由 View 自動或重新載入
        }}
      />

      <RegisterCustomerModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialProjectId={registerProjectId}
      />

      <CustomerDetailModal
        registration={selectedCustomerReg}
        onClose={() => setSelectedCustomerReg(null)}
        onOpenFollowUp={(reg) => setFollowUpReg(reg)}
        onOpenViewing={(reg) => handleOpenViewingWithReg(reg)}
        onOpenRenewal={(reg) => setRenewalReg(reg)}
        onOpenReportTransaction={(reg) => setReportTxReg(reg)}
      />

      <FollowUpModal
        isOpen={!!followUpReg}
        onClose={() => setFollowUpReg(null)}
        registration={followUpReg}
      />

      <ViewingModal
        isOpen={isViewingModalOpen}
        onClose={() => {
          setIsViewingModalOpen(false);
          setViewingReg(null);
          setEditingViewing(undefined);
        }}
        registration={viewingReg}
        existingViewing={editingViewing}
      />

      <RenewalModal
        isOpen={!!renewalReg}
        onClose={() => setRenewalReg(null)}
        registration={renewalReg}
      />

      <ReviewRenewalModal
        isOpen={!!reviewRenewalRequest}
        onClose={() => setReviewRenewalRequest(null)}
        request={reviewRenewalRequest}
      />

      <ResolveConflictModal
        isOpen={!!conflictReg}
        onClose={() => setConflictReg(null)}
        registration={conflictReg}
      />

      <TransactionReportModal
        isOpen={!!reportTxReg}
        onClose={() => setReportTxReg(null)}
        registration={reportTxReg}
      />

      <TransactionConfirmModal
        isOpen={!!confirmTx}
        onClose={() => setConfirmTx(null)}
        transaction={confirmTx}
      />

      <NewCommissionVersionModal
        isOpen={!!commissionProject}
        onClose={() => setCommissionProject(null)}
        project={commissionProject}
      />

      <AssignStoreModal
        isOpen={isAssignStoreOpen}
        onClose={() => {
          setIsAssignStoreOpen(false);
          setAssignStoreProject(undefined);
        }}
        project={assignStoreProject}
      />

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
      />

      <NewUnitModal
        isOpen={isNewUnitOpen}
        onClose={() => {
          setIsNewUnitOpen(false);
          setNewUnitProjectId(undefined);
        }}
        defaultProjectId={newUnitProjectId}
      />

      <ResetDataModal
        isOpen={isResetDataOpen}
        onClose={() => setIsResetDataOpen(false)}
      />

      {/* Global Toast Notifications */}
      <Toasts />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
