import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';
import { normalizeContactPhone } from '../rules';

const DB_NAME = 'e8346c_dai_sho_t';

let client: MongoClient | null = null;
let connectPromise: Promise<MongoClient> | null = null;
let indexesInitialized = false;

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  // 若已有連線，檢查 topology 是否正常
  if (client) {
    const isClosed = (client as any).topology?.isClosed?.() ?? false;
    if (isClosed) {
      console.warn('⚠️ MongoDB topology was closed. Recreating client...');
      try {
        await client.close();
      } catch {
        // ignore
      }
      client = null;
    }
  }

  if (client) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      console.log('🔄 Connecting to MongoDB (e8346c_dai_sho_t)...');
      const newClient = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      await newClient.connect();
      console.log('✅ MongoDB connected successfully to database:', DB_NAME);
      client = newClient;
      connectPromise = null;
      return newClient;
    })().catch((err) => {
      connectPromise = null;
      client = null;
      console.error('❌ Failed to connect to MongoDB:', err?.message || err);
      throw err;
    });
  }

  return connectPromise;
}

export async function getDb(): Promise<Db> {
  const mongoClient = await getMongoClient();
  const db = mongoClient.db(DB_NAME);
  if (!indexesInitialized) {
    indexesInitialized = true;
    initIndexes(db).catch((err) => {
      console.error('Failed to initialize MongoDB indexes:', err?.message || err);
    });
  }
  return db;
}

/**
 * 啟動時建立各 Collection 索引（createIndex 具備冪等性，安全重複呼叫）
 */
async function initIndexes(db: Db): Promise<void> {
  try {
    // users
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 });
    await db.collection('users').createIndex({ role: 1 });
    await db.collection('users').createIndex({ status: 1 });
    await db.collection('users').createIndex({ isDemo: 1 });

    // sessions (工作階段憑證)
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ expiresAt: 1 });
    await db.collection('sessions').createIndex({ userId: 1 });

    // stores
    await db.collection('stores').createIndex({ code: 1 }, { unique: true });

    // projects
    await db.collection('projects').createIndex({ status: 1 });
    await db.collection('projects').createIndex({ createdAt: -1 });

    // units
    await db.collection('units').createIndex({ projectId: 1, unitNumber: 1 }, { unique: true });
    await db.collection('units').createIndex({ projectId: 1, status: 1 });

    // assignments
    await db.collection('assignments').createIndex({ projectId: 1, storeId: 1 });

    // customers
    await db.collection('customers').createIndex({ phone: 1 });
    await db.collection('customers').createIndex({ createdAt: -1 });

    // 一致性補正：補足歷史登記資料之 phone 與 isActiveReservation 欄位，確保唯一性約束建立
    const pendingRegs = await db.collection('registrations').find({
      $or: [
        { phone: { $exists: false } },
        { phone: null },
        { phone: '' },
        { isActiveReservation: { $exists: false } },
      ],
    }).toArray();

    for (const r of pendingRegs) {
      let regPhone = r.phone;
      if (!regPhone && r.customerId) {
        const cust = await db.collection('customers').findOne({
          $or: [{ id: r.customerId }, { _id: r.customerId as any }],
        });
        if (cust?.phone) {
          regPhone = cust.phone;
        }
      }
      const cleanPhone = regPhone ? normalizeContactPhone(regPhone) : undefined;
      const isActive = r.status === 'ACTIVE' || r.status === 'EXPIRING_SOON';
      await db.collection('registrations').updateOne(
        { _id: r._id },
        {
          $set: {
            ...(cleanPhone ? { phone: cleanPhone } : {}),
            isActiveReservation: isActive,
          },
        }
      );
    }

    // 補足 commission_snapshots 之 status
    await db.collection('commission_snapshots').updateMany(
      { status: { $exists: false } },
      { $set: { status: 'ACTIVE' } }
    );

    // registrations
    await db.collection('registrations').createIndex({ phone: 1, projectId: 1 });
    // 原子唯一約束：同電話+同建案在有效保留期間（ACTIVE / EXPIRING_SOON）不得重複建立有效保留
    await db.collection('registrations').createIndex(
      { phone: 1, projectId: 1 },
      { unique: true, partialFilterExpression: { isActiveReservation: true } }
    );
    await db.collection('registrations').createIndex({ customerId: 1, projectId: 1 });
    await db.collection('registrations').createIndex({ storeId: 1, status: 1 });
    await db.collection('registrations').createIndex({ agentId: 1, status: 1 });
    await db.collection('registrations').createIndex({ reservationExpiryDate: 1 });
    await db.collection('registrations').createIndex({ status: 1 });

    // commission_versions & snapshots
    await db.collection('commission_versions').createIndex({ projectId: 1, createdAt: -1 });
    await db.collection('commission_snapshots').createIndex({ customerRegistrationId: 1 });

    // follow_ups
    await db.collection('follow_ups').createIndex({ customerRegistrationId: 1, contactTime: -1 });

    // renewals
    await db.collection('renewals').createIndex({ customerRegistrationId: 1, status: 1 });

    // viewings
    await db.collection('viewings').createIndex({ customerRegistrationId: 1, scheduledTime: -1 });

    // transactions
    await db.collection('transactions').createIndex({ customerRegistrationId: 1 });
    await db.collection('transactions').createIndex({ projectId: 1, stage: 1 });

    // audit_logs
    await db.collection('audit_logs').createIndex({ createdAt: -1 });
    await db.collection('audit_logs').createIndex({ storeId: 1 });
    console.log('✅ MongoDB indexes ensured successfully for e8346c_dai_sho_t');
  } catch (err: unknown) {
    const error = err as Error;
    console.warn('⚠️ MongoDB index initialization encountered note:', error?.message || error);
  }
}
