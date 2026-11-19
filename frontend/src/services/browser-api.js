import { PGliteWorker } from '@electric-sql/pglite/worker';
import { createLocalFetch } from '../../../shared/local-fetch';

let connection;
export async function browserFetch(path, options) {
  if (!connection) {
    const identity = (sessionStorage.getItem('student_bt_id') || 'personal').trim().toUpperCase();
    connection = PGliteWorker.create(
      new Worker(new URL('./database.worker.js', import.meta.url), { type: 'module' }),
      { dataDir: `idb://spendwise-v1-${encodeURIComponent(identity)}` },
    )
      .then(createLocalFetch)
      .catch((error) => {
        connection = undefined;
        throw new Error(
          `Unable to open browser storage. Allow site data and use a current browser. ${error.message}`,
        );
      });
  }
  return (await connection)(path, options);
}
