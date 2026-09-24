import React from 'react';
import {
  Layers,
  Database,
  ShieldCheck,
  Cpu,
  Lock,
  GitBranch,
  ArrowRight,
  Server,
  Key,
  Flame,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 標題與簡介 */}
      <div>
        <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider mb-1">
          <Layers className="w-4 h-4" />
          Technical Transition & Engineering Blueprint
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          太平洋房屋聯銷平台 · 第一階段試營運至正式生產架構演進規劃
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          本平台嚴格實踐領域驅動設計（Domain-Driven Design）與關注點分離（Separation of Concerns）。
          第一階段透過抽象化 Repository 模式將資料層與 UI 元件完全解耦，使系統未來可無縫切換為正式雲端後端與關聯式資料庫。
        </p>
      </div>

      {/* 兩階段架構對照表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phase 1: 試營運架構 */}
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-mono font-bold">
                  ACTIVE
                </span>
                全端 Node.js + MongoDB 架構
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                已連線運作中
              </span>
            </div>

            <ul className="space-y-3 text-xs text-slate-700">
              <li className="flex items-start gap-2.5">
                <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>實體資料庫連線：</strong>
                  連線至獨立 MongoDB Replica Set (<code>e8346c_dai_sho_t</code>)，長駐伺服器透過單一 <code>MongoClient</code> 連線池共用，強制 TLS 加密與閒置自動回收。
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Server className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <strong>後端 API 端點安全隔離：</strong>
                  所有資料庫存取一律封裝在 Node.js Express 後端 (<code>/api/*</code>)，前端絕對不直接接觸資料庫憑證或連線。
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <strong>角色視野與底價遮蔽：</strong>
                  後端 <code>/api/scoped-data</code> 根據使用者身分動態過濾案源、客戶與業績，底價對門店身分完全過濾剔除。
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <strong>不可篡改分佣快照：</strong>
                  客戶登記時於 MongoDB 寫入永久唯讀 <code>commission_snapshots</code>，完全不受後續建案分佣調整影響。
                </div>
              </li>
            </ul>
        </div>

        {/* Phase 2: 生產架構 */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-white text-base">
              <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-mono font-bold">
                PHASE 2
              </span>
              正式生產雲端架構 (Target)
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950 text-rose-300 border border-rose-800">
              工程遷移藍圖
            </span>
          </div>

          <ul className="space-y-3 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <Server className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">後端 REST / GraphQL API：</strong>
                採用 Node.js (NestJS / Express) 或 Go 微服務架構，搭配 PostgreSQL 或 Google Cloud SQL 關聯式資料庫。
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <Key className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">身分驗證與 JWT Token：</strong>
                整合企業 SSO / OAuth2，發行包含 <code>tenantId</code>、<code>storeId</code> 與 <code>role</code> 的簽章 Token，於 API Gateway 執行 RBAC 嚴格驗證。
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">資料庫交易與行級鎖 (Row-Level Locking)：</strong>
                客戶登記、重複判定、戶別保留與成交流程採用 <code>SELECT ... FOR UPDATE</code>，確保高併發下戶別狀態與分佣快照具備 ACID 強一致性。
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">行級安全 (RLS) 與底價欄位隔離：</strong>
                資料庫層設置 Row-Level Security，門店使用者連線無法透過任何 SQL 查閱 <code>bottom_price</code> 欄位，徹底防止機密洩漏。
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* 遷移路徑與技術規格清單 */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-rose-600" />
          正式生產化關鍵技術模組建議清單
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              1. 併發防護與分散式鎖
            </div>
            <p className="text-slate-600 leading-relaxed">
              當兩家門店業務同時登錄同組電話號碼或搶訂同戶別時，透過 Redis Redlock 或 PostgreSQL 資料庫悲觀鎖避免競態條件（Race Conditions）。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              2. 排程自動巡檢 (Cron Job)
            </div>
            <p className="text-slate-600 leading-relaxed">
              建立每日凌晨定時任務，自動檢查 <code>reservationExpiryDate</code> 與最後有效追蹤紀錄，對屆滿 30 天且無續期核准者自動變更為 <code>EXPIRED</code>。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              3. 推播與簡訊通知服務 (規劃中)
            </div>
            <p className="text-slate-600 leading-relaxed">
              規劃整合 LINE Messaging API 與 SMS 簡訊服務：到期前 7 天與 3 天自動向店長與業務發送預警；重複衝突與續期審核結果即時推播至承辦人手機。（目前為系統規劃階段，尚未完成正式串接前不啟用）
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              4. 審計法規存證 (規劃中)
            </div>
            <p className="text-slate-600 leading-relaxed">
              規劃將裁決紀錄、分佣鎖定與交易核准軌跡寫入「不可竄改日誌儲存體 (Write-Once-Read-Many, WORM)」，作為日後仲裁與分佣請款之法律佐證。（待法規合規與專屬存儲驗證）
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              5. 個資遮蔽與去識別化
            </div>
            <p className="text-slate-600 leading-relaxed">
              正式環境遵循個資法，手機號碼在前端預設以 <code>0912-***-567</code> 去識別化呈現，僅在經授權之承辦業務查看且記錄調閱 Log 後始得解密。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              6. 多租戶門店組織架構
            </div>
            <p className="text-slate-600 leading-relaxed">
              擴充加盟體系階層：總部 &gt; 區主管 &gt; 店東 &gt; 店長 &gt; 業務，支援門店間轉介拆佣及內部業績分成自訂比例公式。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
