import { Db } from 'mongodb';
import { generateInitialMockData } from '../services/mockData';

export async function seedInitialDataIfNeeded(db: Db): Promise<void> {
  try {
    // 確保受控的初代中心管理員帳號存在 (不可被任何外部註冊者竄改或自動取得)
    const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'chlorain@gmail.com').toLowerCase();
    const existingMaster = await db.collection('users').findOne({ email: initialAdminEmail });
    if (!existingMaster) {
      await db.collection('users').insertOne({
        _id: 'usr_master_admin' as any,
        id: 'usr_master_admin',
        username: initialAdminEmail,
        email: initialAdminEmail,
        name: '代銷中心 總管理者',
        role: 'center_admin',
        storeId: '',
        storeName: '代銷中心總部',
        title: '營運處 協理',
        phone: '02-8772-9988',
        status: 'ACTIVE',
        isDemo: false,
        authProvider: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`👑 Master Center Admin initialized: ${initialAdminEmail}`);
    }

    // 確保所有示範使用者皆存在且處於 ACTIVE 狀態
    const mock = generateInitialMockData();
    for (const u of mock.users) {
      const existing = await db.collection('users').findOne({
        $or: [{ id: u.id }, { username: u.username }, { _id: u.id as any }],
      });
      if (!existing) {
        await db.collection('users').insertOne({
          ...u,
          _id: u.id as any,
          status: 'ACTIVE',
          isDemo: true,
          authProvider: 'demo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.collection('users').updateOne(
          { _id: existing._id },
          { $set: { status: 'ACTIVE', isDemo: true, authProvider: 'demo' } }
        );
      }
    }

    const projectsCount = await db.collection('projects').countDocuments();
    if (projectsCount > 0) {
      return; // 已有建案資料，不重複初始化業務資料
    }

    console.log('🌱 Seeding initial demo data into MongoDB (e8346c_dai_sho_t)...');

    // 依序寫入 collections，並標記 isDemo: true 實現完全隔離
    if (mock.users.length > 0) {
      await db.collection('users').insertMany(
        mock.users.map((u) => ({
          ...u,
          _id: u.id as any,
          status: 'ACTIVE',
          isDemo: true,
          authProvider: 'demo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );
    }

    if (mock.stores.length > 0) {
      await db.collection('stores').insertMany(
        mock.stores.map((s) => ({
          ...s,
          _id: s.id as any,
          isDemo: true,
        }))
      );
    }

    if (mock.projects.length > 0) {
      await db.collection('projects').insertMany(
        mock.projects.map((p) => ({
          ...p,
          _id: p.id as any,
          isDemo: true,
        }))
      );
    }

    if (mock.units.length > 0) {
      await db.collection('units').insertMany(
        mock.units.map((u) => ({
          ...u,
          _id: u.id as any,
          isDemo: true,
        }))
      );
    }

    if (mock.projectAssignments.length > 0) {
      await db.collection('assignments').insertMany(
        mock.projectAssignments.map((a) => ({
          ...a,
          _id: a.id as any,
          isDemo: true,
          createdAt: a.assignedAt,
          updatedAt: a.assignedAt,
        }))
      );
    }

    if (mock.customers.length > 0) {
      await db.collection('customers').insertMany(
        mock.customers.map((c) => ({
          ...c,
          _id: c.id as any,
          isDemo: true,
          updatedAt: c.createdAt,
        }))
      );
    }

    if (mock.customerRegistrations.length > 0) {
      await db.collection('registrations').insertMany(
        mock.customerRegistrations.map((r) => ({
          ...r,
          _id: r.id as any,
          isDemo: true,
        }))
      );
    }

    if (mock.commissionVersions.length > 0) {
      await db.collection('commission_versions').insertMany(
        mock.commissionVersions.map((v) => ({
          ...v,
          _id: v.id as any,
          isDemo: true,
          updatedAt: v.createdAt,
        }))
      );
    }

    if (mock.commissionSnapshots.length > 0) {
      await db.collection('commission_snapshots').insertMany(
        mock.commissionSnapshots.map((s) => ({
          ...s,
          _id: s.id as any,
          isDemo: true,
          createdAt: s.lockedAt,
          updatedAt: s.lockedAt,
        }))
      );
    }

    if (mock.followUps.length > 0) {
      await db.collection('follow_ups').insertMany(
        mock.followUps.map((f) => ({
          ...f,
          _id: f.id as any,
          isDemo: true,
          updatedAt: f.createdAt,
        }))
      );
    }

    if (mock.renewalRequests.length > 0) {
      await db.collection('renewals').insertMany(
        mock.renewalRequests.map((r) => ({
          ...r,
          _id: r.id as any,
          isDemo: true,
          updatedAt: r.createdAt,
        }))
      );
    }

    if (mock.viewings.length > 0) {
      await db.collection('viewings').insertMany(
        mock.viewings.map((v) => ({
          ...v,
          _id: v.id as any,
          isDemo: true,
          updatedAt: v.createdAt,
        }))
      );
    }

    if (mock.transactions.length > 0) {
      await db.collection('transactions').insertMany(
        mock.transactions.map((t) => ({
          ...t,
          _id: t.id as any,
          isDemo: true,
        }))
      );
    }

    if (mock.auditLogs.length > 0) {
      await db.collection('audit_logs').insertMany(
        mock.auditLogs.map((l) => ({
          ...l,
          _id: l.id as any,
          isDemo: true,
          createdAt: l.timestamp,
        }))
      );
    }

    console.log('✅ Initial demo data seeded successfully into MongoDB');
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Failed to seed MongoDB demo data:', error?.message || error);
  }
}

export async function resetDatabase(db: Db): Promise<void> {
  const collections = [
    'stores',
    'projects',
    'units',
    'assignments',
    'customers',
    'registrations',
    'commission_versions',
    'commission_snapshots',
    'follow_ups',
    'renewals',
    'viewings',
    'transactions',
    'audit_logs',
  ];

  // 僅清除標記為示範資料的記錄，嚴格保護正式上線資料
  for (const col of collections) {
    try {
      await db.collection(col).deleteMany({ isDemo: true });
    } catch {
      // ignore
    }
  }

  // 僅重置示範使用者，正式帳號保留
  try {
    await db.collection('users').deleteMany({ isDemo: true });
  } catch {
    // ignore
  }

  await seedInitialDataIfNeeded(db);
}
