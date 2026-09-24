import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({ isOpen, onClose }) => {
  const { resetDemoData } = useApp();

  if (!isOpen) return null;

  const handleConfirm = () => {
    resetDemoData();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            確認重設示範資料庫？
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 text-sm text-slate-600 space-y-2.5">
          <p>
            此操作將清除後端 MongoDB 資料庫中的測試變更，並將資料集還原為初始試營運示範環境：
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-500">
            <li>包含 1 代銷中心、2 家示範加盟門店與 5 組角色帳號</li>
            <li>3 筆示範建案（敦南峰景、公園首馥、森活美墅）及 20 個可售/成交戶別</li>
            <li>完整包含 12+ 筆客戶登記（一般保留、7天內到期、已到期、重複爭議、申報成交與多版分佣快照）</li>
            <li>全數儲存於獨立 MongoDB Replica Set (<code>e8346c_dai_sho_t</code>)</li>
          </ul>
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium">
            提示：所有建立的測試紀錄將會被重置，請確認是否繼續執行。
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> 確認重設示範資料
          </button>
        </div>
      </div>
    </div>
  );
};
