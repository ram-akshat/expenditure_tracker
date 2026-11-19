import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';
import schema from '../../../database/schema.sql?raw';
import seed from '../../../database/seed.sql?raw';

worker({
  async init(options) {
    const db = await PGlite.create({ dataDir: options.dataDir, relaxedDurability: false });
    await db.exec(schema);
    await db.exec(seed);
    return db;
  },
});
