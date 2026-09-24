import { MongoClient } from 'mongodb';

interface MigrationResult {
  dryRun: boolean;
  backupCreated: boolean;
  backupCount: number;
  unitsScanned: number;
  unitsToUpdate: number;
  unitsUpdated: number;
  transactionsScanned: number;
  transactionsToUpdate: number;
  transactionsUpdated: number;
  details: {
    units: Array<{ id: string; building: string; unitNumber: string; oldListPrice: number; newListPrice: number; oldBottomPrice?: number; newBottomPrice?: number }>;
    transactions: Array<{ id: string; oldDealPrice?: number; newDealPrice?: number; oldTotalPrice?: number; newTotalPrice?: number; oldCommission?: number; newCommission?: number }>;
  };
}

export async function runPriceUnitMigration(options: { dryRun?: boolean; rollback?: boolean } = {}): Promise<MigrationResult> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/e8346c_dai_sho_t';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const isDryRun = options.dryRun !== false && !options.rollback;

  // 如果要求回復 (Rollback)
  if (options.rollback) {
    const backupColl = db.collection('migration_backup_units_v1');
    const backupTxColl = db.collection('migration_backup_tx_v1');
    
    const backedUnits = await backupColl.find({}).toArray();
    for (const u of backedUnits) {
      const { _backupAt, ...originalUnit } = u as any;
      await db.collection('units').replaceOne({ _id: originalUnit._id }, originalUnit);
    }

    const backedTxs = await backupTxColl.find({}).toArray();
    for (const t of backedTxs) {
      const { _backupAt, ...originalTx } = t as any;
      await db.collection('transactions').replaceOne({ _id: originalTx._id }, originalTx);
    }

    await client.close();
    return {
      dryRun: false,
      backupCreated: false,
      backupCount: backedUnits.length,
      unitsScanned: backedUnits.length,
      unitsToUpdate: 0,
      unitsUpdated: backedUnits.length,
      transactionsScanned: backedTxs.length,
      transactionsToUpdate: 0,
      transactionsUpdated: backedTxs.length,
      details: { units: [], transactions: [] },
    };
  }

  // 1. 掃描 units 集合
  const units = await db.collection('units').find({}).toArray();
  const unitsToMigrate: any[] = [];

  for (const u of units) {
    let needsUpdate = false;
    let newListPrice = u.listPrice;
    let newBottomPrice = u.bottomPrice;
    let newHousePrice = u.housePrice;
    let newParkingPrice = u.parkingPrice;

    // 判斷邏輯：若數值大於 0 且小於 100,000，代表原為「萬元」，需乘上 10,000 轉為「元」
    // (例如 4980 -> 49,800,000 元；2700 -> 27,000,000 元；25,900,000 元已是元則不更動)
    if (typeof u.listPrice === 'number' && u.listPrice > 0 && u.listPrice < 100000) {
      newListPrice = Math.round(u.listPrice * 10000);
      needsUpdate = true;
    }
    if (typeof u.bottomPrice === 'number' && u.bottomPrice > 0 && u.bottomPrice < 100000) {
      newBottomPrice = Math.round(u.bottomPrice * 10000);
      needsUpdate = true;
    }
    if (typeof u.housePrice === 'number' && u.housePrice > 0 && u.housePrice < 100000) {
      newHousePrice = Math.round(u.housePrice * 10000);
      needsUpdate = true;
    }
    if (typeof u.parkingPrice === 'number' && u.parkingPrice > 0 && u.parkingPrice < 100000) {
      newParkingPrice = Math.round(u.parkingPrice * 10000);
      needsUpdate = true;
    }

    if (needsUpdate) {
      unitsToMigrate.push({
        id: u.id || u._id,
        _id: u._id,
        building: u.building,
        unitNumber: u.unitNumber,
        oldListPrice: u.listPrice,
        newListPrice,
        oldBottomPrice: u.bottomPrice,
        newBottomPrice,
        oldHousePrice: u.housePrice,
        newHousePrice,
        oldParkingPrice: u.parkingPrice,
        newParkingPrice,
      });
    }
  }

  // 2. 掃描 transactions 集合
  const txs = await db.collection('transactions').find({}).toArray();
  const txsToMigrate: any[] = [];

  for (const t of txs) {
    let needsUpdate = false;
    let newDealPrice = t.dealPrice !== undefined ? t.dealPrice : t.totalPrice;
    let newDepositAmount = t.depositAmount;
    let newPendingDealPrice = t.pendingDealPrice;

    // 檢查 dealPrice 或 totalPrice 是否小於 100,000
    if (typeof newDealPrice === 'number' && newDealPrice > 0 && newDealPrice < 100000) {
      newDealPrice = Math.round(newDealPrice * 10000);
      needsUpdate = true;
    }
    if (typeof newPendingDealPrice === 'number' && newPendingDealPrice > 0 && newPendingDealPrice < 100000) {
      newPendingDealPrice = Math.round(newPendingDealPrice * 10000);
      needsUpdate = true;
    }
    if (typeof newDepositAmount === 'number' && newDepositAmount > 0 && newDepositAmount < 10000) {
      // 訂金若被填成例如 100 (代表100萬)，轉為元
      newDepositAmount = Math.round(newDepositAmount * 10000);
      needsUpdate = true;
    }

    // 檢查是否有 dealPrice 為 undefined 但 totalPrice 正常的情況 (如 txn_1790160829436_zxzy)
    if (t.dealPrice === undefined && t.totalPrice !== undefined) {
      newDealPrice = t.totalPrice;
      needsUpdate = true;
    }

    // 重新計算佣金
    let newCommission = t.totalCommission;
    let newCenterCommission = t.centerCommission;
    let newStoreCommission = t.storeCommission;

    if (newDealPrice && (t.totalCommission === undefined || t.totalCommission < 1000)) {
      // 假設 3% 佣金標準或依登記快照
      const snapshot = t.customerRegistrationId
        ? await db.collection('commission_snapshots').findOne({
            $or: [{ customerRegistrationId: t.customerRegistrationId }],
          })
        : null;
      
      const pct = snapshot?.percentage || 3.0;
      const centerPct = snapshot?.centerPercentage || 30;
      newCommission = Math.round(newDealPrice * (pct / 100));
      newCenterCommission = Math.round(newCommission * (centerPct / 100));
      newStoreCommission = newCommission - newCenterCommission;
      needsUpdate = true;
    }

    if (needsUpdate) {
      txsToMigrate.push({
        id: t.id || t._id,
        _id: t._id,
        oldDealPrice: t.dealPrice,
        newDealPrice,
        oldTotalPrice: t.totalPrice,
        newTotalPrice: newDealPrice,
        oldDeposit: t.depositAmount,
        newDeposit: newDepositAmount,
        oldCommission: t.totalCommission,
        newCommission,
        centerCommission: newCenterCommission,
        storeCommission: newStoreCommission,
      });
    }
  }

  // 3. 備份與寫入 (非 DryRun 時執行)
  let backupCreated = false;
  let backupCount = 0;

  if (!isDryRun) {
    const backupAt = new Date().toISOString();
    
    // 建立 units 備份集合 (防止覆寫歷史)
    const backupUnits = units.map((u) => ({ ...u, _backupAt: backupAt }));
    await db.collection('migration_backup_units_v1').deleteMany({});
    if (backupUnits.length > 0) {
      await db.collection('migration_backup_units_v1').insertMany(backupUnits);
    }

    // 建立 transactions 備份集合
    const backupTxs = txs.map((t) => ({ ...t, _backupAt: backupAt }));
    await db.collection('migration_backup_tx_v1').deleteMany({});
    if (backupTxs.length > 0) {
      await db.collection('migration_backup_tx_v1').insertMany(backupTxs);
    }

    backupCreated = true;
    backupCount = backupUnits.length + backupTxs.length;

    // 執行 units 更新
    for (const u of unitsToMigrate) {
      const updateDoc: any = {
        listPrice: u.newListPrice,
      };
      if (u.newBottomPrice !== undefined) updateDoc.bottomPrice = u.newBottomPrice;
      if (u.newHousePrice !== undefined) updateDoc.housePrice = u.newHousePrice;
      if (u.newParkingPrice !== undefined) updateDoc.parkingPrice = u.newParkingPrice;

      await db.collection('units').updateOne(
        { _id: u._id },
        { $set: updateDoc }
      );
    }

    // 執行 transactions 更新
    for (const t of txsToMigrate) {
      await db.collection('transactions').updateOne(
        { _id: t._id },
        {
          $set: {
            dealPrice: t.newDealPrice,
            totalPrice: t.newTotalPrice,
            depositAmount: t.newDeposit,
            totalCommission: t.newCommission,
            calculatedTotalCommission: t.newCommission,
            centerCommission: t.centerCommission,
            storeCommission: t.storeCommission,
          },
        }
      );
    }
  }

  await client.close();

  return {
    dryRun: isDryRun,
    backupCreated,
    backupCount,
    unitsScanned: units.length,
    unitsToUpdate: unitsToMigrate.length,
    unitsUpdated: isDryRun ? 0 : unitsToMigrate.length,
    transactionsScanned: txs.length,
    transactionsToUpdate: txsToMigrate.length,
    transactionsUpdated: isDryRun ? 0 : txsToMigrate.length,
    details: {
      units: unitsToMigrate,
      transactions: txsToMigrate,
    },
  };
}

// 支援命令列執行
const isDirectRun = process.argv[1]?.includes('unify_price_units');
if (isDirectRun) {
  const isApply = process.argv.includes('--apply');
  const isRollback = process.argv.includes('--rollback');
  runPriceUnitMigration({ dryRun: !isApply, rollback: isRollback })
    .then((res) => {
      console.log('Migration Result:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
