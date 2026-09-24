import express, { Request, Response } from 'express';
import { getDb } from './db';
import { resetDatabase } from './seed';
import {
  normalizeContactPhone,
  calculateReservationStatus,
  calculateCommissionFromSnapshot,
  calculateNewExpiryDate,
  checkRenewalEligibility,
  canTransitionTransactionStage,
  formatDateTaipei,
} from '../rules';
import { User, Role, Store } from '../types';

export const apiRouter = express.Router();

// Helper to record audit logs
async function recordAudit(
  db: any,
  action: string,
  entityType: string,
  entityId: string,
  operator: User,
  details: string,
  storeId?: string
) {
  try {
    const log = {
      _id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      entityType,
      entityId,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      storeId: storeId || operator.storeId,
      details,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await db.collection('audit_logs').insertOne(log);
  } catch (e) {
    console.error('Audit log write error:', e);
  }
}

// 輔助函式：安全解析 Google JWT ID Token (免依賴肥大函式庫，支援完整 UTF-8 中文字元解碼)
function decodeGoogleJwt(jwtToken: string): { email: string; name: string; picture?: string; sub?: string } | null {
  try {
    const parts = jwtToken.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    // Node.js Buffer 原生支援完整 UTF-8 base64 解碼，避免瀏覽器端 decodeURIComponent 之 URIError: URI malformed
    let jsonPayload = '';
    try {
      jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
    } catch {
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonPayload);
    } catch {
      // 容錯機制：若 payload 曾被百分比編碼或特殊轉碼
      try {
        parsed = JSON.parse(decodeURIComponent(escape(Buffer.from(base64, 'base64').toString('binary'))));
      } catch {
        return null;
      }
    }

    if (!parsed || !parsed.email) return null;
    return {
      email: String(parsed.email).toLowerCase().trim(),
      name: parsed.name || String(parsed.email).split('@')[0],
      picture: parsed.picture,
      sub: parsed.sub,
    };
  } catch (err) {
    console.error('Failed to parse Google JWT:', err);
    return null;
  }
}

// 核心中介軟體：零信任驗證 Request 使用者與 Session 狀態
async function authenticateRequest(req: Request, res: Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    const db = await getDb();

    // 1. 若有傳入 Session Token，進行嚴格查詢與時效檢驗
    if (token) {
      const session = await db.collection('sessions').findOne({ token });
      if (!session) {
        return res.status(401).json({ error: '無效或已登出的工作階段，請重新登入', code: 'INVALID_SESSION' });
      }

      if (new Date(session.expiresAt) < new Date()) {
        await db.collection('sessions').deleteOne({ token });
        return res.status(401).json({ error: '登入已過期，請重新登入', code: 'SESSION_EXPIRED' });
      }

      let user = await db.collection('users').findOne({
        $or: [
          { id: session.userId },
          { _id: session.userId as any },
          { username: session.username },
          { email: session.email },
        ].filter(Boolean),
      });

      if (!user) {
        await db.collection('sessions').deleteOne({ token });
        const fallbackUsername = (req.query.username as string) || session.username;
        if (fallbackUsername) {
          user = await db.collection('users').findOne({ username: fallbackUsername });
        }
      }

      if (!user) {
        return res.status(401).json({ error: '找不到對應的使用者帳號，請重新登入', code: 'USER_NOT_FOUND' });
      }

      if (user.status === 'DISABLED') {
        return res.status(403).json({ error: '您的帳號已被停用，請洽詢代銷中心管理員', code: 'ACCOUNT_DISABLED' });
      }

      (req as any).user = { ...user, id: user.id || user._id };
      (req as any).session = session;
      return next();
    }

    // 2. 示範切換相容支援（若傳入 username 則查詢示範使用者）
    const username = req.query.username as string;
    if (username) {
      const user = await db.collection('users').findOne({ username });
      if (user) {
        if (user.status === 'DISABLED') {
          return res.status(403).json({ error: '您的帳號已被停用，請洽詢代銷中心管理員', code: 'ACCOUNT_DISABLED' });
        }
        (req as any).user = { ...user, id: user.id || user._id };
        (req as any).session = { isDemo: user.isDemo === true };
        return next();
      }
    }

    return res.status(401).json({ error: '請先登入系統以存取聯銷資料', code: 'UNAUTHORIZED' });
  } catch (err: any) {
    console.error('Auth middleware error:', err?.message || err);
    res.status(500).json({ error: '驗證使用者身份發生錯誤' });
  }
}

// 權限中介軟體：僅限代銷中心總部主管
function requireCenterAdmin(req: Request, res: Response, next: express.NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== 'center_admin') {
    return res.status(403).json({ error: '權限不足：僅代銷中心總部可執行此操作' });
  }
  next();
}

// 權限中介軟體：僅限已開通審核的正式帳號，且所屬門店非停用狀態
async function requireActiveUser(req: Request, res: Response, next: express.NextFunction) {
  const user = (req as any).user;
  if (!user || user.status !== 'ACTIVE') {
    return res.status(403).json({ error: '您的帳號尚未開通審核，暫無法執行業務操作' });
  }
  if (user.role !== 'center_admin' && user.storeId) {
    try {
      const db = await getDb();
      const store = await db.collection('stores').findOne({
        $or: [{ id: user.storeId }, { _id: user.storeId }]
      });
      if (store && (store.status === 'DISABLED' || store.status === 'INACTIVE')) {
        return res.status(403).json({ error: `您所屬的門店 [${store.name}] 目前已被停用，停用期間不得新增銷售作業` });
      }
    } catch {
      // ignore
    }
  }
  next();
}

// 1. Health & Connection Status
apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const stats = await db.command({ ping: 1 });
    res.json({
      status: 'ok',
      database: 'e8346c_dai_sho_t',
      ping: stats.ok === 1,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('MongoDB health check failed:', err?.message || err);
    res.status(500).json({ error: '無法連線至 MongoDB 資料庫，請檢查連線設定' });
  }
});

// ==================== 身份驗證與帳號管理 API ====================

// 2.1 Google 登入 (支援 Google ID Token 憑證 或 受控信箱驗證)
apiRouter.post('/auth/google', async (req: Request, res: Response) => {
  try {
    const { credential, email: directEmail, name: directName } = req.body;
    let email = '';
    let name = '';
    let picture = '';

    if (credential) {
      const decoded = decodeGoogleJwt(credential);
      if (!decoded) {
        return res.status(400).json({ error: '無效的 Google 登入憑證' });
      }
      email = decoded.email;
      name = decoded.name;
      picture = decoded.picture || '';
    } else if (directEmail) {
      email = directEmail.toLowerCase().trim();
      name = directName || email.split('@')[0];
    } else {
      return res.status(400).json({ error: '未提供 Google 登入資訊或憑證' });
    }

    const db = await getDb();
    const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'chlorain@gmail.com').toLowerCase().trim();
    const isMasterAdmin = email === initialAdminEmail;

    let user = await db.collection('users').findOne({
      $or: [{ email }, { boundEmail: email }, { username: email }],
    });
    const now = new Date().toISOString();

    if (!user) {
      // 規則：新使用者預設為待開通，不能讀取業務資料；首位中心管理員由後端環境變數初始化鎖定
      const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      user = {
        _id: userId as any,
        id: userId,
        username: email,
        email,
        name: name || email.split('@')[0],
        role: isMasterAdmin ? 'center_admin' : 'agent',
        storeId: '',
        storeName: isMasterAdmin ? '代銷中心總部' : '待指派門店',
        title: isMasterAdmin ? '代銷中心 總管理者' : '新進同仁（待開通審核）',
        phone: '',
        status: isMasterAdmin ? 'ACTIVE' : 'PENDING_APPROVAL',
        isDemo: false,
        authProvider: 'google',
        boundEmail: email,
        isBound: true,
        picture,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('users').insertOne(user);

      await recordAudit(
        db,
        'REGISTER_GOOGLE_USER',
        'User',
        userId,
        user as any,
        `使用者透過 Google 帳號 [${email}] 初次登入系統，狀態：${user.status}`
      );
    } else {
      if (user.status === 'DISABLED') {
        return res.status(403).json({ error: '此帳號已被代銷中心停用，無法登入系統', code: 'ACCOUNT_DISABLED' });
      }

      // 若為預建人員 (PENDING_BINDING)，登入時自動綁定該 Google 帳號，並將狀態推進為待開通 PENDING_APPROVAL
      const updates: any = {
        boundEmail: email,
        authProvider: 'google',
        isBound: true,
        updatedAt: now,
      };
      if (picture && !user.picture) updates.picture = picture;

      if (user.status === 'PENDING_BINDING') {
        updates.status = 'PENDING_APPROVAL';
        user.status = 'PENDING_APPROVAL';
      }

      // 若為環境變數指定的首位中心管理員，確保其權限與狀態正確
      if (isMasterAdmin && (user.role !== 'center_admin' || user.status !== 'ACTIVE')) {
        updates.role = 'center_admin';
        updates.status = 'ACTIVE';
        user.role = 'center_admin';
        user.status = 'ACTIVE';
      }

      await db.collection('users').updateOne({ _id: user._id }, { $set: updates });
      Object.assign(user, updates);
    }

    // 發行 7 天效期之工作階段 Token
    const sessionToken = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.collection('sessions').insertOne({
      token: sessionToken,
      userId: user.id || user._id,
      username: user.username || user.email,
      email: user.email,
      role: user.role,
      storeId: user.storeId || '',
      status: user.status,
      isDemo: user.isDemo === true,
      createdAt: now,
      expiresAt,
    });

    const { _id, ...cleanUser } = user as any;
    const userResponse = { ...cleanUser, id: user.id || user._id };

    res.json({
      success: true,
      token: sessionToken,
      user: userResponse,
      expiresAt,
      isPending: user.status === 'PENDING_APPROVAL',
    });
  } catch (err: any) {
    console.error('POST /auth/google error:', err?.message || err);
    res.status(500).json({ error: 'Google 登入處理失敗' });
  }
});

// 2.2 示範帳號快速切換登入（發行隔離之示範工作階段）
apiRouter.post('/auth/demo-login', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: '請提供欲切換之示範使用者帳號' });
    }

    const db = await getDb();
    const user: any = await db.collection('users').findOne({ username });

    if (!user) {
      return res.status(404).json({ error: '找不到指定示範帳號' });
    }

    if (user.status === 'DISABLED') {
      return res.status(403).json({ error: '此示範帳號已被停用', code: 'ACCOUNT_DISABLED' });
    }

    const now = new Date().toISOString();
    const sessionToken = `ses_demo_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.collection('sessions').insertOne({
      token: sessionToken,
      userId: user.id || user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      storeId: user.storeId || '',
      status: user.status || 'ACTIVE',
      isDemo: true, // 嚴格標記為示範 Session，隔絕正式資料
      createdAt: now,
      expiresAt,
    });

    const { _id, ...cleanDemoUser } = user;
    const userResponse = { ...cleanDemoUser, id: user.id || user._id };

    res.json({
      success: true,
      token: sessionToken,
      user: userResponse,
      expiresAt,
      isPending: false,
    });
  } catch (err: any) {
    console.error('POST /auth/demo-login error:', err?.message || err);
    res.status(500).json({ error: '示範帳號登入失敗' });
  }
});

// 2.3 檢查當前登入者資訊
apiRouter.get('/auth/me', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const session = (req as any).session;
    res.json({
      user: currentUser,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
        isDemo: session.isDemo === true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: '取得登入資訊失敗' });
  }
});

// 2.4 登出系統
apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const db = await getDb();
      await db.collection('sessions').deleteMany({ token });
    }
    res.json({ success: true, message: '已成功登出工作階段' });
  } catch (err: any) {
    res.status(500).json({ error: '登出失敗' });
  }
});

// 2.5 代銷中心管理員：查詢所有使用者清單（含開通狀態）
apiRouter.get('/admin/users', authenticateRequest, requireCenterAdmin, async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray();
    const formatted = users.map(({ _id, ...u }: any) => ({ ...u, id: u.id || _id }));
    res.json({ success: true, users: formatted });
  } catch (err: any) {
    res.status(500).json({ error: '取得使用者管理列表失敗' });
  }
});

const handleApproveUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role, storeId, storeName, title, phone } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    const user = await db.collection('users').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!user) {
      return res.status(404).json({ error: '找不到待開通的使用者' });
    }

    const updates: any = {
      status: 'ACTIVE',
      role: role || user.role,
      storeId: storeId !== undefined ? storeId : user.storeId,
      storeName: storeName !== undefined ? storeName : user.storeName,
      title: title || user.title,
      phone: phone || user.phone,
      approvedBy: operator.name,
      approvedAt: now,
      updatedAt: now,
    };

    await db.collection('users').updateOne({ _id: user._id }, { $set: updates });

    await recordAudit(
      db,
      'APPROVE_USER_ACCOUNT',
      'User',
      id,
      operator,
      `代銷中心主管核准開通帳號 [${user.name} (${user.email})]，指派角色：${updates.role}，門店：${updates.storeName || '代銷中心'}`
    );

    res.json({ success: true, message: '帳號已成功核准開通' });
  } catch (err: any) {
    res.status(500).json({ error: '開通帳號失敗' });
  }
};

// 2.6 代銷中心管理員：核准開通帳號並指派角色與門店 (支援 PUT 與 POST)
apiRouter.put('/admin/users/:id/approve', authenticateRequest, requireCenterAdmin, handleApproveUser);
apiRouter.post('/admin/users/:id/approve', authenticateRequest, requireCenterAdmin, handleApproveUser);

const handleUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason, handoverUserId } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    const user = await db.collection('users').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!user) {
      return res.status(404).json({ error: '找不到使用者' });
    }

    // 若欲停用人員，檢查其未完成的客戶登記與交易
    if (status === 'DISABLED') {
      const [activeRegs, activeTxs] = await Promise.all([
        db.collection('registrations').find({ agentId: id, status: 'ACTIVE' }).toArray(),
        db.collection('transactions').find({
          agentId: id,
          stage: { $nin: ['DEAL_CONFIRMED', 'CANCELLED'] },
        }).toArray(),
      ]);

      if (handoverUserId) {
        const handoverUser = await db.collection('users').findOne({
          $or: [{ id: handoverUserId }, { _id: handoverUserId as any }],
          storeId: user.storeId,
          status: 'ACTIVE',
        });
        if (!handoverUser) {
          return res.status(400).json({ error: '指定的交接同仁不存在、非本店同仁或帳號未啟用' });
        }

        // 批次交接客戶登記 (保留原門店 storeId)
        if (activeRegs.length > 0) {
          await db.collection('registrations').updateMany(
            { agentId: id, status: 'ACTIVE' },
            { $set: { agentId: handoverUser.id || handoverUser._id, agentName: handoverUser.name, updatedAt: now } }
          );
        }

        // 批次交接進行中交易 (保留原門店 storeId)
        if (activeTxs.length > 0) {
          await db.collection('transactions').updateMany(
            { agentId: id, stage: { $nin: ['DEAL_CONFIRMED', 'CANCELLED'] } },
            { $set: { agentId: handoverUser.id || handoverUser._id, updatedAt: now } }
          );
        }

        await recordAudit(
          db,
          'HANDOVER_USER_WORK',
          'PERSONNEL',
          id,
          operator,
          `同仁 [${user.name}] 停用前已將 ${activeRegs.length} 筆客戶登記與 ${activeTxs.length} 筆進行中交易交接給 [${handoverUser.name}]`
        );
      }
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { status, updatedAt: now } }
    );

    // 若為停用，強制吊銷該使用者之所有現存 Session，使其下一次請求立即被拒絕
    if (status === 'DISABLED') {
      await db.collection('sessions').deleteMany({
        $or: [{ userId: id }, { userId: user.id }, { username: user.username }, { email: user.email }],
      });
    }

    await recordAudit(
      db,
      status === 'DISABLED' ? 'DISABLE_USER' : 'ENABLE_USER',
      'PERSONNEL',
      id,
      operator,
      `代銷中心主管${status === 'DISABLED' ? '停用' : '啟用'}帳號 [${user.name}]${reason ? `，原因：${reason}` : ''}`
    );

    res.json({ success: true, message: `帳號已${status === 'DISABLED' ? '停用' : '啟用'}` });
  } catch (err: any) {
    console.error('handleUserStatus error:', err);
    res.status(500).json({ error: '變更狀態失敗' });
  }
};

// 2.7 代銷中心管理員：停用或重新啟用帳號 (支援 PUT 與 POST)
apiRouter.put('/admin/users/:id/status', authenticateRequest, requireCenterAdmin, handleUserStatus);
apiRouter.post('/admin/users/:id/status', authenticateRequest, requireCenterAdmin, handleUserStatus);

// 2.8 代銷中心管理員：編輯使用者資訊與職稱
apiRouter.put('/admin/users/:id', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, storeId, storeName, title, phone, lineId, email } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    const user = await db.collection('users').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!user) {
      return res.status(404).json({ error: '找不到指定使用者' });
    }

    const updates: any = {
      name: name ? name.trim() : user.name,
      role: role || user.role,
      storeId: storeId !== undefined ? storeId : user.storeId,
      storeName: storeName !== undefined ? storeName : user.storeName,
      title: title !== undefined ? title : user.title,
      phone: phone !== undefined ? phone.trim() : user.phone,
      lineId: lineId !== undefined ? lineId.trim() : user.lineId,
      updatedAt: now,
    };

    if (email && email.trim() !== user.email) {
      const cleanEmail = email.toLowerCase().trim();
      const duplicate = await db.collection('users').findOne({
        _id: { $ne: user._id },
        email: cleanEmail,
        status: { $ne: 'DISABLED' },
      });
      if (duplicate) {
        return res.status(400).json({ error: `電子郵件 [${cleanEmail}] 已被其他有效人員使用` });
      }
      updates.email = cleanEmail;
    }

    await db.collection('users').updateOne({ _id: user._id }, { $set: updates });

    await recordAudit(
      db,
      'UPDATE_USER_PERMISSIONS',
      'PERSONNEL',
      id,
      operator,
      `更新同仁 [${user.name}] 資料，角色：[${updates.role}]，門店：[${updates.storeName || '無'}]`
    );

    res.json({ success: true, message: '同仁資料已更新' });
  } catch (err: any) {
    res.status(500).json({ error: '更新使用者資訊失敗' });
  }
});

// 2.8.1 代銷中心管理員：新增人員 (中心端建立，預設待綁定或待開通)
apiRouter.post('/users', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { name, storeId, role, phone, email, lineId, title, status } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '同仁姓名為必填欄位' });
    }
    if (!storeId) {
      return res.status(400).json({ error: '所屬門店為必選欄位' });
    }
    if (!role || !['store_manager', 'agent'].includes(role)) {
      return res.status(400).json({ error: '請指定正確的角色（店長或業務）' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: '聯絡電話為必填欄位' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: '電子郵件為必填欄位' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await db.collection('users').findOne({
      email: cleanEmail,
      status: { $ne: 'DISABLED' },
    });
    if (existingUser) {
      return res.status(400).json({ error: `電子郵件 [${cleanEmail}] 已被其他同仁 (${existingUser.name}) 使用` });
    }

    const store = await db.collection('stores').findOne({
      $or: [{ id: storeId }, { _id: storeId as any }],
    });
    if (!store) {
      return res.status(400).json({ error: '指定的所屬門店不存在' });
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const userRole = role as Role;
    const defaultTitle = title?.trim() || (userRole === 'store_manager' ? `${store.name} 店長` : `${store.name} 業務顧問`);
    const initialStatus = status || 'PENDING_BINDING';

    const newUser: User = {
      id: userId,
      username: cleanEmail,
      email: cleanEmail,
      name: name.trim(),
      role: userRole,
      storeId: store.id || store._id,
      storeName: store.name,
      title: defaultTitle,
      phone: phone.trim(),
      lineId: lineId?.trim() || '',
      status: initialStatus,
      isDemo: operator.isDemo === true,
      authProvider: 'none',
      isBound: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('users').insertOne({ ...newUser, _id: userId as any });

    // 若角色為店長且門店未指定店長，自動更新門店之現任店長資訊
    if (userRole === 'store_manager' && (!store.managerName || store.managerName === '待指派店長')) {
      await db.collection('stores').updateOne(
        { _id: store._id },
        { $set: { managerName: newUser.name, managerId: userId, updatedAt: now } }
      );
    }

    await recordAudit(
      db,
      'CREATE_USER',
      'PERSONNEL',
      userId,
      operator,
      `代銷中心新增門店同仁 [${newUser.name}]，門店：[${store.name}]，角色：[${newUser.role === 'store_manager' ? '店長' : '業務'}]，狀態：${initialStatus}`
    );

    res.json({ success: true, user: newUser });
  } catch (err: any) {
    console.error('POST /users error:', err);
    res.status(500).json({ error: '新增人員失敗' });
  }
});

// 2.8.2 代銷中心管理員：綁定 Google 登入帳號
apiRouter.put('/users/:id/bind-account', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { boundEmail } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    if (!boundEmail || !boundEmail.trim()) {
      return res.status(400).json({ error: '欲綁定之 Google 電子信箱為必填' });
    }

    const cleanEmail = boundEmail.toLowerCase().trim();
    const user = await db.collection('users').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!user) {
      return res.status(404).json({ error: '找不到指定人員' });
    }

    // 檢查是否有其他有效同仁綁定相同信箱
    const otherUser = await db.collection('users').findOne({
      _id: { $ne: user._id },
      $or: [{ boundEmail: cleanEmail }, { email: cleanEmail }],
      status: { $ne: 'DISABLED' },
    });
    if (otherUser) {
      return res.status(400).json({ error: `該 Google 帳號已綁定至其他有效人員 (${otherUser.name})，不可重複綁定` });
    }

    const updates: any = {
      boundEmail: cleanEmail,
      authProvider: 'google',
      isBound: true,
      updatedAt: now,
    };

    if (user.status === 'PENDING_BINDING') {
      updates.status = 'PENDING_APPROVAL';
    }

    await db.collection('users').updateOne({ _id: user._id }, { $set: updates });

    await recordAudit(
      db,
      'BIND_USER_ACCOUNT',
      'PERSONNEL',
      id,
      operator,
      `代銷中心為同仁 [${user.name}] 綁定 Google 登入帳號 [${cleanEmail}]`
    );

    res.json({ success: true, message: '已成功綁定登入帳號' });
  } catch (err: any) {
    res.status(500).json({ error: '綁定帳號失敗' });
  }
});

// 2.8.3 代銷中心管理員：人員調店
apiRouter.post('/users/:id/transfer-store', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetStoreId, reason, handoverUserId } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    if (!targetStoreId) {
      return res.status(400).json({ error: '請選擇目標門店' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: '調店原因為必填欄位' });
    }

    const user = await db.collection('users').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!user) {
      return res.status(404).json({ error: '找不到指定同仁' });
    }

    if (user.storeId === targetStoreId) {
      return res.status(400).json({ error: '目標門店不得與目前所屬門店相同' });
    }

    const targetStore = await db.collection('stores').findOne({
      $or: [{ id: targetStoreId }, { _id: targetStoreId as any }],
    });
    if (!targetStore) {
      return res.status(404).json({ error: '目標門店不存在' });
    }
    if (targetStore.status === 'DISABLED' || targetStore.status === 'INACTIVE') {
      return res.status(400).json({ error: '目標門店已被停用，無法調入人員' });
    }

    // 檢查原門店未完成業務（有效客戶登記、未結案交易）
    const [activeRegs, activeTxs] = await Promise.all([
      db.collection('registrations').find({ agentId: id, status: 'ACTIVE' }).toArray(),
      db.collection('transactions').find({
        agentId: id,
        stage: { $nin: ['DEAL_CONFIRMED', 'CANCELLED'] },
      }).toArray(),
    ]);

    if (activeRegs.length > 0 || activeTxs.length > 0) {
      if (!handoverUserId) {
        return res.status(400).json({
          error: `該同仁在原門店尚有進行中業務（${activeRegs.length} 筆客戶登記、${activeTxs.length} 筆進行中交易），需先指定原門店同仁完成交接後方可調店`,
          requiresHandover: true,
          pendingRegistrations: activeRegs.length,
          pendingTransactions: activeTxs.length,
        });
      }

      const handoverUser = await db.collection('users').findOne({
        $or: [{ id: handoverUserId }, { _id: handoverUserId as any }],
        storeId: user.storeId,
        status: 'ACTIVE',
      });
      if (!handoverUser) {
        return res.status(400).json({ error: '指定的交接同仁不存在、非原門店同仁或帳號未啟用' });
      }

      // 執行業務交接：更新經辦人，保留原門店 storeId 歷史歸屬
      if (activeRegs.length > 0) {
        await db.collection('registrations').updateMany(
          { agentId: id, status: 'ACTIVE' },
          { $set: { agentId: handoverUser.id || handoverUser._id, agentName: handoverUser.name, updatedAt: now } }
        );
      }
      if (activeTxs.length > 0) {
        await db.collection('transactions').updateMany(
          { agentId: id, stage: { $nin: ['DEAL_CONFIRMED', 'CANCELLED'] } },
          { $set: { agentId: handoverUser.id || handoverUser._id, updatedAt: now } }
        );
      }

      await recordAudit(
        db,
        'HANDOVER_USER_WORK',
        'PERSONNEL',
        id,
        operator,
        `同仁 [${user.name}] 調店前已將原門店業務（${activeRegs.length} 筆登記、${activeTxs.length} 筆交易）交接予 [${handoverUser.name}]`
      );
    }

    const previousStoreName = user.storeName || '原門店';
    const newTitle = user.role === 'store_manager' ? `${targetStore.name} 店長` : `${targetStore.name} 業務顧問`;

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          storeId: targetStore.id || targetStore._id,
          storeName: targetStore.name,
          title: newTitle,
          updatedAt: now,
        },
      }
    );

    await recordAudit(
      db,
      'TRANSFER_USER_STORE',
      'PERSONNEL',
      id,
      operator,
      `同仁 [${user.name}] 由 [${previousStoreName}] 調動至 [${targetStore.name}]，調店原因：${reason.trim()}`
    );

    res.json({ success: true, message: `同仁已成功調動至 ${targetStore.name}` });
  } catch (err: any) {
    console.error('POST /users/:id/transfer-store error:', err);
    res.status(500).json({ error: '調店作業失敗' });
  }
});

// 2.8.4 代銷中心管理員：安全刪除人員
apiRouter.delete('/users/:id', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operator = (req as any).user;
    const db = await getDb();

    const user = await db.collection('users').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!user) {
      return res.status(404).json({ error: '找不到指定人員' });
    }

    // 檢查是否有歷史業務關聯
    const [regCount, txCount, viewingCount] = await Promise.all([
      db.collection('registrations').countDocuments({ agentId: id }),
      db.collection('transactions').countDocuments({ agentId: id }),
      db.collection('viewings').countDocuments({ agentId: id }),
    ]);

    if (regCount > 0 || txCount > 0 || viewingCount > 0) {
      return res.status(400).json({
        error: `該同仁已有歷史業務紀錄（${regCount} 筆登記、${txCount} 筆交易、${viewingCount} 筆帶看），為維持合規與歷史追溯，僅可執行停用，不可刪除`,
      });
    }

    await db.collection('users').deleteOne({ _id: user._id });
    await db.collection('sessions').deleteMany({
      $or: [{ userId: id }, { userId: user.id }, { username: user.username }],
    });

    await recordAudit(
      db,
      'DELETE_USER',
      'PERSONNEL',
      id,
      operator,
      `代銷中心刪除無任何業務紀錄之同仁 [${user.name}]`
    );

    res.json({ success: true, message: '同仁資料已刪除' });
  } catch (err: any) {
    res.status(500).json({ error: '刪除人員失敗' });
  }
});

// 2.9 門店管理：查詢門店清單 (支援搜尋、篩選與動態統計)
apiRouter.get('/stores', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const db = await getDb();
    const { q, status, city } = req.query as { q?: string; status?: string; city?: string };

    if (user.status === 'PENDING_APPROVAL' || user.status === 'PENDING_BINDING') {
      return res.json([]);
    }

    let filter: any = {};
    if (user.role !== 'center_admin') {
      filter = { $or: [{ id: user.storeId }, { _id: user.storeId }] };
    } else {
      if (status && status !== 'ALL') {
        filter.status = status;
      }
      if (city && city !== 'ALL') {
        filter.city = city;
      }
      if (q && q.trim()) {
        const regex = new RegExp(q.trim(), 'i');
        filter.$or = [{ name: regex }, { code: regex }, { address: regex }];
      }
    }

    const rawStores = await db.collection('stores').find(filter).sort({ createdAt: -1 }).toArray();

    // 動態計算各門店之人數與建案指標
    const enriched = await Promise.all(
      rawStores.map(async (store: any) => {
        const storeId = store.id || store._id;
        const [totalPersonnel, activeManagers, activeAgents, totalProjects] = await Promise.all([
          db.collection('users').countDocuments({ storeId }),
          db.collection('users').countDocuments({ storeId, role: 'store_manager', status: 'ACTIVE' }),
          db.collection('users').countDocuments({ storeId, role: 'agent', status: 'ACTIVE' }),
          db.collection('assignments').countDocuments({ storeId, status: 'ACTIVE' }),
        ]);

        const formatted: any = {
          ...store,
          id: storeId,
          totalPersonnel,
          activeManagers,
          activeAgents,
          totalProjects,
        };
        delete formatted._id;

        // 非代銷中心角色徹底剝除 internalNotes
        if (user.role !== 'center_admin') {
          delete formatted.internalNotes;
        }

        return formatted;
      })
    );

    res.json(enriched);
  } catch (err: any) {
    console.error('GET /stores error:', err);
    res.status(500).json({ error: '取得門店清單失敗' });
  }
});

// 2.9.1 門店管理：查詢門店詳情與所屬人員
apiRouter.get('/stores/:id', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const db = await getDb();

    if (user.role !== 'center_admin' && user.storeId !== id) {
      return res.status(403).json({ error: '權限不足：僅可檢視所屬門店之詳情' });
    }

    const store = await db.collection('stores').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!store) {
      return res.status(404).json({ error: '找不到指定門店' });
    }

    const storeId = store.id || store._id;
    const [totalPersonnel, activeManagers, activeAgents, totalProjects, rawUsers] = await Promise.all([
      db.collection('users').countDocuments({ storeId }),
      db.collection('users').countDocuments({ storeId, role: 'store_manager', status: 'ACTIVE' }),
      db.collection('users').countDocuments({ storeId, role: 'agent', status: 'ACTIVE' }),
      db.collection('assignments').countDocuments({ storeId, status: 'ACTIVE' }),
      db.collection('users').find({ storeId }).sort({ role: 1, createdAt: 1 }).toArray(),
    ]);

    const formattedStore: any = {
      ...store,
      id: storeId,
      totalPersonnel,
      activeManagers,
      activeAgents,
      totalProjects,
    };
    delete formattedStore._id;

    if (user.role !== 'center_admin') {
      delete formattedStore.internalNotes;
    }

    const personnel = rawUsers.map(({ _id, ...u }: any) => {
      const p: any = { ...u, id: u.id || _id };
      if (user.role !== 'center_admin') {
        delete p.authUid;
        delete p.internalNotes;
      }
      return p;
    });

    res.json({ success: true, store: formattedStore, personnel });
  } catch (err: any) {
    console.error('GET /stores/:id error:', err);
    res.status(500).json({ error: '取得門店詳情失敗' });
  }
});

// 2.9.2 代銷中心管理員：新增加盟門店
apiRouter.post('/stores', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name,
      code,
      companyName,
      taxId,
      city,
      district,
      address,
      phone,
      contactPerson,
      contactPhone,
      contactEmail,
      managerName,
      serviceAreas,
      specialties,
      internalNotes,
      status,
    } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    if (!name || !name.trim()) {
      return res.status(400).json({ error: '門店名稱為必填欄位' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ error: '門店代碼為必填且唯一' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await db.collection('stores').findOne({
      $or: [
        { code: cleanCode },
        { code: { $regex: new RegExp(`^${cleanCode.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') } }
      ]
    });
    if (existing) {
      return res.status(400).json({ error: `門店代碼 [${cleanCode}] 已存在，請使用不同代碼` });
    }

    const storeId = `store_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newStore: Store = {
      id: storeId,
      name: name.trim(),
      code: cleanCode,
      companyName: companyName?.trim() || '',
      taxId: taxId?.trim() || '',
      city: city?.trim() || '',
      district: district?.trim() || '',
      address: address?.trim() || '',
      phone: phone?.trim() || '',
      contactPerson: contactPerson?.trim() || '',
      contactPhone: contactPhone?.trim() || '',
      contactEmail: contactEmail?.trim() || '',
      managerName: managerName?.trim() || '待指派店長',
      serviceAreas: Array.isArray(serviceAreas) ? serviceAreas : [],
      specialties: Array.isArray(specialties) ? specialties : [],
      internalNotes: internalNotes?.trim() || '',
      status: status || 'ACTIVE',
      isDemo: operator.isDemo === true,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('stores').insertOne({ ...newStore, _id: storeId as any });

    await recordAudit(
      db,
      'CREATE_STORE',
      'STORE',
      storeId,
      operator,
      `代銷中心新增加盟門店 [${newStore.name}] (代碼: ${cleanCode})，狀態：${newStore.status}`
    );

    res.json({ success: true, store: newStore });
  } catch (err: any) {
    console.error('POST /stores error:', err);
    res.status(500).json({ error: '建立門店失敗' });
  }
});

// 2.9.3 代銷中心管理員：編輯門店資料
apiRouter.put('/stores/:id', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      companyName,
      taxId,
      city,
      district,
      address,
      phone,
      contactPerson,
      contactPhone,
      contactEmail,
      managerName,
      serviceAreas,
      specialties,
      internalNotes,
    } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    const store = await db.collection('stores').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!store) {
      return res.status(404).json({ error: '找不到指定門店' });
    }

    let cleanCode = store.code;
    if (code && code.trim().toUpperCase() !== store.code) {
      cleanCode = code.trim().toUpperCase();
      const duplicate = await db.collection('stores').findOne({
        _id: { $ne: store._id },
        code: cleanCode,
      });
      if (duplicate) {
        return res.status(400).json({ error: `門店代碼 [${cleanCode}] 已被使用，請更換代碼` });
      }
    }

    const updates: any = {
      name: name ? name.trim() : store.name,
      code: cleanCode,
      companyName: companyName !== undefined ? companyName.trim() : store.companyName,
      taxId: taxId !== undefined ? taxId.trim() : store.taxId,
      city: city !== undefined ? city.trim() : store.city,
      district: district !== undefined ? district.trim() : store.district,
      address: address !== undefined ? address.trim() : store.address,
      phone: phone !== undefined ? phone.trim() : store.phone,
      contactPerson: contactPerson !== undefined ? contactPerson.trim() : store.contactPerson,
      contactPhone: contactPhone !== undefined ? contactPhone.trim() : store.contactPhone,
      contactEmail: contactEmail !== undefined ? contactEmail.trim() : store.contactEmail,
      managerName: managerName !== undefined ? managerName.trim() : store.managerName,
      serviceAreas: Array.isArray(serviceAreas) ? serviceAreas : store.serviceAreas,
      specialties: Array.isArray(specialties) ? specialties : store.specialties,
      internalNotes: internalNotes !== undefined ? internalNotes.trim() : store.internalNotes,
      updatedAt: now,
    };

    await db.collection('stores').updateOne({ _id: store._id }, { $set: updates });

    await recordAudit(
      db,
      'UPDATE_STORE',
      'STORE',
      id,
      operator,
      `代銷中心更新加盟門店 [${updates.name}] 基本資料`
    );

    res.json({ success: true, message: '門店資料更新成功' });
  } catch (err: any) {
    res.status(500).json({ error: '更新門店失敗' });
  }
});

// 2.9.4 代銷中心管理員：變更門店狀態 (啟用 / 停用)
apiRouter.put('/stores/:id/status', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const now = new Date().toISOString();

    if (!['ACTIVE', 'DISABLED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: '無效的門店狀態' });
    }

    const store = await db.collection('stores').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!store) {
      return res.status(404).json({ error: '找不到指定門店' });
    }

    await db.collection('stores').updateOne(
      { _id: store._id },
      { $set: { status, updatedAt: now } }
    );

    await recordAudit(
      db,
      'CHANGE_STORE_STATUS',
      'STORE',
      id,
      operator,
      `代銷中心將門店 [${store.name}] 狀態變更為 [${status}]${reason ? `，原因：${reason}` : ''}`
    );

    res.json({ success: true, message: `門店狀態已更新為 ${status}` });
  } catch (err: any) {
    res.status(500).json({ error: '變更門店狀態失敗' });
  }
});

// 2.9.5 代銷中心管理員：安全刪除門店 (防護：有任何人員或業務紀錄不可刪除)
apiRouter.delete('/stores/:id', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operator = (req as any).user;
    const db = await getDb();

    const store = await db.collection('stores').findOne({ $or: [{ id }, { _id: id as any }] });
    if (!store) {
      return res.status(404).json({ error: '找不到指定門店' });
    }

    // 檢查關聯
    const [personnelCount, assignmentCount, regCount, txCount] = await Promise.all([
      db.collection('users').countDocuments({ storeId: id }),
      db.collection('assignments').countDocuments({ storeId: id }),
      db.collection('registrations').countDocuments({ storeId: id }),
      db.collection('transactions').countDocuments({ storeId: id }),
    ]);

    if (personnelCount > 0 || assignmentCount > 0 || regCount > 0 || txCount > 0) {
      return res.status(400).json({
        error: `該門店已有關聯紀錄（${personnelCount} 名同仁、${assignmentCount} 件建案指派、${regCount} 筆客戶登記、${txCount} 筆交易），為維持合規與歷史追溯，僅可執行停用，不可直接刪除`,
      });
    }

    await db.collection('stores').deleteOne({ _id: store._id });

    await recordAudit(
      db,
      'DELETE_STORE',
      'STORE',
      id,
      operator,
      `代銷中心刪除無任何關聯紀錄之門店 [${store.name}]`
    );

    res.json({ success: true, message: '門店已刪除' });
  } catch (err: any) {
    res.status(500).json({ error: '刪除門店失敗' });
  }
});

// 2.9.6 門店異動歷程查詢
apiRouter.get('/stores/:id/audit-logs', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const db = await getDb();

    if (user.role !== 'center_admin' && user.storeId !== id) {
      return res.status(403).json({ error: '權限不足：僅代銷中心與所屬門店店長可查閱異動紀錄' });
    }

    const logs = await db.collection('audit_logs')
      .find({
        $or: [{ storeId: id }, { entityId: id }],
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json({
      success: true,
      auditLogs: logs.map(({ _id, ...l }: any) => ({ ...l, id: l.id || _id })),
    });
  } catch (err: any) {
    res.status(500).json({ error: '取得門店異動紀錄失敗' });
  }
});

// 2.10 取得同仁列表（依視野過濾）
apiRouter.get('/users', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const db = await getDb();

    if (user.status === 'PENDING_APPROVAL' || user.status === 'PENDING_BINDING') {
      return res.json([]);
    }

    let query: any = {};
    if (user.role === 'center_admin') {
      query = {};
    } else if (user.role === 'store_manager' || user.role === 'agent') {
      query = { storeId: user.storeId };
    }

    const users = await db.collection('users').find(query).sort({ createdAt: -1 }).toArray();

    const sanitized = users.map(({ _id, ...u }: any) => {
      const formatted: any = { ...u, id: u.id || _id };
      if (user.role !== 'center_admin') {
        delete formatted.authUid;
        delete formatted.internalNotes;
        if (user.role === 'agent' && formatted.id !== user.id) {
          delete formatted.boundEmail;
        }
      }
      return formatted;
    });

    res.json(sanitized);
  } catch (err: any) {
    console.error('GET /users error:', err?.message || err);
    res.status(500).json({ error: '取得使用者資料失敗' });
  }
});

// 3. 取得依角色範圍過濾之 Scoped Data
apiRouter.get('/scoped-data', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const db = await getDb();

    // 規則：未開通審核之新進同仁或未綁定人員，不能讀取業務資料
    if (user.status === 'PENDING_APPROVAL' || user.status === 'PENDING_BINDING') {
      return res.json({
        status: user.status,
        user: { ...user, id: user.id || user._id },
        message: user.status === 'PENDING_BINDING'
          ? '您的同仁資料尚未完成登入身分綁定，目前無法存取業務資料。'
          : '您的帳號正在等待代銷中心總部審核開通，目前無法讀取業務資料。請聯繫代銷中心管理員完成開通。',
        projects: [],
        units: [],
        stores: [],
        assignments: [],
        customers: [],
        registrations: [],
        commissionVersions: [],
        commissionSnapshots: [],
        followUps: [],
        viewings: [],
        renewals: [],
        transactions: [],
        auditLogs: [],
      });
    }

    // 規則：門店停用時，該店人員停止存取門店業務資料，但保留人員本身狀態
    if (user.role !== 'center_admin' && user.storeId) {
      const userStore = await db.collection('stores').findOne({
        $or: [{ id: user.storeId }, { _id: user.storeId }],
      });
      if (userStore && (userStore.status === 'DISABLED' || userStore.status === 'INACTIVE')) {
        return res.json({
          status: 'STORE_DISABLED',
          user: { ...user, id: user.id || user._id },
          message: `您所屬的門店 [${userStore.name}] 目前已被代銷中心停用，停用期間停止存取門店業務資料。`,
          projects: [],
          units: [],
          stores: [{
            ...userStore,
            id: userStore.id || userStore._id,
            internalNotes: undefined,
          }],
          assignments: [],
          customers: [],
          registrations: [],
          commissionVersions: [],
          commissionSnapshots: [],
          followUps: [],
          viewings: [],
          renewals: [],
          transactions: [],
          auditLogs: [],
        });
      }
    }

    const now = new Date();
    // 規則：示範登入與正式資料完全隔離
    const isDemo = user.isDemo === true;
    const filterScope: any = isDemo ? { isDemo: true } : { isDemo: { $ne: true } };

    // 讀取全部基礎集合 (stores 讀取所有狀態，以便動態呈現)
    const [
      allProjects,
      allUnits,
      allStores,
      allAssignments,
      allCustomers,
      allRegistrations,
      allCommissionVersions,
      allCommissionSnapshots,
      allFollowUps,
      allViewings,
      allRenewals,
      allTransactions,
      allAuditLogs,
    ] = await Promise.all([
      db.collection('projects').find(filterScope).sort({ createdAt: -1 }).toArray(),
      db.collection('units').find(filterScope).sort({ floor: 1, unitNumber: 1 }).toArray(),
      db.collection('stores').find(isDemo ? {} : {}).sort({ createdAt: -1 }).toArray(),
      db.collection('assignments').find(filterScope).toArray(),
      db.collection('customers').find(filterScope).toArray(),
      db.collection('registrations').find(filterScope).sort({ createdAt: -1 }).toArray(),
      db.collection('commission_versions').find(filterScope).sort({ createdAt: -1 }).toArray(),
      db.collection('commission_snapshots').find(filterScope).toArray(),
      db.collection('follow_ups').find(filterScope).sort({ contactTime: -1 }).toArray(),
      db.collection('viewings').find(filterScope).sort({ scheduledTime: -1 }).toArray(),
      db.collection('renewals').find(filterScope).sort({ createdAt: -1 }).toArray(),
      db.collection('transactions').find(filterScope).sort({ createdAt: -1 }).toArray(),
      db.collection('audit_logs').find(filterScope).sort({ createdAt: -1 }).limit(200).toArray(),
    ]);

    // 門店動態統計計算 (實時統計人員、店長、業務與建案數)
    const enrichedStores = await Promise.all(
      allStores.map(async (s: any) => {
        const storeId = s.id || s._id;
        const [totalPersonnel, activeManagers, activeAgents, totalProjects] = await Promise.all([
          db.collection('users').countDocuments({ storeId }),
          db.collection('users').countDocuments({ storeId, role: 'store_manager', status: 'ACTIVE' }),
          db.collection('users').countDocuments({ storeId, role: 'agent', status: 'ACTIVE' }),
          db.collection('assignments').countDocuments({ storeId, status: 'ACTIVE' }),
        ]);
        const cleanStore: any = {
          ...s,
          id: storeId,
          totalPersonnel,
          activeManagers,
          activeAgents,
          totalProjects,
        };
        if (user.role !== 'center_admin') {
          delete cleanStore.internalNotes;
        }
        delete cleanStore._id;
        return cleanStore;
      })
    );

    let visibleStores = enrichedStores;
    if (user.role !== 'center_admin') {
      visibleStores = enrichedStores.filter((s: any) => s.id === user.storeId);
    }

    // 1. 建案過濾 (未指派給該門店或非上架中案源不回傳，且非代銷中心角色徹底剝除 internalNotes 內部備註)
    let visibleProjects = allProjects;
    let assignedProjectIds: string[] = [];
    if (user.role !== 'center_admin') {
      assignedProjectIds = allAssignments
        .filter((a: any) => a.storeId === user.storeId && a.status === 'ACTIVE')
        .map((a: any) => a.projectId);
      visibleProjects = allProjects.filter((p: any) => assignedProjectIds.includes(p.id || p._id) && p.status === 'ON_SALE');
    }
    visibleProjects = visibleProjects.map((p: any) => {
      const mapped = { ...p, id: p.id || p._id };
      if (user.role !== 'center_admin') {
        delete mapped.internalNotes; // 內部備註僅代銷中心可見
      }
      delete mapped._id;
      return mapped;
    });

    // 2. 戶別過濾 (門店不得取得建案底價：非 center_admin 徹底自後端剝除 bottomPrice；非管理員不回傳已停用戶別)
    const visibleProjectIds = visibleProjects.map((p: any) => p.id || p._id);
    const visibleUnits = allUnits
      .filter((u: any) => {
        if (user.role !== 'center_admin' && u.status === 'DISABLED') return false;
        return user.role === 'center_admin' || visibleProjectIds.includes(u.projectId);
      })
      .map((u: any) => {
        const mapped = { ...u, id: u.id || u._id };
        if (user.role !== 'center_admin') {
          delete mapped.bottomPrice; // 徹底剝除底價！
        }
        delete mapped._id;
        return mapped;
      });

    // 3. 客戶登記過濾 (A店不得讀取B店資料；業務只能讀取名下客戶)
    let visibleRegistrations: any[] = [];
    if (user.role === 'center_admin') {
      visibleRegistrations = allRegistrations;
    } else if (user.role === 'store_manager') {
      visibleRegistrations = allRegistrations.filter((r: any) => r.storeId === user.storeId);
    } else {
      visibleRegistrations = allRegistrations.filter((r: any) => r.agentId === (user.id || user._id));
    }

    // 計算即時天數與到期狀態
    const enrichedRegistrations = visibleRegistrations.map((reg: any) => {
      const calc = calculateReservationStatus(reg, now);
      const clean = { ...reg, id: reg.id || reg._id, status: calc.status };
      delete clean._id;
      return clean;
    });

    const visibleRegIds = enrichedRegistrations.map((r: any) => r.id);
    const visibleCustomerIds = enrichedRegistrations.map((r: any) => r.customerId);

    // 4. 客戶基本資料 (嚴格限制僅能讀取授權範圍內之客戶)
    const visibleCustomers = allCustomers
      .filter((c: any) => (user.role === 'center_admin' ? true : visibleCustomerIds.includes(c.id || c._id)))
      .map(({ _id, ...c }: any) => ({ ...c, id: c.id || _id }));

    // 5. 追蹤紀錄
    const visibleFollowUps = allFollowUps
      .filter((f: any) => (user.role === 'center_admin' ? true : visibleRegIds.includes(f.customerRegistrationId)))
      .map(({ _id, ...f }: any) => ({ ...f, id: f.id || _id }));

    // 6. 帶看紀錄
    const visibleViewings = allViewings
      .filter((v: any) => (user.role === 'center_admin' ? true : visibleRegIds.includes(v.customerRegistrationId)))
      .map(({ _id, ...v }: any) => ({ ...v, id: v.id || _id }));

    // 7. 續期申請
    const visibleRenewals = allRenewals
      .filter((r: any) =>
        user.role === 'center_admin'
          ? true
          : user.role === 'store_manager'
          ? r.storeId === user.storeId
          : r.agentId === (user.id || user._id)
      )
      .map(({ _id, ...r }: any) => ({ ...r, id: r.id || _id }));

    // 8. 交易申報
    const visibleTransactions = allTransactions
      .filter((t: any) =>
        user.role === 'center_admin'
          ? true
          : user.role === 'store_manager'
          ? t.storeId === user.storeId
          : t.agentId === (user.id || user._id)
      )
      .map(({ _id, ...t }: any) => ({ ...t, id: t.id || _id }));

    // 9. 稽核日誌
    const visibleAuditLogs = allAuditLogs
      .filter((l: any) => (user.role === 'center_admin' ? true : l.storeId === user.storeId))
      .map(({ _id, ...l }: any) => ({ ...l, id: l.id || _id }));

    res.json({
      status: 'ACTIVE',
      projects: visibleProjects.map(({ _id, ...p }: any) => ({ ...p, id: p.id || _id })),
      units: visibleUnits,
      stores: visibleStores,
      assignments: allAssignments
        .filter((a: any) => (user.role === 'center_admin' ? true : a.storeId === user.storeId))
        .map(({ _id, ...a }: any) => {
          const formatted = { ...a, id: a.id || _id };
          if (user.role !== 'center_admin') {
            delete formatted.internalNotes;
          }
          return formatted;
        }),
      customers: visibleCustomers,
      registrations: enrichedRegistrations,
      commissionVersions: allCommissionVersions.map(({ _id, ...v }: any) => ({ ...v, id: v.id || _id })),
      commissionSnapshots: allCommissionSnapshots.map(({ _id, ...s }: any) => ({ ...s, id: s.id || _id })),
      followUps: visibleFollowUps,
      viewings: visibleViewings,
      renewals: visibleRenewals,
      transactions: visibleTransactions,
      auditLogs: visibleAuditLogs,
    });
  } catch (err: any) {
    console.error('GET /scoped-data error:', err?.message || err);
    res.status(500).json({ error: '載入工作區資料失敗' });
  }
});

// 4. 重設示範資料
apiRouter.post('/reset-demo-data', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    await resetDatabase(db);
    res.json({ success: true, message: '資料庫已成功重設為初始示範資料' });
  } catch (err: any) {
    console.error('POST /reset-demo-data error:', err?.message || err);
    res.status(500).json({ error: '重設資料庫示範資料失敗' });
  }
});

// 5. 取得建案指派門店清單 (中心端專用，含門店詳細資料、歷史紀錄與案件統計)
apiRouter.get('/projects/:projectId/assignments', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const db = await getDb();

    const rawAssignments = await db.collection('assignments').find({ projectId }).sort({ assignedAt: -1 }).toArray();
    const stores = await db.collection('stores').find({}).toArray();

    const enriched = await Promise.all(rawAssignments.map(async (a: any) => {
      const storeId = a.storeId;
      const store = stores.find((s: any) => (s.id || s._id) === storeId);

      const [activeRegsCount, pendingTxsCount] = await Promise.all([
        db.collection('registrations').countDocuments({ projectId, storeId, status: { $in: ['ACTIVE', 'EXPIRING_SOON'] } }),
        db.collection('transactions').countDocuments({
          projectId,
          storeId,
          stage: { $nin: ['DEAL_CONFIRMED', 'CANCELLED'] },
        }),
      ]);

      const formatted: any = {
        ...a,
        id: a.id || a._id,
        storeName: store?.name || a.storeName || '未命名門店',
        storeCode: store?.code || '',
        storeCity: store?.city || '',
        storeDistrict: store?.district || '',
        storeSpecialties: store?.specialties || [],
        storeStatus: store?.status || 'UNKNOWN',
        activeRegistrationsCount: activeRegsCount,
        pendingTransactionsCount: pendingTxsCount,
      };
      delete formatted._id;
      return formatted;
    }));

    res.json(enriched);
  } catch (err: any) {
    console.error('GET /projects/:projectId/assignments error:', err);
    res.status(500).json({ error: '取得建案門店指派名單失敗' });
  }
});

// 5.1 批次指派門店 (中心端人工挑選，含必填指派原因、門店可見銷售說明與內部備註)
apiRouter.post('/projects/:projectId/batch-assign', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { storeIds, reason, salesNotesForStore, internalNotes } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const nowIso = new Date().toISOString();

    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ error: '請至少選擇一家欲指派的門店' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: '指派原因為必填欄位' });
    }

    const project = await db.collection('projects').findOne({ $or: [{ id: projectId }, { _id: projectId as any }] });
    if (!project) {
      return res.status(404).json({ error: '找不到指定建案' });
    }

    // 規則 2：只有已上架、符合既有上架條件的建案可以新增指派
    if (project.status !== 'ON_SALE') {
      return res.status(400).json({
        error: `建案目前非上架中狀態（當前狀態：${project.status}），僅已上架 (ON_SALE) 之建案可以新增門店指派`,
      });
    }

    const results: any[] = [];

    for (const storeId of storeIds) {
      const store = await db.collection('stores').findOne({ $or: [{ id: storeId }, { _id: storeId as any }] });
      const storeName = store?.name || storeId;

      if (!store) {
        results.push({ storeId, storeName, success: false, message: '找不到指定門店' });
        continue;
      }

      // 規則 3：只有啟用中的門店可以接受指派
      if (store.status !== 'ACTIVE') {
        results.push({
          storeId,
          storeName,
          success: false,
          message: `門店目前狀態為 [${store.status}]，僅啟用中 (ACTIVE) 門店可以接受指派`,
        });
        continue;
      }

      const existing = await db.collection('assignments').findOne({ projectId, storeId });

      if (existing) {
        // 規則 5：重複送出不得建立重複關係
        if (existing.status === 'ACTIVE') {
          results.push({
            storeId,
            storeName,
            success: false,
            message: '該門店已在此建案之有效銷售名單中，不得重複指派',
          });
          continue;
        }

        // 規則 4 & 6：同建案同門店只保留一筆目前指派關係，歷次變更另存紀錄
        const histId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const histItem = {
          id: histId,
          action: 'RESUME',
          timestamp: nowIso,
          operatorId: operator.id,
          operatorName: operator.name,
          reason: reason.trim(),
          salesNotesForStore: salesNotesForStore ? salesNotesForStore.trim() : (existing.salesNotesForStore || ''),
          internalNotes: internalNotes ? internalNotes.trim() : (existing.internalNotes || ''),
        };

        await db.collection('assignments').updateOne(
          { _id: existing._id },
          {
            $set: {
              status: 'ACTIVE',
              assignedAt: nowIso,
              assignedBy: operator.name,
              reason: reason.trim(),
              salesNotesForStore: salesNotesForStore ? salesNotesForStore.trim() : (existing.salesNotesForStore || ''),
              internalNotes: internalNotes ? internalNotes.trim() : (existing.internalNotes || ''),
              updatedAt: nowIso,
            },
            $push: {
              history: histItem as any,
            },
          }
        );

        await recordAudit(
          db,
          'RESUME_ASSIGNMENT',
          'ProjectAssignment',
          existing.id || existing._id,
          operator,
          `代銷中心重新恢復門店 [${storeName}] 對建案 [${project.name}] 之聯銷權：${reason}`,
          storeId
        );

        results.push({
          storeId,
          storeName,
          success: true,
          message: '已成功重啟該門店之聯銷授權',
        });
      } else {
        // 全新指派
        const asgId = `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const histId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const histItem = {
          id: histId,
          action: 'ASSIGN',
          timestamp: nowIso,
          operatorId: operator.id,
          operatorName: operator.name,
          reason: reason.trim(),
          salesNotesForStore: salesNotesForStore?.trim() || '',
          internalNotes: internalNotes?.trim() || '',
        };

        const newAssignment = {
          _id: asgId as any,
          id: asgId,
          projectId,
          projectName: project.name,
          storeId,
          storeName,
          assignedAt: nowIso,
          assignedBy: operator.name,
          status: 'ACTIVE',
          reason: reason.trim(),
          salesNotesForStore: salesNotesForStore?.trim() || '',
          internalNotes: internalNotes?.trim() || '',
          history: [histItem],
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await db.collection('assignments').insertOne(newAssignment);

        await recordAudit(
          db,
          'ASSIGN_PROJECT_STORE',
          'ProjectAssignment',
          asgId,
          operator,
          `代銷中心指派門店 [${storeName}] 聯銷建案 [${project.name}]：${reason}`,
          storeId
        );

        results.push({
          storeId,
          storeName,
          success: true,
          message: '成功加入聯銷門店',
        });
      }
    }

    res.json({
      success: true,
      results,
    });
  } catch (err: any) {
    console.error('POST /projects/:projectId/batch-assign error:', err);
    res.status(500).json({ error: '批次指派門店失敗' });
  }
});

// 5.2 變更指派狀態 (暫停 PAUSED / 恢復 ACTIVE / 撤銷 REVOKED，落實影響評估與歷程存檔)
apiRouter.post('/projects/:projectId/assignments/:assignmentId/status', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId, assignmentId } = req.params;
    const { status, reason, salesNotesForStore, internalNotes } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const nowIso = new Date().toISOString();

    if (!['ACTIVE', 'PAUSED', 'REVOKED'].includes(status)) {
      return res.status(400).json({ error: '無效的指派狀態' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: '變更狀態原因為必填欄位' });
    }

    const assignment = await db.collection('assignments').findOne({
      $or: [{ id: assignmentId }, { _id: assignmentId as any }],
      projectId,
    });
    if (!assignment) {
      return res.status(404).json({ error: '找不到指定之門店指派紀錄' });
    }

    const project = await db.collection('projects').findOne({ $or: [{ id: projectId }, { _id: projectId as any }] });
    const store = await db.collection('stores').findOne({
      $or: [{ id: assignment.storeId }, { _id: assignment.storeId as any }],
    });

    // 規則 6：恢復或重新指派時，重新檢查建案與門店狀態
    if (status === 'ACTIVE') {
      if (!project || project.status !== 'ON_SALE') {
        return res.status(400).json({ error: '建案目前非上架中狀態，無法恢復指派' });
      }
      if (!store || store.status !== 'ACTIVE') {
        return res.status(400).json({ error: '門店目前非啟用狀態，無法恢復指派' });
      }
    }

    const actionMap: Record<string, string> = {
      ACTIVE: 'RESUME',
      PAUSED: 'PAUSE',
      REVOKED: 'REVOKE',
    };
    const action = actionMap[status] || 'PAUSE';

    const histId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const histItem = {
      id: histId,
      action,
      timestamp: nowIso,
      operatorId: operator.id,
      operatorName: operator.name,
      reason: reason.trim(),
      salesNotesForStore: salesNotesForStore !== undefined ? salesNotesForStore.trim() : assignment.salesNotesForStore,
      internalNotes: internalNotes !== undefined ? internalNotes.trim() : assignment.internalNotes,
    };

    const updateFields: any = {
      status,
      reason: reason.trim(),
      updatedAt: nowIso,
    };
    if (salesNotesForStore !== undefined) {
      updateFields.salesNotesForStore = salesNotesForStore.trim();
    }
    if (internalNotes !== undefined) {
      updateFields.internalNotes = internalNotes.trim();
    }

    await db.collection('assignments').updateOne(
      { _id: assignment._id },
      {
        $set: updateFields,
        $push: { history: histItem as any },
      }
    );

    const storeName = store?.name || assignment.storeName || assignment.storeId;
    const projectName = project?.name || projectId;

    await recordAudit(
      db,
      action === 'PAUSE' ? 'PAUSE_ASSIGNMENT' : action === 'RESUME' ? 'RESUME_ASSIGNMENT' : 'REVOKE_ASSIGNMENT',
      'ProjectAssignment',
      assignment.id || assignment._id,
      operator,
      `代銷中心將門店 [${storeName}] 對建案 [${projectName}] 之聯銷狀態變更為 [${status}]，原因：${reason}`,
      assignment.storeId
    );

    res.json({
      success: true,
      message: `指派狀態已成功更新為 ${status}`,
    });
  } catch (err: any) {
    console.error('POST status error:', err);
    res.status(500).json({ error: '變更指派狀態失敗' });
  }
});

// 5.3 暫停或撤銷指派前之影響評估檢查 (檢查有效保留客戶、待審展期與未完成交易)
apiRouter.get('/projects/:projectId/assignments/:assignmentId/impact-check', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId, assignmentId } = req.params;
    const db = await getDb();

    const assignment = await db.collection('assignments').findOne({
      $or: [{ id: assignmentId }, { _id: assignmentId as any }],
      projectId,
    });
    if (!assignment) {
      return res.status(404).json({ error: '找不到指定指派紀錄' });
    }

    const [project, store] = await Promise.all([
      db.collection('projects').findOne({ $or: [{ id: projectId }, { _id: projectId as any }] }),
      db.collection('stores').findOne({ $or: [{ id: assignment.storeId }, { _id: assignment.storeId as any }] }),
    ]);

    const [activeRegs, pendingRenewals, pendingTxs] = await Promise.all([
      db.collection('registrations').find({
        projectId,
        storeId: assignment.storeId,
        status: { $in: ['ACTIVE', 'EXPIRING_SOON'] },
      }).toArray(),
      db.collection('renewals').find({
        storeId: assignment.storeId,
        status: 'PENDING',
      }).toArray(),
      db.collection('transactions').find({
        projectId,
        storeId: assignment.storeId,
        stage: { $nin: ['DEAL_CONFIRMED', 'CANCELLED'] },
      }).toArray(),
    ]);

    const customers = await db.collection('customers').find({}).toArray();
    const users = await db.collection('users').find({}).toArray();

    const impactInfo = {
      storeId: assignment.storeId,
      storeName: store?.name || assignment.storeId,
      projectId,
      projectName: project?.name || projectId,
      activeRegistrationsCount: activeRegs.length,
      pendingRenewalsCount: pendingRenewals.length,
      pendingTransactionsCount: pendingTxs.length,
      activeRegistrations: activeRegs.map((r: any) => {
        const cust = customers.find((c: any) => (c.id || c._id) === r.customerId);
        const agent = users.find((u: any) => (u.id || u._id) === r.agentId);
        return {
          id: r.id || r._id,
          customerName: cust?.name || '客戶',
          phone: r.phone,
          agentName: agent?.name || '業務',
          createdAt: r.createdAt,
          expiresAt: r.reservationExpiryDate,
        };
      }),
      pendingTransactions: pendingTxs.map((t: any) => {
        const cust = customers.find((c: any) => (c.id || c._id) === t.customerId);
        const agent = users.find((u: any) => (u.id || u._id) === t.agentId);
        return {
          id: t.id || t._id,
          customerName: cust?.name || '客戶',
          agentName: agent?.name || '業務',
          stage: t.stage,
          reportedAt: t.reportedAt || t.createdAt,
        };
      }),
    };

    res.json(impactInfo);
  } catch (err: any) {
    console.error('GET impact-check error:', err);
    res.status(500).json({ error: '檢查受影響案件失敗' });
  }
});

// 5.4 拒絕物理刪除有歷史紀錄之指派 (合規與軌跡保護)
apiRouter.delete('/projects/:projectId/assignments/:assignmentId', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  return res.status(400).json({
    error: '依聯銷規章，指派紀錄與歷史異動軌跡不得物理刪除，請使用「暫停」或「撤銷」指派狀態！',
  });
});

// 5.5 新增 / 指派門店聯銷權 (向下相容)
apiRouter.post('/projects/:projectId/assign-store', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { storeId, changeReason } = req.body;
    const operator = (req as any).user;
    const db = await getDb();

    const existing = await db.collection('assignments').findOne({ projectId, storeId });
    const now = new Date().toISOString();

    let resultAssignment: any;
    if (existing) {
      await db.collection('assignments').updateOne(
        { _id: existing._id },
        {
          $set: {
            status: 'ACTIVE',
            assignedAt: now,
            assignedBy: operator.name,
            reason: changeReason || '重啟聯銷授權',
            changeReason: changeReason || '重啟聯銷授權',
            updatedAt: now,
          },
        }
      );
      resultAssignment = {
        ...existing,
        status: 'ACTIVE',
        assignedAt: now,
        assignedBy: operator.name,
        reason: changeReason || '重啟聯銷授權',
        changeReason: changeReason || '重啟聯銷授權',
        updatedAt: now,
      };
    } else {
      const newId = `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      resultAssignment = {
        _id: newId,
        id: newId,
        projectId,
        storeId,
        assignedAt: now,
        assignedBy: operator.name,
        status: 'ACTIVE',
        reason: changeReason || '代銷中心首次授權加盟門店聯銷',
        changeReason: changeReason || '代銷中心首次授權加盟門店聯銷',
        isDemo: operator.isDemo === true,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('assignments').insertOne(resultAssignment);
    }

    await recordAudit(
      db,
      'ASSIGN_PROJECT_STORE',
      'ProjectAssignment',
      resultAssignment.id || resultAssignment._id,
      operator,
      `授權建案 [${projectId}] 予門店 [${storeId}] 進行聯銷：${changeReason}`,
      storeId
    );

    res.json({ success: true, assignment: resultAssignment });
  } catch (err: any) {
    console.error('POST /projects/:projectId/assign-store error:', err?.message || err);
    res.status(500).json({ error: '授權門店聯銷失敗' });
  }
});

// 5.6 撤銷門店聯銷權 (向下相容)
apiRouter.post('/projects/:projectId/revoke-store', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { storeId, changeReason } = req.body;
    const operator = (req as any).user;
    const db = await getDb();

    const now = new Date().toISOString();
    await db.collection('assignments').updateOne(
      { projectId, storeId },
      {
        $set: {
          status: 'REVOKED',
          assignedBy: operator.name,
          reason: changeReason || '代銷中心調整聯銷門店策略收回授權',
          changeReason: changeReason || '代銷中心調整聯銷門店策略收回授權',
          updatedAt: now,
        },
      }
    );

    await recordAudit(
      db,
      'REVOKE_PROJECT_STORE',
      'ProjectAssignment',
      `${projectId}_${storeId}`,
      operator,
      `撤銷門店 [${storeId}] 對建案 [${projectId}] 之聯銷權：${changeReason}`,
      storeId
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('POST /projects/:projectId/revoke-store error:', err?.message || err);
    res.status(500).json({ error: '撤銷門店授權失敗' });
  }
});

// ==================== 門店專用案源 API (Strict Whitelist) ====================

// 5.7 門店「我的建案」清單：嚴格由後端依登入者所屬門店查詢，僅回傳有效指派且上架中案源
apiRouter.get('/store/my-projects', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const db = await getDb();

    // 檢查人員與門店狀態
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: '您的帳號尚未開通審核，暫無法檢視案源' });
    }
    if (!user.storeId && user.role !== 'center_admin') {
      return res.status(400).json({ error: '您的帳號尚未綁定門店' });
    }

    const storeId = user.storeId;
    if (user.role !== 'center_admin') {
      const store = await db.collection('stores').findOne({ $or: [{ id: storeId }, { _id: storeId as any }] });
      if (!store || store.status === 'DISABLED' || store.status === 'INACTIVE') {
        return res.status(403).json({ error: '您所屬的門店已被停用，無法檢視建案資料' });
      }
    }

    // 查詢此門店之有效指派 (中心管理員未綁店則模擬看所有有效指派建案)
    const queryAssignment = user.role === 'center_admin' && !storeId
      ? { status: 'ACTIVE' }
      : { storeId, status: 'ACTIVE' };

    const activeAssignments = await db.collection('assignments').find(queryAssignment).toArray();
    if (activeAssignments.length === 0) {
      return res.json([]);
    }

    const projectIds = activeAssignments.map((a: any) => a.projectId);

    // 查詢已上架建案 (status === 'ON_SALE')
    const rawProjects = await db.collection('projects').find({
      $or: [{ id: { $in: projectIds } }, { _id: { $in: projectIds as any } }],
      status: 'ON_SALE',
    }).sort({ updatedAt: -1 }).toArray();

    // 取得所有生效中的分佣版本
    const commissionVersions = await db.collection('commission_versions').find({
      projectId: { $in: projectIds },
      status: 'ACTIVE',
    }).toArray();

    // 白名單映射，徹底剝除 bottomPrice, internalNotes
    const enrichedProjects = await Promise.all(rawProjects.map(async (p: any) => {
      const pId = p.id || p._id;
      const assignment = activeAssignments.find((a: any) => a.projectId === pId);

      // 動態統計可售戶數與價格區間
      const units = await db.collection('units').find({
        projectId: pId,
        status: { $ne: 'DISABLED' },
      }).toArray();

      const totalUnits = units.length;
      const totalAvailableUnits = units.filter((u: any) => u.status === 'AVAILABLE').length;

      const validPrices = units
        .map((u: any) => u.listPrice)
        .filter((price: any) => typeof price === 'number' && !isNaN(price) && price > 0);
      const minPriceWan = validPrices.length > 0 ? Math.round(Math.min(...validPrices) / 10000) : 0;
      const maxPriceWan = validPrices.length > 0 ? Math.round(Math.max(...validPrices) / 10000) : 0;
      const priceRange = validPrices.length > 0
        ? (minPriceWan === maxPriceWan ? `${minPriceWan} 萬起` : `${minPriceWan} ~ ${maxPriceWan} 萬元`)
        : (p.priceRange || '洽現場');

      // 對應分佣條件
      const cv = commissionVersions.find((v: any) => v.projectId === pId) || {
        versionNumber: 'V1.0',
        percentage: 3.0,
        storePercentage: 70,
        effectiveDate: p.createdAt || new Date().toISOString(),
      };

      const result: any = {
        id: pId,
        name: p.name,
        developer: p.developer,
        productType: p.productType,
        buildingType: p.buildingType,
        city: p.city,
        district: p.district,
        address: p.address,
        receptionAddress: p.receptionAddress,
        receptionContact: p.receptionContact,
        coverImage: p.coverImage,
        exteriorImages: p.exteriorImages || [],
        floorPlans: p.floorPlans || [],
        salesBrochure: p.salesBrochure,
        specifications: p.specifications,
        description: p.description,
        highlights: p.highlights || [],
        priceRange,
        status: p.status,
        totalAvailableUnits,
        totalUnits,
        updatedAt: p.updatedAt || p.createdAt,
        assignmentId: assignment?.id || assignment?._id,
        assignmentStatus: assignment?.status || 'ACTIVE',
        assignedAt: assignment?.assignedAt,
        salesNotesForStore: assignment?.salesNotesForStore || '',
        commissionCondition: {
          versionNumber: cv.versionNumber,
          percentage: cv.percentage,
          storePercentage: cv.storePercentage,
          effectiveDate: cv.effectiveDate || (cv as any).createdAt,
        },
      };

      return result;
    }));

    res.json(enrichedProjects);
  } catch (err: any) {
    console.error('GET /store/my-projects error:', err);
    res.status(500).json({ error: '取得門店案源失敗' });
  }
});

// 5.8 門店「建案詳情」：白名單欄位，嚴格去除底價與內部備註，包含戶別、素材與銷售說明
apiRouter.get('/store/projects/:projectId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const user = (req as any).user;
    const db = await getDb();

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: '您的帳號尚未開通審核' });
    }

    const storeId = user.storeId;
    if (user.role !== 'center_admin') {
      const store = await db.collection('stores').findOne({ $or: [{ id: storeId }, { _id: storeId as any }] });
      if (!store || store.status === 'DISABLED' || store.status === 'INACTIVE') {
        return res.status(403).json({ error: '門店已被停用，無法檢視建案資料' });
      }

      // 檢查此建案是否有效指派給本店
      const assignment = await db.collection('assignments').findOne({
        projectId,
        storeId,
        status: 'ACTIVE',
      });
      if (!assignment) {
        return res.status(403).json({ error: '貴門店未獲此建案之有效聯銷授權（可能尚未指派或已被暫停/撤銷）' });
      }
    }

    const project = await db.collection('projects').findOne({ $or: [{ id: projectId }, { _id: projectId as any }] });
    if (!project) {
      return res.status(404).json({ error: '找不到指定建案' });
    }
    if (user.role !== 'center_admin' && project.status !== 'ON_SALE') {
      return res.status(403).json({ error: '該建案目前非上架中狀態' });
    }

    const assignment = await db.collection('assignments').findOne({
      projectId,
      ...(user.role !== 'center_admin' ? { storeId } : {}),
      status: 'ACTIVE',
    });

    // 取得戶別清單（嚴格白名單，徹底剝除 bottomPrice）
    const rawUnits = await db.collection('units').find({
      projectId,
      status: { $ne: 'DISABLED' },
    }).sort({ building: 1, floor: 1, unitNumber: 1 }).toArray();

    const units = rawUnits.map((u: any) => ({
      id: u.id || u._id,
      projectId: u.projectId,
      building: u.building,
      unitNumber: u.unitNumber,
      floor: u.floor,
      pattern: u.pattern,
      bedrooms: u.bedrooms,
      livingRooms: u.livingRooms,
      bathrooms: u.bathrooms,
      areaPings: u.areaPings,
      totalPing: u.totalPing,
      includesParking: u.includesParking,
      parkingInfo: u.parkingInfo,
      parkingNumber: u.parkingNumber,
      parkingType: u.parkingType,
      housePrice: u.housePrice,
      parkingPrice: u.parkingPrice,
      listPrice: u.listPrice, // 總開價，門店可見
      status: u.status,
      notes: u.notes,
      updatedAt: u.updatedAt,
      // 絕對無 bottomPrice!
    }));

    // 取得目前生效分佣條件
    const commissionVersion = await db.collection('commission_versions').findOne({
      projectId,
      status: 'ACTIVE',
    });

    const storeProjectDetail: any = {
      id: project.id || project._id,
      name: project.name,
      developer: project.developer,
      productType: project.productType,
      buildingType: project.buildingType,
      city: project.city,
      district: project.district,
      address: project.address,
      receptionAddress: project.receptionAddress,
      receptionPhone: project.receptionPhone,
      receptionContact: project.receptionContact,
      centerContactPerson: project.centerContactPerson,
      centerContactPhone: project.centerContactPhone,
      description: project.description,
      highlights: project.highlights || [],
      specifications: project.specifications,
      salesBrochure: project.salesBrochure,
      coverImage: project.coverImage,
      exteriorImages: project.exteriorImages || [],
      floorPlans: project.floorPlans || [],
      status: project.status,
      updatedAt: project.updatedAt,
      units,
      assignment: assignment ? {
        id: assignment.id || assignment._id,
        status: assignment.status,
        assignedAt: assignment.assignedAt,
        salesNotesForStore: assignment.salesNotesForStore || '',
      } : undefined,
      commissionCondition: {
        versionNumber: commissionVersion?.versionNumber || 'V1.0',
        percentage: commissionVersion?.percentage ?? 3.0,
        storePercentage: commissionVersion?.storePercentage ?? 70,
        effectiveDate: commissionVersion?.effectiveDate || project.createdAt,
        disclaimerNotice: '本頁顯示目前條件；個別客戶權益以正式登記時的鎖定快照為準。',
      },
    };

    res.json(storeProjectDetail);
  } catch (err: any) {
    console.error('GET /store/projects/:projectId error:', err);
    res.status(500).json({ error: '取得建案詳情失敗' });
  }
});

// 5.9 門店「歷史案件入口」：唯讀查看原指派已暫停/撤銷或建案已下架的案件與歷史紀錄
apiRouter.get('/store/historical-projects', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const db = await getDb();

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: '您的帳號尚未開通審核' });
    }

    const storeId = user.storeId;
    if (user.role !== 'center_admin') {
      const store = await db.collection('stores').findOne({ $or: [{ id: storeId }, { _id: storeId as any }] });
      if (!store || store.status === 'DISABLED' || store.status === 'INACTIVE') {
        return res.status(403).json({ error: '門店已被停用，無法檢視歷史紀錄' });
      }
    }

    // 找出所有曾被指派但目前 status !== 'ACTIVE'，或者所屬建案 status !== 'ON_SALE' 的指派紀錄
    const assignments = await db.collection('assignments').find(
      user.role === 'center_admin' && !storeId ? {} : { storeId }
    ).toArray();

    const projectIds = assignments.map((a: any) => a.projectId);
    const projects = await db.collection('projects').find({
      $or: [{ id: { $in: projectIds } }, { _id: { $in: projectIds as any } }],
    }).toArray();

    // 篩選出歷史案源（指派暫停/撤銷，或建案非 ON_SALE）
    const historicalAssignments = assignments.filter((a: any) => {
      const proj = projects.find((p: any) => (p.id || p._id) === a.projectId);
      return a.status !== 'ACTIVE' || (proj && proj.status !== 'ON_SALE');
    });

    const historicalData = await Promise.all(historicalAssignments.map(async (a: any) => {
      const proj: any = projects.find((p: any) => (p.id || p._id) === a.projectId) || {};
      const pId = a.projectId;

      // 歷史客戶登記 (業務僅自己，店長看本店)
      const regQuery: any = { projectId: pId, storeId: a.storeId };
      if (user.role === 'agent') {
        regQuery.agentId = user.id;
      }
      const registrations = await db.collection('registrations').find(regQuery).sort({ createdAt: -1 }).toArray();

      // 歷史交易
      const txQuery: any = { projectId: pId, storeId: a.storeId };
      if (user.role === 'agent') {
        txQuery.agentId = user.id;
      }
      const transactions = await db.collection('transactions').find(txQuery).sort({ createdAt: -1 }).toArray();

      return {
        projectId: pId,
        projectName: proj.name || '未知建案',
        developer: proj.developer || '',
        coverImage: proj.coverImage || '',
        city: proj.city || '',
        district: proj.district || '',
        productType: proj.productType,
        projectStatus: proj.status,
        assignmentStatus: a.status,
        assignedAt: a.assignedAt,
        reason: a.reason,
        changeReason: a.changeReason,
        history: a.history || [],
        registrationsCount: registrations.length,
        transactionsCount: transactions.length,
        registrations: registrations.map(({ _id, ...r }: any) => ({ ...r, id: r.id || _id })),
        transactions: transactions.map(({ _id, ...t }: any) => ({ ...t, id: t.id || _id })),
      };
    }));

    res.json(historicalData);
  } catch (err: any) {
    console.error('GET /store/historical-projects error:', err);
    res.status(500).json({ error: '取得歷史案件失敗' });
  }
});

// 輔助函式：即時動態計算建案可售戶數與總戶數 (不可用手動數字代替)
async function recalculateProjectUnits(db: any, projectId: string) {
  const allUnitsForProj = await db.collection('units').find({
    projectId,
    status: { $ne: 'DISABLED' },
  }).toArray();

  const totalUnits = allUnitsForProj.length;
  const availableUnits = allUnitsForProj.filter((u: any) => u.status === 'AVAILABLE').length;

  await db.collection('projects').updateOne(
    { $or: [{ _id: projectId as any }, { id: projectId }] },
    {
      $set: {
        totalUnits,
        availableUnits,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return { totalUnits, availableUnits };
}

// 6.1 新增建案 (僅代銷中心：可獨立建立，不需先建立門店或指定業務)
apiRouter.post('/projects', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { project } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const nowIso = new Date().toISOString();

    if (!project || !project.name || !project.name.trim()) {
      return res.status(400).json({ error: '建案名稱為必填項目' });
    }

    const projectId = project.id || `proj_${Date.now()}`;
    const newProject = {
      _id: projectId as any,
      id: projectId,
      name: project.name.trim(),
      developer: (project.developer || '').trim(),
      productType: project.productType || 'PRE_SALE',
      buildingType: project.buildingType || 'BUILDING',
      city: (project.city || '台北市').trim(),
      district: (project.district || '').trim(),
      address: (project.address || '').trim(),
      receptionAddress: (project.receptionAddress || '').trim(),
      receptionContact: (project.receptionContact || '').trim(),
      description: (project.description || '').trim(),
      highlights: Array.isArray(project.highlights)
        ? project.highlights.map((h: any) => String(h).trim()).filter(Boolean)
        : typeof project.highlights === 'string'
        ? project.highlights.split('·').map((s: string) => s.trim()).filter(Boolean)
        : [],
      baseAreaPings: project.baseAreaPings !== undefined && project.baseAreaPings !== null && project.baseAreaPings !== '' ? Number(project.baseAreaPings) : undefined,
      totalUnits: 0,
      availableUnits: 0,
      floorPlanInfo: (project.floorPlanInfo || '').trim(),
      roomTypes: (project.roomTypes || '').trim(),
      pingRange: (project.pingRange || '').trim(),
      parkingType: (project.parkingType || '').trim(),
      completionDateType: project.completionDateType || 'ESTIMATED',
      completionDate: (project.completionDate || '').trim(),
      centerContactPerson: (project.centerContactPerson || '').trim(),
      centerContactPhone: (project.centerContactPhone || '').trim(),
      centerContactEmail: (project.centerContactEmail || '').trim(),
      internalNotes: (project.internalNotes || '').trim(),
      status: project.status || 'ON_SALE',
      // 銷售素材
      coverImage: (project.coverImage || '').trim(),
      exteriorImages: Array.isArray(project.exteriorImages) ? project.exteriorImages : [],
      realImages: Array.isArray(project.realImages) ? project.realImages : [],
      amenityImages: Array.isArray(project.amenityImages) ? project.amenityImages : [],
      sampleHouseImages: Array.isArray(project.sampleHouseImages) ? project.sampleHouseImages : [],
      floorPlans: Array.isArray(project.floorPlans) ? project.floorPlans : [],
      layoutPlans: Array.isArray(project.layoutPlans) ? project.layoutPlans : [],
      specifications: (project.specifications || '').trim(),
      salesBrochure: (project.salesBrochure || '').trim(),
      isDemo: operator.isDemo === true,
      createdAt: project.createdAt || nowIso,
      updatedAt: nowIso,
    };

    await db.collection('projects').updateOne(
      { _id: projectId as any },
      { $set: newProject },
      { upsert: true }
    );

    // 建立預設分佣版本 V1.0
    const defaultVersionId = `ver_${projectId}_v1`;
    const defaultVersion = {
      _id: defaultVersionId as any,
      id: defaultVersionId,
      projectId,
      versionNumber: 'V1.0',
      effectiveDate: nowIso,
      formulaType: 'PERCENTAGE_TOTAL',
      percentage: 3.0,
      centerPercentage: 30,
      storePercentage: 70,
      note: '新建案預設分佣方案',
      publishedBy: operator?.name || '代銷中心',
      isDemo: operator.isDemo === true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await db.collection('commission_versions').updateOne(
      { _id: defaultVersionId as any },
      { $set: defaultVersion },
      { upsert: true }
    );

    // 計算戶別資料
    const counts = await recalculateProjectUnits(db, projectId);
    newProject.totalUnits = counts.totalUnits;
    newProject.availableUnits = counts.availableUnits;

    await recordAudit(
      db,
      'CREATE_PROJECT',
      'Project',
      projectId,
      operator,
      `代銷中心建立新代理建案 [${newProject.name}]，基地地址：${newProject.city}${newProject.district} ${newProject.address}`
    );

    res.json({ success: true, project: newProject });
  } catch (err: any) {
    console.error('POST /projects error:', err?.message || err);
    res.status(500).json({ error: '儲存建案失敗：' + (err?.message || '伺服器內部錯誤') });
  }
});

// 6.2 編輯/更新建案 (僅代銷中心)
apiRouter.put('/projects/:projectId', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { project } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const nowIso = new Date().toISOString();

    if (!project || !project.name || !project.name.trim()) {
      return res.status(400).json({ error: '建案名稱為必填項目' });
    }

    const existingProject = await db.collection('projects').findOne({
      $or: [{ _id: projectId as any }, { id: projectId }],
    });
    if (!existingProject) {
      return res.status(404).json({ error: '找不到欲編輯之建案' });
    }

    const updatedData: any = {
      name: project.name.trim(),
      developer: (project.developer || '').trim(),
      productType: project.productType || existingProject.productType || 'PRE_SALE',
      buildingType: project.buildingType || existingProject.buildingType || 'BUILDING',
      city: (project.city || existingProject.city || '台北市').trim(),
      district: (project.district || existingProject.district || '').trim(),
      address: (project.address || existingProject.address || '').trim(),
      receptionAddress: (project.receptionAddress || '').trim(),
      receptionContact: (project.receptionContact || '').trim(),
      description: (project.description || '').trim(),
      highlights: Array.isArray(project.highlights)
        ? project.highlights.map((h: any) => String(h).trim()).filter(Boolean)
        : typeof project.highlights === 'string'
        ? project.highlights.split('·').map((s: string) => s.trim()).filter(Boolean)
        : existingProject.highlights || [],
      baseAreaPings: project.baseAreaPings !== undefined && project.baseAreaPings !== null && project.baseAreaPings !== '' ? Number(project.baseAreaPings) : undefined,
      floorPlanInfo: (project.floorPlanInfo || '').trim(),
      roomTypes: (project.roomTypes || '').trim(),
      pingRange: (project.pingRange || '').trim(),
      parkingType: (project.parkingType || '').trim(),
      completionDateType: project.completionDateType || existingProject.completionDateType || 'ESTIMATED',
      completionDate: (project.completionDate || '').trim(),
      centerContactPerson: (project.centerContactPerson || '').trim(),
      centerContactPhone: (project.centerContactPhone || '').trim(),
      centerContactEmail: (project.centerContactEmail || '').trim(),
      internalNotes: (project.internalNotes || '').trim(),
      status: project.status || existingProject.status || 'ON_SALE',
      // 銷售素材
      coverImage: (project.coverImage || '').trim(),
      exteriorImages: Array.isArray(project.exteriorImages) ? project.exteriorImages : [],
      realImages: Array.isArray(project.realImages) ? project.realImages : [],
      amenityImages: Array.isArray(project.amenityImages) ? project.amenityImages : [],
      sampleHouseImages: Array.isArray(project.sampleHouseImages) ? project.sampleHouseImages : [],
      floorPlans: Array.isArray(project.floorPlans) ? project.floorPlans : [],
      layoutPlans: Array.isArray(project.layoutPlans) ? project.layoutPlans : [],
      specifications: (project.specifications || '').trim(),
      salesBrochure: (project.salesBrochure || '').trim(),
      updatedAt: nowIso,
    };

    await db.collection('projects').updateOne(
      { $or: [{ _id: projectId as any }, { id: projectId }] },
      { $set: updatedData }
    );

    // 重新校正可售戶數
    const counts = await recalculateProjectUnits(db, projectId);
    updatedData.totalUnits = counts.totalUnits;
    updatedData.availableUnits = counts.availableUnits;
    updatedData.id = projectId;

    await recordAudit(
      db,
      'UPDATE_PROJECT',
      'Project',
      projectId,
      operator,
      `代銷中心更新建案 [${updatedData.name}] 資料，狀態變更為 [${updatedData.status}]`
    );

    res.json({ success: true, project: updatedData });
  } catch (err: any) {
    console.error('PUT /projects/:projectId error:', err?.message || err);
    res.status(500).json({ error: '更新建案資料失敗：' + (err?.message || '伺服器內部錯誤') });
  }
});

// 6.3 快速變更建案狀態 (草稿、上架、暫停、結案)
apiRouter.put('/projects/:projectId/status', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { status } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const nowIso = new Date().toISOString();

    const allowedStatuses = ['DRAFT', 'ON_SALE', 'PAUSED', 'CLOSED'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `無效的建案狀態，允許值為：${allowedStatuses.join(', ')}` });
    }

    const existingProject = await db.collection('projects').findOne({
      $or: [{ _id: projectId as any }, { id: projectId }],
    });
    if (!existingProject) {
      return res.status(404).json({ error: '找不到欲變更狀態之建案' });
    }

    await db.collection('projects').updateOne(
      { $or: [{ _id: projectId as any }, { id: projectId }] },
      { $set: { status, updatedAt: nowIso } }
    );

    await recordAudit(
      db,
      'UPDATE_PROJECT_STATUS',
      'Project',
      projectId,
      operator,
      `變更建案 [${existingProject.name}] 狀態由 [${existingProject.status}] 調整為 [${status}]`
    );

    res.json({ success: true, status, projectId });
  } catch (err: any) {
    console.error('PUT /projects/:projectId/status error:', err?.message || err);
    res.status(500).json({ error: '變更建案狀態失敗' });
  }
});

// 6.4 新增戶別 (僅代銷中心，落實 6 大業務守則)
apiRouter.post('/units', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { unit } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const nowIso = new Date().toISOString();

    if (!unit || !unit.projectId) {
      return res.status(400).json({ error: '請指定所屬建案代碼' });
    }
    const building = (unit.building || '').trim();
    const unitNumber = (unit.unitNumber || '').trim();
    if (!building || !unitNumber) {
      return res.status(400).json({ error: '棟別與戶號皆為必填欄位' });
    }

    // 規則 1：同建案的「棟別＋戶號」不可重複
    const duplicate = await db.collection('units').findOne({
      projectId: unit.projectId,
      building,
      unitNumber,
      status: { $ne: 'DISABLED' },
    });
    if (duplicate) {
      return res.status(400).json({
        error: `同建案已有相同的棟別與戶號（${building}棟 ${unitNumber}），不可重複建立。`,
      });
    }

    // 規則 2：金額不得為負值；缺漏金額不能當成 0
    if (unit.listPrice === undefined || unit.listPrice === null || unit.listPrice === '') {
      return res.status(400).json({ error: '請填寫總開價金額，缺漏金額不得直接視為 0。' });
    }
    const listPrice = Number(unit.listPrice);
    if (isNaN(listPrice) || listPrice < 0) {
      return res.status(400).json({ error: '總開價必須為大於或等於 0 之數值，不可為負值。' });
    }

    let housePrice = unit.housePrice !== undefined && unit.housePrice !== null && unit.housePrice !== '' ? Number(unit.housePrice) : undefined;
    if (housePrice !== undefined && (isNaN(housePrice) || housePrice < 0)) {
      return res.status(400).json({ error: '房屋開價必須為數值且不得為負值。' });
    }

    let parkingPrice = unit.parkingPrice !== undefined && unit.parkingPrice !== null && unit.parkingPrice !== '' ? Number(unit.parkingPrice) : undefined;
    if (parkingPrice !== undefined && (isNaN(parkingPrice) || parkingPrice < 0)) {
      return res.status(400).json({ error: '車位價格必須為數值且不得為負值。' });
    }

    let bottomPrice = unit.bottomPrice !== undefined && unit.bottomPrice !== null && unit.bottomPrice !== '' ? Number(unit.bottomPrice) : undefined;
    if (bottomPrice !== undefined && (isNaN(bottomPrice) || bottomPrice < 0)) {
      return res.status(400).json({ error: '底價必須為數值且不得為負值。' });
    }

    // 規則 3：明確區分總價含車位或車位另計，避免重複加總
    const includesParking = Boolean(unit.includesParking);

    // 格局組合字串相容
    const bedrooms = unit.bedrooms !== undefined ? Number(unit.bedrooms) : undefined;
    const livingRooms = unit.livingRooms !== undefined ? Number(unit.livingRooms) : undefined;
    const bathrooms = unit.bathrooms !== undefined ? Number(unit.bathrooms) : undefined;
    const pattern = unit.pattern || (bedrooms ? `${bedrooms}房${livingRooms || 0}廳${bathrooms || 1}衛` : '');

    // 總坪數相容
    const totalPing = unit.totalPing !== undefined ? Number(unit.totalPing) : (unit.areaPings ? Number(unit.areaPings) : 0);

    const unitId = unit.id || `u_${unit.projectId}_${building}_${unitNumber}_${Date.now()}`;
    const newUnit = {
      _id: unitId as any,
      id: unitId,
      projectId: unit.projectId,
      building,
      unitNumber,
      floor: Number(unit.floor) || 1,
      pattern,
      bedrooms,
      livingRooms,
      bathrooms,
      areaPings: totalPing,
      totalPing,
      includesParking,
      mainPing: unit.mainPing ? Number(unit.mainPing) : undefined,
      subPing: unit.subPing ? Number(unit.subPing) : undefined,
      commonPing: unit.commonPing ? Number(unit.commonPing) : undefined,
      parkingPing: unit.parkingPing ? Number(unit.parkingPing) : undefined,
      parkingInfo: unit.parkingInfo || (unit.parkingNumber ? `${unit.parkingNumber} (${unit.parkingType || '平面式'})` : ''),
      parkingNumber: (unit.parkingNumber || '').trim(),
      parkingType: (unit.parkingType || '').trim(),
      housePrice,
      parkingPrice,
      listPrice,
      bottomPrice,
      status: unit.status || 'AVAILABLE',
      notes: (unit.notes || '').trim(),
      isDemo: operator.isDemo === true,
      createdAt: unit.createdAt || nowIso,
      updatedAt: nowIso,
    };

    await db.collection('units').updateOne(
      { _id: unitId as any },
      { $set: newUnit },
      { upsert: true }
    );

    // 規則 4：可售戶數由戶別資料計算，不以手動數字代替
    await recalculateProjectUnits(db, unit.projectId);

    await recordAudit(
      db,
      'CREATE_UNIT',
      'Unit',
      unitId,
      operator,
      `新增建案 [${unit.projectId}] 銷售戶別 [${building}棟 ${unitNumber}]，總開價：${(listPrice / 10000).toLocaleString('zh-TW')} 萬元`
    );

    res.json({ success: true, unit: newUnit });
  } catch (err: any) {
    console.error('POST /units error:', err?.message || err);
    res.status(500).json({ error: '儲存戶別失敗：' + (err?.message || '伺服器內部錯誤') });
  }
});

// 6.5 更新戶別 (僅代銷中心，落實 6 大業務守則)
apiRouter.put('/units/:unitId', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { unitId } = req.params;
    const { unit } = req.body;
    const operator = (req as any).user;
    const db = await getDb();
    const nowIso = new Date().toISOString();

    const existingUnit = await db.collection('units').findOne({
      $or: [{ _id: unitId as any }, { id: unitId }],
    });
    if (!existingUnit) {
      return res.status(404).json({ error: '找不到欲修改之戶別' });
    }

    const building = (unit.building || existingUnit.building || '').trim();
    const unitNumber = (unit.unitNumber || existingUnit.unitNumber || '').trim();
    if (!building || !unitNumber) {
      return res.status(400).json({ error: '棟別與戶號皆為必填' });
    }

    // 規則 1：同建案的「棟別＋戶號」不可重複 (排除自身與 DISABLED 戶別)
    const duplicate = await db.collection('units').findOne({
      projectId: existingUnit.projectId,
      building,
      unitNumber,
      _id: { $ne: existingUnit._id },
      status: { $ne: 'DISABLED' },
    });
    if (duplicate) {
      return res.status(400).json({
        error: `同建案已有相同的棟別與戶號（${building}棟 ${unitNumber}），不可重複！`,
      });
    }

    // 規則 5：已有交易的戶別，沿用交易流程管理狀態，不可用一般編輯繞過審核
    const activeTx = await db.collection('transactions').findOne({
      unitId,
      status: {
        $in: [
          'PENDING_DEPOSIT',
          'CONFIRMED_DEPOSIT',
          'PENDING_CONTRACT',
          'CONFIRMED_CONTRACT',
          'PENDING_DEAL',
          'CONFIRMED_DEAL',
        ],
      },
    });
    if (activeTx && unit.status && unit.status !== existingUnit.status) {
      return res.status(400).json({
        error: `該戶別目前已有審核中或進行中的交易紀錄（交易編號：${activeTx.id}，狀態：${activeTx.status}），戶別狀態受交易審核流程監管，不可透過一般戶別編輯直接變更。`,
      });
    }

    // 規則 2：金額不得為負值；缺漏金額不能當成 0
    if (unit.listPrice === undefined || unit.listPrice === null || unit.listPrice === '') {
      return res.status(400).json({ error: '請填寫總開價金額，缺漏金額不得直接視為 0。' });
    }
    const listPrice = Number(unit.listPrice);
    if (isNaN(listPrice) || listPrice < 0) {
      return res.status(400).json({ error: '總開價必須為大於或等於 0 之數值，不可為負值。' });
    }

    let housePrice = unit.housePrice !== undefined && unit.housePrice !== null && unit.housePrice !== '' ? Number(unit.housePrice) : undefined;
    if (housePrice !== undefined && (isNaN(housePrice) || housePrice < 0)) {
      return res.status(400).json({ error: '房屋開價必須為數值且不得為負值。' });
    }

    let parkingPrice = unit.parkingPrice !== undefined && unit.parkingPrice !== null && unit.parkingPrice !== '' ? Number(unit.parkingPrice) : undefined;
    if (parkingPrice !== undefined && (isNaN(parkingPrice) || parkingPrice < 0)) {
      return res.status(400).json({ error: '車位價格必須為數值且不得為負值。' });
    }

    let bottomPrice = unit.bottomPrice !== undefined && unit.bottomPrice !== null && unit.bottomPrice !== '' ? Number(unit.bottomPrice) : undefined;
    if (bottomPrice !== undefined && (isNaN(bottomPrice) || bottomPrice < 0)) {
      return res.status(400).json({ error: '底價必須為數值且不得為負值。' });
    }

    const bedrooms = unit.bedrooms !== undefined ? Number(unit.bedrooms) : existingUnit.bedrooms;
    const livingRooms = unit.livingRooms !== undefined ? Number(unit.livingRooms) : existingUnit.livingRooms;
    const bathrooms = unit.bathrooms !== undefined ? Number(unit.bathrooms) : existingUnit.bathrooms;
    const pattern = unit.pattern || (bedrooms ? `${bedrooms}房${livingRooms || 0}廳${bathrooms || 1}衛` : existingUnit.pattern);
    const totalPing = unit.totalPing !== undefined ? Number(unit.totalPing) : (unit.areaPings ? Number(unit.areaPings) : existingUnit.totalPing || existingUnit.areaPings);

    const updatedUnit = {
      building,
      unitNumber,
      floor: Number(unit.floor) || existingUnit.floor || 1,
      pattern,
      bedrooms,
      livingRooms,
      bathrooms,
      areaPings: totalPing,
      totalPing,
      includesParking: Boolean(unit.includesParking),
      mainPing: unit.mainPing ? Number(unit.mainPing) : undefined,
      subPing: unit.subPing ? Number(unit.subPing) : undefined,
      commonPing: unit.commonPing ? Number(unit.commonPing) : undefined,
      parkingPing: unit.parkingPing ? Number(unit.parkingPing) : undefined,
      parkingInfo: unit.parkingInfo || (unit.parkingNumber ? `${unit.parkingNumber} (${unit.parkingType || '平面式'})` : existingUnit.parkingInfo),
      parkingNumber: (unit.parkingNumber || '').trim(),
      parkingType: (unit.parkingType || '').trim(),
      housePrice,
      parkingPrice,
      listPrice,
      bottomPrice,
      status: unit.status || existingUnit.status,
      notes: (unit.notes || '').trim(),
      updatedAt: nowIso,
    };

    await db.collection('units').updateOne(
      { $or: [{ _id: unitId as any }, { id: unitId }] },
      { $set: updatedUnit }
    );

    // 規則 4：動態重新計算可售戶數
    await recalculateProjectUnits(db, existingUnit.projectId);

    await recordAudit(
      db,
      'UPDATE_UNIT',
      'Unit',
      unitId,
      operator,
      `代銷中心更新戶別 [${building}棟 ${unitNumber}] 資料，狀態：${updatedUnit.status}，總開價：${(listPrice / 10000).toLocaleString('zh-TW')} 萬元`
    );

    res.json({ success: true, unit: { ...existingUnit, ...updatedUnit, id: unitId } });
  } catch (err: any) {
    console.error('PUT /units/:unitId error:', err?.message || err);
    res.status(500).json({ error: '更新戶別失敗：' + (err?.message || '伺服器內部錯誤') });
  }
});

// 6.6 刪除或停用戶別 (規則 6：有關聯紀錄的戶別不可直接刪除，改為停用並保留歷程)
apiRouter.delete('/units/:unitId', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { unitId } = req.params;
    const operator = (req as any).user;
    const db = await getDb();
    const nowIso = new Date().toISOString();

    const existingUnit = await db.collection('units').findOne({
      $or: [{ _id: unitId as any }, { id: unitId }],
    });
    if (!existingUnit) {
      return res.status(404).json({ error: '找不到欲操作之戶別' });
    }

    // 檢查是否有任何交易、帶看或意向預約等關聯紀錄
    const [hasTx, hasViewing, hasReg] = await Promise.all([
      db.collection('transactions').findOne({ unitId }),
      db.collection('viewings').findOne({ unitId }),
      db.collection('registrations').findOne({ intendedUnitId: unitId }),
    ]);

    if (hasTx || hasViewing || hasReg) {
      // 規則 6：轉為 DISABLED 停用並保留歷程
      await db.collection('units').updateOne(
        { $or: [{ _id: unitId as any }, { id: unitId }] },
        { $set: { status: 'DISABLED', updatedAt: nowIso } }
      );

      await recordAudit(
        db,
        'DISABLE_UNIT',
        'Unit',
        unitId,
        operator,
        `戶別 [${existingUnit.building}棟 ${existingUnit.unitNumber}] 具關聯交易/帶看/預約歷程，系統自動轉為停用 (DISABLED) 並完整保留稽核歷史。`
      );

      await recalculateProjectUnits(db, existingUnit.projectId);

      return res.json({
        success: true,
        action: 'DISABLED',
        message: '此戶別已有交易申報或客戶意向關聯歷程，依規章不得物理刪除，已轉為「停用 (DISABLED)」狀態並永久保留歷程。',
      });
    }

    // 無關聯紀錄，安全實體刪除
    await db.collection('units').deleteOne({
      $or: [{ _id: unitId as any }, { id: unitId }],
    });

    await recordAudit(
      db,
      'DELETE_UNIT',
      'Unit',
      unitId,
      operator,
      `代銷中心刪除未有關聯紀錄之新開戶別 [${existingUnit.building}棟 ${existingUnit.unitNumber}]`
    );

    await recalculateProjectUnits(db, existingUnit.projectId);

    res.json({
      success: true,
      action: 'DELETED',
      message: '戶別已成功刪除。',
    });
  } catch (err: any) {
    console.error('DELETE /units/:unitId error:', err?.message || err);
    res.status(500).json({ error: '刪除戶別失敗：' + (err?.message || '伺服器內部錯誤') });
  }
});

// 7. 新增客戶並登記建案 (含防重複點擊、原子約束、跨門店衝突判定與不可變分佣快照鎖定)
apiRouter.post('/customers/register', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const operator = (req as any).user;
    const {
      customerName,
      phone,
      email,
      source,
      budgetMin,
      budgetMax,
      roomsRequired,
      parkingRequired,
      preferredDistricts,
      purchasePurpose,
      expectedPurchaseTime,
      projectId,
      intendedUnitId,
      notes,
    } = req.body;

    // 後端驗證欄位必填
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: '客戶稱呼為必填欄位' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: '聯絡電話為必填欄位' });
    }
    if (!projectId) {
      return res.status(400).json({ error: '意向建案為必填欄位' });
    }

    // 預算上下限驗證
    const numBudgetMin = budgetMin !== undefined && budgetMin !== '' ? Number(budgetMin) : undefined;
    const numBudgetMax = budgetMax !== undefined && budgetMax !== '' ? Number(budgetMax) : undefined;
    if (numBudgetMin !== undefined && numBudgetMin < 0) {
      return res.status(400).json({ error: '預算下限不得小於 0 萬元' });
    }
    if (numBudgetMax !== undefined && numBudgetMax < 0) {
      return res.status(400).json({ error: '預算上限不得小於 0 萬元' });
    }
    if (numBudgetMin !== undefined && numBudgetMax !== undefined && numBudgetMax < numBudgetMin) {
      return res.status(400).json({ error: '預算上限不得低於預算下限' });
    }

    const db = await getDb();
    const cleanPhone = normalizeContactPhone(phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      return res.status(400).json({ error: '請輸入正確的客戶聯絡電話（至少8碼以上有效數字）' });
    }

    // 安全零信任：依角色規範承辦門店與負責業務
    let storeId: string;
    let agentId: string;

    if (operator.role === 'agent') {
      // 業務同仁：由後端自動帶入所屬門店及本人為負責業務，前端無法篡改
      storeId = operator.storeId;
      agentId = operator.id;
    } else if (operator.role === 'store_manager') {
      // 店長：固定為本店，可選擇本店啟用中（ACTIVE）的業務負責，不可指定其他門店人員
      storeId = operator.storeId;
      if (req.body.agentId && req.body.agentId !== operator.id) {
        const assignedAgent = await db.collection('users').findOne({
          $or: [{ id: req.body.agentId }, { _id: req.body.agentId as any }],
        });
        if (!assignedAgent || assignedAgent.storeId !== operator.storeId || assignedAgent.status !== 'ACTIVE') {
          return res.status(400).json({ error: '店長僅能指定所屬門店啟用中（ACTIVE）之業務同仁負責' });
        }
        agentId = assignedAgent.id || assignedAgent._id;
      } else {
        agentId = operator.id; // 店長自辦
      }
    } else if (operator.role === 'center_admin') {
      // 代銷中心：可替指定門店與業務同仁登記
      storeId = req.body.storeId || operator.storeId;
      agentId = req.body.agentId || operator.id;
    } else {
      return res.status(403).json({ error: '目前角色無權限執行客戶登記' });
    }

    if (!storeId && operator.role !== 'center_admin') {
      return res.status(400).json({ error: '您的帳號尚未綁定有效門店，無法執行客戶登記' });
    }

    // 檢查建案是否存在且狀態為 ON_SALE
    const project = await db.collection('projects').findOne({ $or: [{ id: projectId }, { _id: projectId as any }] });
    if (!project) {
      return res.status(404).json({ error: '找不到指定建案' });
    }
    if (project.status !== 'ON_SALE') {
      return res.status(400).json({ error: `該建案目前非上架中狀態（當前狀態：${project.status}），無法進行新客戶登記` });
    }

    // 檢查門店是否獲建案授權聯銷且指派狀態為 ACTIVE
    if (operator.role !== 'center_admin') {
      const assignment = await db.collection('assignments').findOne({
        projectId,
        storeId,
        status: 'ACTIVE',
      });
      if (!assignment) {
        return res.status(403).json({ error: '貴門店對此建案之聯銷授權非有效中（可能未獲指派、已暫停或已撤銷），無法進行客戶登記' });
      }
    }

    // 嚴格檢查生效且完整的分佣方案：若無生效且完整條件，阻擋登記並提示聯絡中心，不自行使用0或預設比例
    let activeCommissionVersion = null;
    if (project.currentCommissionVersionId) {
      activeCommissionVersion = await db.collection('commission_versions').findOne({
        $or: [{ id: project.currentCommissionVersionId }, { _id: project.currentCommissionVersionId as any }],
      });
    }
    if (!activeCommissionVersion) {
      activeCommissionVersion = await db
        .collection('commission_versions')
        .find({ projectId })
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
    }

    const hasCompleteCommission =
      activeCommissionVersion &&
      activeCommissionVersion.formulaType &&
      ((activeCommissionVersion.formulaType === 'PERCENTAGE_TOTAL' && activeCommissionVersion.percentage) ||
        (activeCommissionVersion.formulaType === 'FIXED_AMOUNT' && activeCommissionVersion.fixedAmount)) &&
      activeCommissionVersion.storePercentage !== undefined &&
      activeCommissionVersion.storePercentage !== null &&
      activeCommissionVersion.centerPercentage !== undefined &&
      activeCommissionVersion.centerPercentage !== null;

    if (!hasCompleteCommission || !activeCommissionVersion) {
      return res.status(400).json({
        error: '該建案尚無已生效且完整的分佣方案，無法進行客戶登記，請聯絡代銷中心設定建案分佣方案。',
      });
    }

    // 防呆/防重複點擊/網路重試：檢查 15 秒內是否已有相同電話與建案之登記請求
    const recentDuplicate = await db.collection('registrations').findOne({
      phone: cleanPhone,
      projectId,
      createdAt: { $gte: new Date(Date.now() - 15000).toISOString() },
    });
    if (recentDuplicate) {
      return res.status(400).json({ error: '系統已在 15 秒內處理過此客戶此建案之登記，請勿重複點擊！' });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. 查找或建立客戶基本資料 (基本識別資料與建案專屬登記分開保存)
    let customer: any = await db.collection('customers').findOne({ phone: cleanPhone });
    if (!customer) {
      const customerId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      customer = {
        _id: customerId as any,
        id: customerId,
        name: customerName.trim(),
        phone: cleanPhone,
        email: email ? email.trim() : '',
        source: source || '門店在地轉介',
        isDemo: operator.isDemo === true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await db.collection('customers').insertOne(customer);
    }
    const customerDbId = customer.id || customer._id;

    // 2. 衝突與重複檢核 (使用後端正規化電話比對同建案既有登記)
    // 規則：
    // - 同案已有有效保留時，新申請進入「歸屬待判定」，不得建立第二筆有效保留
    // - 原登記已到期時，也由中心確認後決定是否重新登記；原保留到期後不得自動轉給其他門店
    // - 同一客戶可在不同建案分別登記，各自計算保留及分佣條件
    const existingSameProjectRegs = await db
      .collection('registrations')
      .find({
        $or: [{ phone: cleanPhone, projectId }, { customerId: customerDbId, projectId }],
      })
      .sort({ createdAt: 1 })
      .toArray();

    // 檢查是否有同案有效保留（ACTIVE 或 EXPIRING_SOON）
    const activeConflict = existingSameProjectRegs.find((r: any) => {
      const calc = calculateReservationStatus(r, now);
      return calc.status === 'ACTIVE' || calc.status === 'EXPIRING_SOON';
    });

    // 檢查是否已有尚未判定的衝突申請 (CONFLICT_PENDING)
    const pendingConflict = existingSameProjectRegs.find((r: any) => {
      const calc = calculateReservationStatus(r, now);
      return calc.status === 'CONFLICT_PENDING';
    });

    // 依規章「到期後重登」：原保留到期後不自動轉給其他門店，任何門店（含原門店）可重新為客戶送件，重新起算30天
    // 故僅於存在有效保留中或待判定之衝突時，才觸發 CONFLICT_PENDING 判定程序
    const isConflict = Boolean(activeConflict || pendingConflict);
    const conflictingRecord = activeConflict || pendingConflict;

    // 若先前曾有過期保留，確保其 isActiveReservation 為 false，避免原子索引衝突
    if (!isConflict) {
      await db.collection('registrations').updateMany(
        {
          $or: [{ phone: cleanPhone, projectId }, { customerId: customerDbId, projectId }],
          isActiveReservation: true,
        },
        { $set: { isActiveReservation: false, status: 'EXPIRED', updatedAt: nowIso } }
      );
    }

    const registrationId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 3. 建立不可覆寫分佣快照 (保存送件當時完整條件)
    // 歸屬待判定申請：保存送件當時完整條件，標示為待核定 (PENDING_APPROVAL)，尚未取得保留權益
    const snapshotStatus = isConflict ? 'PENDING_APPROVAL' : 'ACTIVE';
    const snapshot: any = {
      _id: snapshotId,
      id: snapshotId,
      customerRegistrationId: registrationId,
      projectId,
      versionId: activeCommissionVersion.id || activeCommissionVersion._id,
      versionNumber: activeCommissionVersion.versionNumber || 'V1.0',
      effectiveDate: activeCommissionVersion.effectiveDate || activeCommissionVersion.createdAt || nowIso,
      lockedAt: nowIso,
      formulaType: activeCommissionVersion.formulaType,
      percentage: activeCommissionVersion.percentage,
      fixedAmount: activeCommissionVersion.fixedAmount,
      calculationBase: activeCommissionVersion.formulaType === 'PERCENTAGE_TOTAL' ? '成交總價' : '固定每戶',
      centerPercentage: activeCommissionVersion.centerPercentage,
      storePercentage: activeCommissionVersion.storePercentage,
      applicableConditions: activeCommissionVersion.applicableConditions || '需完成聯銷報備合約成約',
      status: snapshotStatus,
      basisDescription: `客戶入案登記時自動鎖定之分佣快照 [${activeCommissionVersion.versionNumber || 'V1.0'}]`,
      isDemo: operator.isDemo === true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await db.collection('commission_snapshots').insertOne(snapshot);

    // 4. 建立登記紀錄 (30 天專屬保護期，以客戶＋建案為單位)
    // 客戶保留不等於戶別保留，戶別僅為意向記錄
    const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const newReg: any = {
      _id: registrationId,
      id: registrationId,
      customerId: customerDbId,
      phone: cleanPhone,
      projectId,
      intendedUnitId: intendedUnitId || undefined,
      storeId,
      agentId,
      status: isConflict ? 'CONFLICT_PENDING' : 'ACTIVE',
      reservationStartDate: nowIso,
      reservationExpiryDate: expiryDate,
      notes: notes ? notes.trim() : '',
      // 購屋需求保存於本次專屬登記中，不覆寫其他門店登記
      budgetMin: numBudgetMin,
      budgetMax: numBudgetMax,
      roomsRequired: roomsRequired || undefined,
      parkingRequired: parkingRequired || undefined,
      preferredDistricts: preferredDistricts ? preferredDistricts.trim() : undefined,
      purchasePurpose: purchasePurpose || undefined,
      expectedPurchaseTime: expectedPurchaseTime || undefined,
      source: source || '門店在地轉介',
      commissionSnapshotId: snapshotId,
      conflictOriginalRegId: isConflict && conflictingRecord ? (conflictingRecord.id || conflictingRecord._id) : undefined,
      conflictHistory: isConflict
        ? [
            {
              action: 'SUBMITTED',
              timestamp: nowIso,
              operatorId: operator.id,
              operatorName: operator.name,
              reason: '偵測到同客戶於該建案已有既有保留登記，本件送交代銷中心歸屬判定',
            },
          ]
        : [],
      isActiveReservation: !isConflict, // 原子唯一索引旗標
      isDemo: operator.isDemo === true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 5. 資料一致性：以資料庫約束處理同時登記（捕獲原子唯一索引衝突）
    let actualConflict = isConflict;
    try {
      await db.collection('registrations').insertOne(newReg);
    } catch (insertErr: any) {
      if (insertErr.code === 11000) {
        // 並發衝突：同一毫秒內另一請求已先建立有效保留，本筆自動降級為歸屬待判定
        actualConflict = true;
        newReg.status = 'CONFLICT_PENDING';
        newReg.isActiveReservation = false;
        newReg.conflictHistory = [
          {
            action: 'SUBMITTED',
            timestamp: nowIso,
            operatorId: operator.id,
            operatorName: operator.name,
            reason: '並發登記唯一約束生效：同電話同建案已有同時登記成立，本件轉為歸屬待判定',
          },
        ];
        await db.collection('commission_snapshots').updateOne(
          { id: snapshotId },
          { $set: { status: 'PENDING_APPROVAL' } }
        );
        await db.collection('registrations').insertOne(newReg);
      } else {
        throw insertErr;
      }
    }

    // 6. 稽核日誌
    await recordAudit(
      db,
      actualConflict ? 'CONFLICT_REGISTRATION_LOCKED' : 'REGISTER_CUSTOMER_PROJECT',
      'CustomerRegistration',
      registrationId,
      operator,
      actualConflict
        ? `偵測同電話客戶於此建案已有既有登記紀錄，系統已送交代銷中心歸屬判定`
        : `門店 [${storeId}] 營業員登記客戶 [${customerName.trim()}] 意向建案 [${project.name}]，取得30天專屬保留期至 ${expiryDate.substring(0, 10)}`,
      storeId
    );

    // 7. 門店端回應隱私保護：
    // 規則：門店只看到特定提示訊息，不透露其他門店、業務或客戶明細
    const responseReg = { ...newReg };
    if (operator.role !== 'center_admin') {
      delete responseReg.conflictOriginalRegId;
    }

    let responseMessage = '客戶登記成功！已取得 30 天專屬保護期與不可變分佣快照。';
    if (actualConflict) {
      const isSameStore = conflictingRecord && conflictingRecord.storeId === storeId;
      const expDate = conflictingRecord?.reservationExpiryDate ? formatDateTaipei(conflictingRecord.reservationExpiryDate) : '30日內';

      if (isSameStore) {
        responseMessage = '本店已有同仁登記，是否由原業務繼續服務或進行內部移轉？案件已送交代銷中心備查。';
      } else {
        responseMessage = `該客戶於此建案已有保留中記錄（保留至 ${expDate}），若有爭議請洽代銷中心。案件已送交代銷中心進行歸屬判定。`;
      }
    }

    res.json({
      success: true,
      registration: responseReg,
      isConflict: actualConflict,
      message: responseMessage,
    });
  } catch (err: any) {
    console.error('POST /customers/register error:', err?.message || err);
    res.status(500).json({ error: '登記客戶建案失敗，請稍後重試' });
  }
});

// 8. 解決重複登記衝突 (代銷中心核准或駁回)
apiRouter.post('/registrations/resolve-conflict', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { conflictRegId, action = 'APPROVE', assignToStoreId, assignToAgentId, resolutionReason } = req.body;
    const operator = (req as any).user;
    const db = await getDb();

    if (!resolutionReason || !resolutionReason.trim()) {
      return res.status(400).json({ error: '請填寫裁定具體理由' });
    }

    const conflictReg = await db.collection('registrations').findOne({
      $or: [{ id: conflictRegId }, { _id: conflictRegId }],
    });
    if (!conflictReg) {
      return res.status(404).json({ error: '找不到待裁定之衝突登記紀錄' });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (action === 'REJECT') {
      // 駁回爭議申請：不產生有效保留，原保留維持不變
      await db.collection('registrations').updateOne(
        { _id: conflictReg._id },
        {
          $set: {
            status: 'REJECTED',
            isActiveReservation: false,
            conflictResolutionNote: `代銷中心裁定駁回：${resolutionReason.trim()}`,
            updatedAt: nowIso,
          },
          $push: {
            conflictHistory: {
              action: 'REJECTED',
              timestamp: nowIso,
              operatorId: operator.id,
              operatorName: operator.name,
              reason: resolutionReason.trim(),
            },
          } as any,
        }
      );

      // 快照標示為 REJECTED
      await db.collection('commission_snapshots').updateOne(
        { customerRegistrationId: conflictReg.id || conflictReg._id },
        { $set: { status: 'REJECTED', updatedAt: nowIso } }
      );

      await recordAudit(
        db,
        'REJECT_REGISTRATION_CONFLICT',
        'CustomerRegistration',
        conflictRegId,
        operator,
        `代銷中心駁回門店 [${conflictReg.storeId}] 重複登記申請。理由：${resolutionReason.trim()}`
      );

      return res.json({ success: true, message: '已駁回該重複登記申請，不產生有效保留' });
    }

    // 核准爭議申請 (APPROVE)：
    // 規則：核准前重新檢查衝突；若需終止原保留，必須明確記錄，不可默默覆寫。
    // 爭議申請核准後，保留期從核准生效時間起算30天。
    const targetStoreId = assignToStoreId || conflictReg.storeId;
    const targetAgentId = assignToAgentId || conflictReg.agentId;
    const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 重新檢查同電話同建案是否有其他目前有效中的保留，若有則明確終止並記錄歷程
    const activeConflicts = await db.collection('registrations').find({
      phone: conflictReg.phone,
      projectId: conflictReg.projectId,
      id: { $ne: conflictReg.id },
      isActiveReservation: true,
    }).toArray();

    for (const activeOrig of activeConflicts) {
      await db.collection('registrations').updateOne(
        { _id: activeOrig._id },
        {
          $set: {
            status: 'EXPIRED',
            isActiveReservation: false,
            conflictResolutionNote: `代銷中心於 ${nowIso.substring(0, 10)} 裁定終止本案原保留，改由門店 [${targetStoreId}] 承辦。裁定依據：${resolutionReason.trim()}`,
            updatedAt: nowIso,
          },
          $push: {
            conflictHistory: {
              action: 'SUPERSEDED',
              timestamp: nowIso,
              operatorId: operator.id,
              operatorName: operator.name,
              reason: `代銷中心裁定終止保留，改歸屬門店 [${targetStoreId}]：${resolutionReason.trim()}`,
            },
          } as any,
        }
      );

      await recordAudit(
        db,
        'TERMINATE_PREVIOUS_RESERVATION',
        'CustomerRegistration',
        activeOrig.id || activeOrig._id,
        operator,
        `代銷中心因裁定核准新申請，明確終止門店 [${activeOrig.storeId}] 之原保留。裁定理由：${resolutionReason.trim()}`
      );
    }

    // 核准新申請，保留期自核准生效時間起算 30 天
    await db.collection('registrations').updateOne(
      { _id: conflictReg._id },
      {
        $set: {
          storeId: targetStoreId,
          agentId: targetAgentId,
          status: 'ACTIVE',
          isActiveReservation: true,
          reservationStartDate: nowIso,
          reservationExpiryDate: newExpiry,
          conflictResolutionNote: `代銷中心裁定核准生效：${resolutionReason.trim()}`,
          updatedAt: nowIso,
        },
        $push: {
          conflictHistory: {
            action: 'APPROVED',
            timestamp: nowIso,
            operatorId: operator.id,
            operatorName: operator.name,
            reason: resolutionReason.trim(),
          },
        } as any,
      }
    );

    // 沿用送件時快照條件，啟用為有效快照
    await db.collection('commission_snapshots').updateOne(
      { customerRegistrationId: conflictReg.id || conflictReg._id },
      { $set: { status: 'ACTIVE', updatedAt: nowIso } }
    );

    await recordAudit(
      db,
      'RESOLVE_REGISTRATION_CONFLICT',
      'CustomerRegistration',
      conflictRegId,
      operator,
      `代銷中心完成歸屬裁定核准，歸屬門店 [${targetStoreId}] 業務 [${targetAgentId}]，保留期重起30天至 ${newExpiry.substring(0, 10)}。裁定理由：${resolutionReason.trim()}`
    );

    res.json({ success: true, message: '衝突已由代銷中心完成裁定，已重啟 30 天有效保留期並生效分佣快照' });
  } catch (err: any) {
    console.error('POST /registrations/resolve-conflict error:', err?.message || err);
    res.status(500).json({ error: '裁定重複登記失敗' });
  }
});

// 9. 新增追蹤紀錄 (具備業務範圍隔絕與有效追蹤判定)
apiRouter.post('/follow-ups', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const operator = (req as any).user;
    const {
      customerRegistrationId,
      method,
      summary,
      customerResponse,
      nextStep,
      nextFollowUpDate,
    } = req.body;

    const db = await getDb();
    const reg = await db.collection('registrations').findOne({
      $or: [{ id: customerRegistrationId }, { _id: customerRegistrationId }],
    });
    if (!reg) {
      return res.status(404).json({ error: '找不到對應之客戶登記紀錄' });
    }

    // 權限檢查：業務不能修改或新增其他業務名下客戶的追蹤紀錄！店長僅可管理本店！
    if (operator.role === 'agent' && reg.agentId !== operator.id) {
      return res.status(403).json({ error: '權限不足：業務同仁不可為其他業務名下的客戶填寫追蹤' });
    }
    if (operator.role === 'store_manager' && reg.storeId !== operator.storeId) {
      return res.status(403).json({ error: '權限不足：店長僅可填寫管理本店指派之客戶追蹤' });
    }

    const nowIso = new Date().toISOString();

    // 業務規則：判定是否為「有效追蹤」
    const isEffective =
      Boolean(customerResponse && customerResponse.trim().length > 3) &&
      Boolean(nextStep && nextStep.trim().length > 2);

    const followUpId = `flw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newFollowUp: any = {
      _id: followUpId,
      id: followUpId,
      customerRegistrationId,
      storeId: reg.storeId,
      agentId: reg.agentId,
      contactTime: nowIso,
      method,
      summary,
      customerResponse,
      nextStep,
      nextFollowUpDate: nextFollowUpDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      recordedBy: operator.name,
      isEffectiveFollowUp: isEffective,
      isDemo: operator.isDemo === true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.collection('follow_ups').insertOne(newFollowUp);

    await recordAudit(
      db,
      'ADD_FOLLOW_UP',
      'FollowUp',
      followUpId,
      operator,
      `營業員填報客戶追蹤（${isEffective ? '符合有效追蹤規範' : '一般記錄'}）：${summary}`,
      reg.storeId
    );

    res.json({ success: true, followUp: newFollowUp, isEffective });
  } catch (err: any) {
    console.error('POST /follow-ups error:', err?.message || err);
    res.status(500).json({ error: '新增追蹤紀錄失敗' });
  }
});

// 10. 申請 30 天保留展期 (含 14 天有效追蹤前置條件檢查)
apiRouter.post('/renewals/apply', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const operator = (req as any).user;
    const { registrationId, reason } = req.body;
    const db = await getDb();

    const reg = await db.collection('registrations').findOne({
      $or: [{ id: registrationId }, { _id: registrationId }],
    });
    if (!reg) {
      return res.status(404).json({ error: '找不到欲展期之客戶登記紀錄' });
    }

    // 業務範圍權限檢查
    if (operator.role === 'agent' && reg.agentId !== operator.id) {
      return res.status(403).json({ error: '權限不足：您不能為其他業務的客戶申請展期' });
    }
    if (operator.role === 'store_manager' && reg.storeId !== operator.storeId) {
      return res.status(403).json({ error: '權限不足：店長僅可為本店客戶申請展期' });
    }

    // 檢查是否有待審核的申請
    const pending = await db.collection('renewals').findOne({
      customerRegistrationId: reg.id || reg._id,
      status: 'PENDING',
    });
    if (pending) {
      return res.status(400).json({ error: '該登記已有待審核中的展期申請，請勿重複送出' });
    }

    // 檢查 14 天內有效追蹤或帶看紀錄
    const followUps = await db
      .collection('follow_ups')
      .find({ customerRegistrationId: reg.id || reg._id })
      .toArray();
    const viewings = await db
      .collection('viewings')
      .find({ customerRegistrationId: reg.id || reg._id })
      .toArray();

    const eligibility = checkRenewalEligibility(
      reg.id || reg._id,
      followUps as any,
      viewings as any,
      false
    );

    if (!eligibility.eligible) {
      return res.status(400).json({
        error: `無法申請展期：${eligibility.reason}`,
      });
    }

    const renewalId = `rnw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newRenewal: any = {
      _id: renewalId,
      id: renewalId,
      customerRegistrationId: reg.id || reg._id,
      storeId: reg.storeId,
      agentId: reg.agentId,
      originalExpiryDate: reg.reservationExpiryDate,
      requestedDays: 30,
      reason,
      linkedRecordType: eligibility.validRecord?.type || 'followup',
      linkedRecordId: eligibility.validRecord?.id || 'auto_check',
      status: 'PENDING',
      isDemo: operator.isDemo === true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.collection('renewals').insertOne(newRenewal);

    await recordAudit(
      db,
      'APPLY_RENEWAL',
      'RenewalRequest',
      renewalId,
      operator,
      `門店 [${reg.storeId}] 營業員依有效追蹤要件申請客戶保留期展期 30 天。申請理由：${reason}`,
      reg.storeId
    );

    res.json({ success: true, renewal: newRenewal });
  } catch (err: any) {
    console.error('POST /renewals/apply error:', err?.message || err);
    res.status(500).json({ error: '送出展期申請失敗' });
  }
});

// 11. 審核 30 天保留展期 (代銷中心核准 / 駁回)
apiRouter.post('/renewals/:renewalId/review', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const { renewalId } = req.params;
    const { approved, reviewReason } = req.body;
    const operator = (req as any).user;
    const db = await getDb();

    const renewal = await db.collection('renewals').findOne({
      $or: [{ id: renewalId }, { _id: renewalId as any }],
    });
    if (!renewal) {
      return res.status(404).json({ error: '找不到指定之展期申請' });
    }

    // 僅代銷中心或該門店店長可審核
    if (operator.role !== 'center_admin' && (operator.role !== 'store_manager' || operator.storeId !== renewal.storeId)) {
      return res.status(403).json({ error: '權限不足：您無權審核此展期申請' });
    }

    const reg = await db.collection('registrations').findOne({
      $or: [{ id: renewal.customerRegistrationId }, { _id: renewal.customerRegistrationId }],
    });

    const nowIso = new Date().toISOString();
    let newExpiryDate: string | undefined;

    if (approved && reg) {
      newExpiryDate = calculateNewExpiryDate(reg.reservationExpiryDate, renewal.requestedDays || 30);
      await db.collection('registrations').updateOne(
        { _id: reg._id },
        {
          $set: {
            reservationExpiryDate: newExpiryDate,
            status: 'ACTIVE',
            updatedAt: nowIso,
          },
        }
      );
    }

    await db.collection('renewals').updateOne(
      { _id: renewal._id },
      {
        $set: {
          status: approved ? 'APPROVED' : 'REJECTED',
          reviewerId: operator.id,
          reviewerName: operator.name,
          reviewedAt: nowIso,
          reviewReason,
          newExpiryDate,
          updatedAt: nowIso,
        },
      }
    );

    await recordAudit(
      db,
      approved ? 'APPROVE_RENEWAL' : 'REJECT_RENEWAL',
      'RenewalRequest',
      renewalId,
      operator,
      approved
        ? `核准客戶展期申請，保留期自原日延長至 ${newExpiryDate?.substring(0, 10)}。審核意見：${reviewReason}`
        : `駁回客戶展期申請。駁回原因：${reviewReason}`,
      renewal.storeId
    );

    res.json({
      success: true,
      approved,
      newExpiryDate,
      message: approved ? '已核准展期並更新到期日' : '已駁回展期申請',
    });
  } catch (err: any) {
    console.error('POST /renewals/:renewalId/review error:', err?.message || err);
    res.status(500).json({ error: '審核展期失敗' });
  }
});

// 12. 帶看排程與回報
apiRouter.post('/viewings', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const operator = (req as any).user;
    const {
      customerRegistrationId,
      projectId,
      unitId,
      scheduledTime,
      status,
      receptionistName,
      customerFeedback,
      objections,
      nextStep,
    } = req.body;

    const db = await getDb();

    // 檢查門店聯銷指派是否有效
    if (operator.role !== 'center_admin') {
      const assignment = await db.collection('assignments').findOne({
        projectId,
        storeId: operator.storeId,
        status: 'ACTIVE',
      });
      if (!assignment) {
        return res.status(403).json({ error: '該建案之門店聯銷授權非有效中（可能已暫停或撤銷），無法預約帶看' });
      }
    }

    const viewingId = `view_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newViewing: any = {
      _id: viewingId,
      id: viewingId,
      customerRegistrationId,
      projectId,
      unitId: unitId || undefined,
      scheduledTime,
      status: status || 'SCHEDULED',
      receptionistName: receptionistName || '現場專案',
      customerFeedback,
      objections,
      nextStep,
      completedAt: status === 'COMPLETED' ? nowIso : undefined,
      isDemo: operator.isDemo === true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.collection('viewings').insertOne(newViewing);

    await recordAudit(
      db,
      status === 'COMPLETED' ? 'COMPLETE_VIEWING' : 'SCHEDULE_VIEWING',
      'Viewing',
      viewingId,
      operator,
      `登記現場實地帶看（接待人員：${receptionistName}，狀態：${status}）`,
      operator.storeId
    );

    res.json({ success: true, viewing: newViewing });
  } catch (err: any) {
    console.error('POST /viewings error:', err?.message || err);
    res.status(500).json({ error: '登記實地帶看失敗' });
  }
});

// 13. 更新帶看回報
apiRouter.put('/viewings/:viewingId', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const { viewingId } = req.params;
    const { status, customerFeedback, objections, nextStep, receptionistName } = req.body;
    const operator = (req as any).user;
    const db = await getDb();

    const nowIso = new Date().toISOString();
    await db.collection('viewings').updateOne(
      { $or: [{ id: viewingId }, { _id: viewingId as any }] },
      {
        $set: {
          status,
          customerFeedback,
          objections,
          nextStep,
          receptionistName,
          completedAt: status === 'COMPLETED' ? nowIso : undefined,
          updatedAt: nowIso,
        },
      }
    );

    await recordAudit(
      db,
      'UPDATE_VIEWING_REPORT',
      'Viewing',
      viewingId,
      operator,
      `回報現場實地帶看結果：狀態 [${status}]，客戶反饋：${customerFeedback || '無'}`,
      operator.storeId
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('PUT /viewings/:viewingId error:', err?.message || err);
    res.status(500).json({ error: '更新帶看回報失敗' });
  }
});

// 14. 交易階段申報 (門店提出)
apiRouter.post('/transactions/report', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const operator = (req as any).user;
    const {
      customerRegistrationId: rawRegId,
      registrationId,
      unitId,
      stage,
      totalPrice,
      depositAmount,
      contractAmount,
      note,
    } = req.body;
    const customerRegistrationId = rawRegId || registrationId;

    const db = await getDb();
    const reg = await db.collection('registrations').findOne({
      $or: [{ id: customerRegistrationId }, { _id: customerRegistrationId }],
    });
    if (!reg) {
      return res.status(404).json({ error: '找不到指定客戶登記紀錄' });
    }

    // 業務範圍權限檢查
    if (operator.role === 'agent' && reg.agentId !== operator.id) {
      return res.status(403).json({ error: '權限不足：您不能申報其他業務名下客戶的交易' });
    }
    if (operator.role === 'store_manager' && reg.storeId !== operator.storeId) {
      return res.status(403).json({ error: '權限不足：店長僅可申報本店客戶交易' });
    }

    // 檢查門店對建案之聯銷指派是否有效
    if (operator.role !== 'center_admin') {
      const assignment = await db.collection('assignments').findOne({
        projectId: reg.projectId,
        storeId: operator.storeId,
        status: 'ACTIVE',
      });
      if (!assignment) {
        return res.status(403).json({ error: '該建案之門店聯銷授權非有效中（可能已暫停或撤銷），無法申報新交易' });
      }
    }

    // 取得登記時綁定之分佣不可變快照 (保證依初次登記方案計酬)
    const snapshot = await db.collection('commission_snapshots').findOne({
      $or: [{ id: reg.commissionSnapshotId }, { _id: reg.commissionSnapshotId }],
    });

    // 檢查戶別是否已被其他客戶下訂、簽約或成交，避免重複下訂
    if (unitId) {
      const targetUnit = await db.collection('units').findOne({
        $or: [{ id: unitId }, { _id: unitId }],
      });
      if (!targetUnit) {
        return res.status(404).json({ error: '找不到指定申報之戶別' });
      }
      if (targetUnit.status === 'DISABLED') {
        return res.status(400).json({ error: '該戶別已被中心停用下架，無法進行申報' });
      }
      const existingConflictTxn = await db.collection('transactions').findOne({
        unitId,
        customerRegistrationId: { $ne: reg.id || reg._id },
        stage: { $in: ['DEPOSIT_CONFIRMED', 'CONTRACT_CONFIRMED', 'DEAL_CONFIRMED', 'DEPOSIT_REPORTED', 'CONTRACT_REPORTED', 'DEAL_REPORTED'] },
      });
      if (existingConflictTxn) {
        return res.status(409).json({ error: `該戶別已於交易進度中（目前狀態或進度：${existingConflictTxn.stage}），無法重複下訂` });
      }
    }

    const parsedPrice = Number(totalPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: '申報成交總價必須大於 0 元' });
    }

    const parsedDeposit = depositAmount !== undefined && depositAmount !== null ? Number(depositAmount) : undefined;
    if (parsedDeposit !== undefined && (isNaN(parsedDeposit) || parsedDeposit < 0)) {
      return res.status(400).json({ error: '訂金金額不得為負數' });
    }
    if (parsedDeposit !== undefined && parsedDeposit > parsedPrice) {
      return res.status(400).json({ error: '訂金金額不得超過申報成交總價' });
    }

    const calculated = snapshot
      ? calculateCommissionFromSnapshot(parsedPrice, snapshot as any)
      : {
          totalCommission: Math.round(parsedPrice * 0.03),
          centerCommission: Math.round(parsedPrice * 0.03 * 0.3),
          storeCommission: Math.round(parsedPrice * 0.03 * 0.7),
        };

    const nowIso = new Date().toISOString();
    const existingTrans = await db.collection('transactions').findOne({
      customerRegistrationId: reg.id || reg._id,
    });

    const transactionId = existingTrans ? (existingTrans.id || existingTrans._id) : `txn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const reportTypeName = stage === 'DEPOSIT_REPORTED' ? '下訂' : stage === 'CONTRACT_REPORTED' ? '簽約' : '成交';
    const timelineItem = {
      stage,
      actionTime: nowIso,
      operatorName: operator.name,
      note: note || `門店申報${reportTypeName}（總價 NT$ ${parsedPrice.toLocaleString()} 元）`,
    };

    const pendingReportType = stage === 'DEPOSIT_REPORTED' ? 'DEPOSIT' : stage === 'CONTRACT_REPORTED' ? 'CONTRACT' : 'DEAL';

    if (existingTrans) {
      await db.collection('transactions').updateOne(
        { _id: existingTrans._id },
        {
          $set: {
            stage, // 維持向後相容的階段狀態
            reviewStatus: 'PENDING_REVIEW',
            pendingReportType,
            pendingDealPrice: parsedPrice,
            pendingDepositAmount: depositAmount !== undefined ? Number(depositAmount) : existingTrans.depositAmount,
            pendingReportNote: note || `門店申報 ${stage}`,
            dealPrice: parsedPrice,
            totalPrice: parsedPrice,
            depositAmount: depositAmount !== undefined ? Number(depositAmount) : existingTrans.depositAmount,
            contractAmount: contractAmount !== undefined ? Number(contractAmount) : existingTrans.contractAmount,
            calculatedTotalCommission: calculated.totalCommission,
            totalCommission: calculated.totalCommission,
            centerCommission: calculated.centerCommission,
            storeCommission: calculated.storeCommission,
            reportNote: note || existingTrans.reportNote || '',
            reportedBy: operator.name,
            updatedAt: nowIso,
          },
          $push: { timeline: timelineItem } as any,
        }
      );
    } else {
      const newTxn: any = {
        _id: transactionId,
        id: transactionId,
        customerRegistrationId: reg.id || reg._id,
        projectId: reg.projectId,
        unitId,
        storeId: reg.storeId,
        agentId: reg.agentId,
        stage, // 維持向後相容
        reviewStatus: 'PENDING_REVIEW',
        pendingReportType,
        pendingDealPrice: parsedPrice,
        pendingDepositAmount: depositAmount ? Number(depositAmount) : undefined,
        pendingReportNote: note || `門店申報 ${stage}`,
        dealPrice: parsedPrice,
        totalPrice: parsedPrice,
        depositAmount: depositAmount ? Number(depositAmount) : undefined,
        contractAmount: contractAmount ? Number(contractAmount) : undefined,
        calculatedTotalCommission: calculated.totalCommission,
        totalCommission: calculated.totalCommission,
        centerCommission: calculated.centerCommission,
        storeCommission: calculated.storeCommission,
        transactionDate: nowIso,
        reportNote: note || '',
        reportedBy: operator.name,
        timeline: [timelineItem],
        isDemo: operator.isDemo === true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await db.collection('transactions').insertOne(newTxn);
    }

    // 申報下訂時：戶別轉為 RESERVED_DEPOSIT 保留鎖定，避免雙重申報
    if (stage === 'DEPOSIT_REPORTED') {
      await db.collection('units').updateOne(
        { $or: [{ id: unitId }, { _id: unitId }] },
        { $set: { status: 'RESERVED_DEPOSIT', updatedAt: nowIso } }
      );
    }

    await recordAudit(
      db,
      'REPORT_TRANSACTION_STAGE',
      'Transaction',
      transactionId,
      operator,
      `門店營業員申報交易階段 [${stage}]，總價 NT$ ${parsedPrice.toLocaleString()} 元`,
      reg.storeId
    );

    res.json({ success: true, transactionId });
  } catch (err: any) {
    console.error('POST /transactions/report error:', err?.message || err);
    res.status(500).json({ error: '申報交易階段失敗' });
  }
});

// 15. 交易階段確認 (代銷中心核准生效)
apiRouter.post('/transactions/:transactionId/confirm', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const { nextStage, note } = req.body;
    const operator = (req as any).user;
    const db = await getDb();

    if (!nextStage) {
      return res.status(400).json({ error: '請指定核准後之正式交易階段' });
    }

    const txn = await db.collection('transactions').findOne({
      $or: [{ id: transactionId }, { _id: transactionId as any }],
    });
    if (!txn) {
      return res.status(404).json({ error: '找不到指定交易紀錄' });
    }

    // 防呆：不可重複核准相同階段
    if (txn.stage === nextStage && txn.reviewStatus === 'APPROVED') {
      return res.status(400).json({ error: `此筆交易已核准生效為 [${nextStage}]，不可重複核准` });
    }

    // 防呆：同戶別不可同時核准兩筆有效交易
    if (txn.unitId && (nextStage === 'DEPOSIT_CONFIRMED' || nextStage === 'CONTRACT_CONFIRMED' || nextStage === 'DEAL_CONFIRMED')) {
      const conflictApproved = await db.collection('transactions').findOne({
        unitId: txn.unitId,
        _id: { $ne: txn._id },
        id: { $ne: txn.id || txn._id },
        stage: { $in: ['DEPOSIT_CONFIRMED', 'CONTRACT_CONFIRMED', 'DEAL_CONFIRMED'] },
      });
      if (conflictApproved) {
        return res.status(409).json({ error: `同戶別已有已核准生效之交易（單號：${conflictApproved.id || conflictApproved._id}，階段：${conflictApproved.stage}），無法重複核准下訂或成交！` });
      }
    }

    const nowIso = new Date().toISOString();
    const timelineItem = {
      stage: nextStage,
      actionTime: nowIso,
      operatorName: operator.name,
      note: note || `代銷中心核准生效 ${nextStage}`,
    };

    const finalDealPrice = txn.pendingDealPrice || txn.dealPrice || txn.totalPrice || 0;
    const finalDeposit = txn.pendingDepositAmount !== undefined ? txn.pendingDepositAmount : txn.depositAmount;

    await db.collection('transactions').updateOne(
      { _id: txn._id },
      {
        $set: {
          stage: nextStage,
          reviewStatus: 'APPROVED',
          dealPrice: finalDealPrice,
          totalPrice: finalDealPrice,
          depositAmount: finalDeposit,
          centerConfirmNote: note || '代銷中心已查核水單與合約資料無誤，准予確認。',
          centerConfirmedAt: nowIso,
          centerConfirmedBy: operator.name,
          confirmedBy: operator.name,
          updatedAt: nowIso,
        },
        $push: { timeline: timelineItem } as any,
      }
    );

    // 針對戶別狀態進行嚴格聯動
    let unitStatus = 'NEGOTIATING';
    if (nextStage === 'DEPOSIT_CONFIRMED') unitStatus = 'RESERVED_DEPOSIT';
    if (nextStage === 'CONTRACT_CONFIRMED') unitStatus = 'SIGNED';
    if (nextStage === 'DEAL_CONFIRMED') unitStatus = 'DEAL_CLOSED';
    if (nextStage === 'CANCELLED') unitStatus = 'AVAILABLE';

    await db.collection('units').updateOne(
      { $or: [{ id: txn.unitId }, { _id: txn.unitId }] },
      { $set: { status: unitStatus, updatedAt: nowIso } }
    );

    // 若成交確認，登記轉為 CONVERTED
    if (nextStage === 'DEAL_CONFIRMED') {
      await db.collection('registrations').updateOne(
        { $or: [{ id: txn.customerRegistrationId }, { _id: txn.customerRegistrationId }] },
        { $set: { status: 'CONVERTED', updatedAt: nowIso } }
      );
    }

    await recordAudit(
      db,
      'CONFIRM_TRANSACTION_STAGE',
      'Transaction',
      transactionId,
      operator,
      `代銷中心核准並確認交易階段生效 [${nextStage}]。備註：${note || '無'}`,
      txn.storeId
    );

    res.json({ success: true, nextStage, reviewStatus: 'APPROVED' });
  } catch (err: any) {
    console.error('POST /transactions/:transactionId/confirm error:', err?.message || err);
    res.status(500).json({ error: '確認交易階段失敗' });
  }
});

// 15-B. 交易申報駁回 (代銷中心駁回申報，需填寫原因)
apiRouter.post('/transactions/:transactionId/reject', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const { rejectionReason, note } = req.body;
    const operator = (req as any).user;
    const db = await getDb();

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: '代銷中心駁回交易申報必須填寫駁回原因！' });
    }

    const txn = await db.collection('transactions').findOne({
      $or: [{ id: transactionId }, { _id: transactionId as any }],
    });
    if (!txn) {
      return res.status(404).json({ error: '找不到指定交易紀錄' });
    }

    const nowIso = new Date().toISOString();
    const reasonText = rejectionReason.trim();
    const timelineItem = {
      stage: 'REJECTED',
      actionTime: nowIso,
      operatorName: operator.name,
      note: `代銷中心駁回申報：${reasonText}${note ? ` (${note})` : ''}`,
    };

    // 判斷原正式階段：若是初次下訂申報被駁回，退回已取消/未生效；若先前已有已生效階段(例如CONTRACT申報被駁回)，保留前一已核准階段
    let rollbackStage: any = 'CANCELLED';
    let rollbackUnitStatus: any = 'AVAILABLE';

    if (txn.timeline && Array.isArray(txn.timeline)) {
      const confirmedEvents = txn.timeline.filter(
        (e: any) => e.stage === 'DEPOSIT_CONFIRMED' || e.stage === 'CONTRACT_CONFIRMED'
      );
      if (confirmedEvents.length > 0) {
        const lastConfirmed = confirmedEvents[confirmedEvents.length - 1];
        rollbackStage = lastConfirmed.stage;
        rollbackUnitStatus = rollbackStage === 'DEPOSIT_CONFIRMED' ? 'RESERVED_DEPOSIT' : 'SIGNED';
      }
    }

    await db.collection('transactions').updateOne(
      { _id: txn._id },
      {
        $set: {
          stage: rollbackStage,
          reviewStatus: 'REJECTED',
          rejectionReason: reasonText,
          rejectedAt: nowIso,
          rejectedBy: operator.name,
          updatedAt: nowIso,
        },
        $push: { timeline: timelineItem } as any,
      }
    );

    // 戶別狀態釋回（若初次申報則釋回可銷售 AVAILABLE；若前階為下訂則維持 RESERVED_DEPOSIT）
    await db.collection('units').updateOne(
      { $or: [{ id: txn.unitId }, { _id: txn.unitId }] },
      { $set: { status: rollbackUnitStatus, updatedAt: nowIso } }
    );

    await recordAudit(
      db,
      'REJECT_TRANSACTION_STAGE',
      'Transaction',
      transactionId,
      operator,
      `代銷中心駁回交易申報。原因：${reasonText}`,
      txn.storeId
    );

    res.json({ success: true, rollbackStage, reviewStatus: 'REJECTED' });
  } catch (err: any) {
    console.error('POST /transactions/:transactionId/reject error:', err?.message || err);
    res.status(500).json({ error: '駁回交易申報失敗' });
  }
});

// 16. 發布新分佣版本 (代銷中心專屬)
apiRouter.post('/projects/:projectId/commission-versions', authenticateRequest, requireCenterAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const {
      versionNumber,
      effectiveDate,
      formulaType,
      percentage,
      fixedAmount,
      centerPercentage,
      storePercentage,
      note,
    } = req.body;
    const operator = (req as any).user;

    const db = await getDb();
    const nowIso = new Date().toISOString();
    const versionId = `comm_${projectId}_${Date.now()}`;

    const newVersion: any = {
      _id: versionId,
      id: versionId,
      projectId,
      versionNumber,
      effectiveDate: effectiveDate || nowIso,
      formulaType: formulaType || 'PERCENTAGE_TOTAL',
      percentage: Number(percentage),
      fixedAmount: fixedAmount ? Number(fixedAmount) : undefined,
      centerPercentage: Number(centerPercentage),
      storePercentage: Number(storePercentage),
      note: note || '',
      publishedBy: operator.name,
      isDemo: operator.isDemo === true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.collection('commission_versions').insertOne(newVersion);

    // 更新建案之目前生效版本
    await db.collection('projects').updateOne(
      { $or: [{ id: projectId }, { _id: projectId as any }] },
      {
        $set: {
          currentCommissionVersionId: versionId,
          updatedAt: nowIso,
        },
      }
    );

    await recordAudit(
      db,
      'PUBLISH_COMMISSION_VERSION',
      'CommissionVersion',
      versionId,
      operator,
      `發布建案 [${projectId}] 新分佣方案 [${versionNumber}]（門店分配：${storePercentage}%，代銷中心：${centerPercentage}%）`
    );

    res.json({ success: true, commissionVersion: newVersion });
  } catch (err: any) {
    console.error('POST /projects/:projectId/commission-versions error:', err?.message || err);
    res.status(500).json({ error: '發布分佣版本失敗' });
  }
});

// ==================== 問題回報 (Issue Tickets) API ====================

// 16.1 查詢問題回報列表 (嚴格權限過濾：中心全部、店長本店、業務本人；中心內部備註在門店端過濾)
apiRouter.get('/issues', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const operator = (req as any).user;
    const { status, type, storeId, priority, q } = req.query;
    const db = await getDb();

    const query: any = {};

    // 權限隔離
    if (operator.role === 'center_admin') {
      if (storeId && storeId !== 'ALL') {
        query.reporterStoreId = storeId;
      }
    } else if (operator.role === 'store_manager') {
      query.reporterStoreId = operator.storeId;
    } else {
      query.reporterId = operator.id || operator._id;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (type && type !== 'ALL') {
      query.type = type;
    }
    if (priority && priority !== 'ALL') {
      query.priority = priority;
    }

    const tickets = await db
      .collection('issue_tickets')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // 門店端安全脫敏：徹底剝除 centerInternalNotes 以及 internal comment
    const sanitizedTickets = tickets.map((t: any) => {
      const formatted = {
        ...t,
        id: t.id || t._id,
      };
      delete formatted._id;

      if (operator.role !== 'center_admin') {
        delete formatted.centerInternalNotes;
        if (Array.isArray(formatted.comments)) {
          formatted.comments = formatted.comments.filter((c: any) => !c.isCenterInternal);
        }
      }

      return formatted;
    });

    res.json({ success: true, tickets: sanitizedTickets });
  } catch (err: any) {
    console.error('GET /issues error:', err?.message || err);
    res.status(500).json({ error: '讀取問題回報列表失敗' });
  }
});

// 16.2 建立問題回報 (由後端自動注入回報人、門店、角色、建立時間；純文字保存；杜絕個資/token)
apiRouter.post('/issues', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const operator = (req as any).user;
    const {
      type,
      title,
      description,
      reproductionSteps,
      expectedResult,
      actualResult,
      pagePath,
      appVersion,
      clientRequestId, // 防重複點擊 token
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: '問題標題為必填' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: '問題說明為必填' });
    }

    const validTypes = ['OPERATION_FAILED', 'DATA_ANOMALY', 'PERMISSION_ISSUE', 'UI_DISPLAY', 'FEATURE_REQUEST'];
    const issueType = validTypes.includes(type) ? type : 'OPERATION_FAILED';

    const db = await getDb();

    // 防重複點擊建立相同回報 (10 秒內同人同標題視為重複點擊)
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    const existingRecent = await db.collection('issue_tickets').findOne({
      reporterId: operator.id || operator._id,
      title: title.trim(),
      createdAt: { $gte: tenSecondsAgo },
    });
    if (existingRecent) {
      const existingId = existingRecent.id || existingRecent._id;
      return res.json({ success: true, ticket: existingRecent, duplicatePrevented: true, ticketId: existingId });
    }

    // 取得門店名稱
    let storeName = operator.storeName;
    if (!storeName && operator.storeId) {
      const storeDoc = await db.collection('stores').findOne({
        $or: [{ id: operator.storeId }, { _id: operator.storeId }],
      });
      if (storeDoc) storeName = storeDoc.name;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticketNumber = `TKT-${dateStr}-${randomSuffix}`;
    const ticketId = `tkt_${Date.now()}_${randomSuffix.toLowerCase()}`;

    // 清理後的頁面路徑 (去除可能夾帶的 query string 或敏感 token)
    let cleanedPath = (pagePath || '').split('?')[0].split('#')[0];
    if (cleanedPath.length > 100) cleanedPath = cleanedPath.substring(0, 100);

    const newTicket: any = {
      _id: ticketId,
      id: ticketId,
      ticketNumber,
      type: issueType,
      title: title.trim(),
      description: description.trim(),
      reproductionSteps: reproductionSteps ? reproductionSteps.trim() : '',
      expectedResult: expectedResult ? expectedResult.trim() : '',
      actualResult: actualResult ? actualResult.trim() : '',
      pagePath: cleanedPath,
      appVersion: appVersion || 'v1.0.0-trial',

      reporterId: operator.id || operator._id,
      reporterName: operator.name,
      reporterRole: operator.role,
      reporterStoreId: operator.storeId || '',
      reporterStoreName: storeName || (operator.role === 'center_admin' ? '代銷中心' : ''),

      status: 'PENDING',
      priority: 'MEDIUM',
      postponeReason: '',
      resolutionSummary: '',
      verificationResult: '',
      centerInternalNotes: '',

      comments: [],
      statusHistory: [
        {
          id: `hist_${Date.now()}_1`,
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          operatorId: operator.id || operator._id,
          operatorName: operator.name,
          operatorRole: operator.role,
          reason: '建立問題回報',
          createdAt: nowIso,
        },
      ],

      isDemo: operator.isDemo === true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.collection('issue_tickets').insertOne(newTicket);

    await recordAudit(
      db,
      'CREATE_ISSUE_TICKET',
      'ISSUE_TICKET' as any,
      ticketId,
      operator,
      `提出問題回報 [${ticketNumber}] ${title.trim()}（類型：${issueType}）`,
      operator.storeId
    );

    res.json({ success: true, ticket: newTicket, ticketId });
  } catch (err: any) {
    console.error('POST /issues error:', err?.message || err);
    res.status(500).json({ error: '建立問題回報失敗' });
  }
});

// 16.3 中心更新問題處理狀態與回覆 (狀態轉移：待處理 -> 處理中 -> 待確認 -> 已結案 / 暫緩)
apiRouter.put('/issues/:id/status', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operator = (req as any).user;
    const {
      status,
      priority,
      postponeReason,
      resolutionSummary,
      verificationResult,
      centerInternalNotes,
      rollbackReason, // 回報者退回處理中之原因
    } = req.body;

    const db = await getDb();
    const ticket = await db.collection('issue_tickets').findOne({
      $or: [{ id }, { _id: id as any }],
    });
    if (!ticket) {
      return res.status(404).json({ error: '找不到指定問題回報' });
    }

    const nowIso = new Date().toISOString();
    const fromStatus = ticket.status;
    let targetStatus = status || ticket.status;

    // 權限檢查與狀態轉移規則：
    // 若為回報者（業務或店長）：
    // - 可以將狀態由 WAITING_CONFIRM 確認為 CLOSED (確認已解決)
    // - 或由 WAITING_CONFIRM 退回 IN_PROGRESS (仍可重現，需填寫 rollbackReason)
    if (operator.role !== 'center_admin') {
      const isReporter = (ticket.reporterId === (operator.id || operator._id));
      if (!isReporter) {
        return res.status(403).json({ error: '權限不足：您只能更新自己提出的回報' });
      }

      if (targetStatus === 'CLOSED') {
        // 確認結案
      } else if (targetStatus === 'IN_PROGRESS') {
        if (!rollbackReason || !rollbackReason.trim()) {
          return res.status(400).json({ error: '退回處理中必須提供仍可重現之具體原因說明' });
        }
      } else {
        return res.status(403).json({ error: '門店回報者僅能確認已解決結案或退回處理中' });
      }
    }

    // 若設定暫緩，必須填寫原因
    if (targetStatus === 'POSTPONED' && (!postponeReason || !postponeReason.trim())) {
      return res.status(400).json({ error: '標記為暫緩時必須填寫暫緩原因' });
    }

    const historyEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      fromStatus,
      toStatus: targetStatus,
      operatorId: operator.id || operator._id,
      operatorName: operator.name,
      operatorRole: operator.role,
      reason: rollbackReason || postponeReason || resolutionSummary || `狀態變更為 ${targetStatus}`,
      createdAt: nowIso,
    };

    const updateFields: any = {
      status: targetStatus,
      updatedAt: nowIso,
    };

    if (priority && operator.role === 'center_admin') {
      updateFields.priority = priority;
    }
    if (postponeReason !== undefined && operator.role === 'center_admin') {
      updateFields.postponeReason = postponeReason.trim();
    }
    if (resolutionSummary !== undefined && operator.role === 'center_admin') {
      updateFields.resolutionSummary = resolutionSummary.trim();
    }
    if (verificationResult !== undefined && operator.role === 'center_admin') {
      updateFields.verificationResult = verificationResult.trim();
    }
    if (centerInternalNotes !== undefined && operator.role === 'center_admin') {
      updateFields.centerInternalNotes = centerInternalNotes.trim();
    }

    await db.collection('issue_tickets').updateOne(
      { _id: ticket._id },
      {
        $set: updateFields,
        $push: { statusHistory: historyEntry } as any,
      }
    );

    await recordAudit(
      db,
      'UPDATE_ISSUE_TICKET_STATUS',
      'ISSUE_TICKET' as any,
      ticket.id || ticket._id,
      operator,
      `更新問題回報 [${ticket.ticketNumber}] 狀態：${fromStatus} -> ${targetStatus}`,
      ticket.reporterStoreId
    );

    res.json({ success: true, fromStatus, toStatus: targetStatus });
  } catch (err: any) {
    console.error('PUT /issues/:id/status error:', err?.message || err);
    res.status(500).json({ error: '更新問題狀態失敗' });
  }
});

// 16.4 新增補充說明 / 討論留言 (保留時間與操作人，不覆寫原始回報；區分內部備註與公開留言)
apiRouter.post('/issues/:id/comments', authenticateRequest, requireActiveUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operator = (req as any).user;
    const { content, isCenterInternal } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '補充說明內容為必填' });
    }

    const db = await getDb();
    const ticket = await db.collection('issue_tickets').findOne({
      $or: [{ id }, { _id: id as any }],
    });
    if (!ticket) {
      return res.status(404).json({ error: '找不到指定問題回報' });
    }

    // 門店人員權限檢查：業務只能在自己的回報留言；店長可在本店回報留言
    if (operator.role === 'agent' && ticket.reporterId !== (operator.id || operator._id)) {
      return res.status(403).json({ error: '權限不足：您只能在自己提出的問題回報中補充說明' });
    }
    if (operator.role === 'store_manager' && ticket.reporterStoreId !== operator.storeId) {
      return res.status(403).json({ error: '權限不足：店長僅可於本店同仁之問題回報補充說明' });
    }

    // 只有 center_admin 可以發布內部備註
    const internalFlag = (operator.role === 'center_admin' && isCenterInternal === true);

    const nowIso = new Date().toISOString();
    const newComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      authorId: operator.id || operator._id,
      authorName: operator.name,
      authorRole: operator.role,
      authorStoreId: operator.storeId,
      authorStoreName: operator.storeName,
      content: content.trim(),
      createdAt: nowIso,
      isCenterInternal: internalFlag,
    };

    await db.collection('issue_tickets').updateOne(
      { _id: ticket._id },
      {
        $push: { comments: newComment } as any,
        $set: { updatedAt: nowIso },
      }
    );

    res.json({ success: true, comment: newComment });
  } catch (err: any) {
    console.error('POST /issues/:id/comments error:', err?.message || err);
    res.status(500).json({ error: '新增補充說明失敗' });
  }
});

