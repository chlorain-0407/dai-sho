import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb } from './src/server/db';
import { seedInitialDataIfNeeded } from './src/server/seed';
import { apiRouter } from './src/server/routes';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser
  app.use(express.json());

  // 連線資料庫並初始化（建立索引與初始示範資料）
  try {
    const db = await getDb();
    await seedInitialDataIfNeeded(db);
    console.log('🚀 Connected to MongoDB (e8346c_dai_sho_t) and ready.');
  } catch (err: any) {
    console.error('❌ Failed to connect to MongoDB on startup:', err?.message || err);
  }

  // API 路由先行
  app.use('/api', apiRouter);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`太平洋房屋聯銷平台伺服器已啟動：http://localhost:${PORT}`);
  });
}

startServer();
