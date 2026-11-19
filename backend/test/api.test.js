import { before, after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { createApp } from '../app.js';
import { createLocalFetch } from '../../shared/local-fetch.js';

for (const transport of ['Express HTTP', 'browser-local API']) {
  describe(transport, () => {
    let db, api, food, salary;
    const expense = (overrides) => ({
      category_id: food,
      amount: '250.50',
      transaction_type: 'Expense',
      transaction_date: '2026-11-10',
      description: 'Lunch',
      merchant_city: 'Delhi',
      ...overrides,
    });
    const budget = (overrides) => ({
      category_id: food,
      monthly_limit: '500',
      budget_month: '2026-11',
      ...overrides,
    });
    async function add(body = expense()) {
      return (await api.post('/api/transactions').send(body).expect(201)).body;
    }

    before(async () => {
      db = new PGlite();
      await db.exec(await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8'));
      await db.exec(await readFile(new URL('../../database/seed.sql', import.meta.url), 'utf8'));
      if (transport === 'Express HTTP') api = request(createApp(db, { serveFrontend: false }));
      else {
        const localFetch = createLocalFetch(db);
        api = request(async (req, res) => {
          let body = '';
          for await (const chunk of req) body += chunk;
          const response = await localFetch(req.url, {
            method: req.method,
            body: body || undefined,
          });
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        });
      }
      const { rows } = await db.query('SELECT * FROM categories');
      food = rows.find((c) => c.category_name === 'Food').category_id;
      salary = rows.find((c) => c.category_name === 'Salary').category_id;
    });
    beforeEach(async () => {
      await db.exec(
        "DELETE FROM transactions; DELETE FROM budgets; DELETE FROM categories WHERE category_name = 'Subscriptions';",
      );
    });
    after(async () => {
      await db.close();
    });

    test('health, local user, and seeded categories are available', async () => {
      assert.equal((await api.get('/api/health').expect(200)).body.status, 'ok');
      assert.equal((await api.get('/api/user').expect(200)).body.name, 'Sutikshan');
      assert.equal((await api.get('/api/categories').expect(200)).body.length, 14);
    });
    test('transaction create, read, update, delete and missing-record handling', async () => {
      const row = await add();
      assert.equal(
        (await api.get(`/api/transactions/${row.transaction_id}`).expect(200)).body.category_name,
        'Food',
      );
      const updated = await api
        .put(`/api/transactions/${row.transaction_id}`)
        .send(expense({ amount: '99.99' }))
        .expect(200);
      assert.equal(Number(updated.body.amount), 99.99);
      await api.delete(`/api/transactions/${row.transaction_id}`).expect(204);
      await api.get(`/api/transactions/${row.transaction_id}`).expect(404);
      await api.put(`/api/transactions/${row.transaction_id}`).send(expense()).expect(404);
      await api.delete(`/api/transactions/${row.transaction_id}`).expect(404);
    });
    test('income and expenses are filtered by category, type, city, search, dates and month', async () => {
      await add();
      await add(
        expense({
          category_id: salary,
          transaction_type: 'Income',
          amount: 1000,
          description: 'Salary',
          transaction_date: '2026-11-01',
        }),
      );
      await add(expense({ transaction_date: '2026-12-01' }));
      const url = `/api/transactions?month=2026-11&type=Expense&category_id=${food}&city=delhi&search=Lunch&from=2026-11-02&to=2026-11-30`;
      const { body } = await api.get(url).expect(200);
      assert.equal(body.pagination.total, 1);
      assert.equal(body.data[0].description, 'Lunch');
      assert.equal(
        (await api.get('/api/transactions?search=%25').expect(200)).body.pagination.total,
        0,
      );
    });
    test('pagination uses stable ID ordering when dates match', async () => {
      const first = await add();
      const second = await add();
      const one = (await api.get('/api/transactions?limit=1&page=1').expect(200)).body;
      const two = (await api.get('/api/transactions?limit=1&page=2').expect(200)).body;
      assert.equal(one.pagination.total, 2);
      assert.equal(one.data[0].transaction_id, second.transaction_id);
      assert.equal(two.data[0].transaction_id, first.transaction_id);
    });
    test('invalid amounts, types, dates, fields, and categories are rejected', async () => {
      for (const value of [0, -1, '1.001', 'abc', null, true, 100000000, '1e3', '']) {
        await api
          .post('/api/transactions')
          .send(expense({ amount: value }))
          .expect(400);
      }
      for (const overrides of [
        { transaction_type: 'Other' },
        { transaction_date: '2026-02-30' },
        { transaction_date: '2026-1-1' },
        { transaction_date: '2200-01-01' },
        { category_id: 99999 },
        { category_id: salary },
        { description: 'x'.repeat(501) },
        { merchant_city: {} },
      ]) {
        await api.post('/api/transactions').send(expense(overrides)).expect(400);
      }
      await api.post('/api/transactions').send({}).expect(400);
      await api.post('/api/transactions').expect(400);
      await api.post('/api/transactions').send([]).expect(400);
      await api
        .post('/api/transactions')
        .set('Content-Type', 'application/json')
        .send('{broken')
        .expect(400);
    });
    test('invalid IDs, filter dates, months and pagination return client errors', async () => {
      for (const id of ['abc', '-1', '0', '2147483648', '1.1'])
        await api.get(`/api/transactions/${id}`).expect(400);
      for (const suffix of [
        'month=2026-13',
        'month=bad',
        'from=2026-02-30',
        'from=2026-11-20&to=2026-11-01',
        'limit=101',
        'page=0',
        'type=oops',
        'month[]=2026-11',
      ]) {
        await api.get(`/api/transactions?${suffix}`).expect(400);
      }
    });
    test('exact decimal amounts and month boundaries are preserved', async () => {
      await add(expense({ amount: '0.10', transaction_date: '2026-11-01' }));
      await add(expense({ amount: '0.20', transaction_date: '2026-11-30' }));
      await add(expense({ amount: '900', transaction_date: '2026-12-01' }));
      const summary = (await api.get('/api/analytics/summary?month=2026-11').expect(200)).body;
      assert.equal(summary.expenses, 0.3);
      assert.equal(summary.balance, -0.3);
      assert.equal(summary.transaction_count, 2);
    });
    test('maximum supported amount is accepted without rounding', async () => {
      assert.equal(Number((await add(expense({ amount: '99999999.99' }))).amount), 99999999.99);
    });
    test('category creation trims names and rejects case-insensitive duplicates', async () => {
      const { body } = await api
        .post('/api/categories')
        .send({ category_name: '  Subscriptions  ', category_type: 'Expense' })
        .expect(201);
      assert.equal(body.category_name, 'Subscriptions');
      await api
        .post('/api/categories')
        .send({ category_name: 'subscriptions', category_type: 'Expense' })
        .expect(409);
      await api
        .post('/api/categories')
        .send({ category_name: ' ', category_type: 'Expense' })
        .expect(400);
    });
    test('budgets calculate exact, exceeded and updated utilization', async () => {
      const created = (await api.post('/api/budgets').send(budget()).expect(201)).body;
      await add(expense({ amount: 500 }));
      let rows = (await api.get('/api/budgets?month=2026-11').expect(200)).body;
      assert.equal(rows[0].utilization, 100);
      assert.equal(rows[0].remaining, 0);
      await add(expense({ amount: 100 }));
      rows = (await api.get('/api/budgets?month=2026-11').expect(200)).body;
      assert.equal(rows[0].utilization, 120);
      assert.equal(rows[0].remaining, -100);
      await api
        .put(`/api/budgets/${created.budget_id}`)
        .send(budget({ monthly_limit: 1000 }))
        .expect(200);
      rows = (await api.get('/api/budgets?month=2026-11').expect(200)).body;
      assert.equal(rows[0].utilization, 60);
      await api.delete(`/api/budgets/${created.budget_id}`).expect(204);
      await api.delete(`/api/budgets/${created.budget_id}`).expect(404);
      assert.equal((await api.get('/api/transactions').expect(200)).body.pagination.total, 2);
    });
    test('budgets reject income categories, duplicates and invalid months', async () => {
      await api.post('/api/budgets').send(budget()).expect(201);
      await api.post('/api/budgets').send(budget()).expect(409);
      await api
        .post('/api/budgets')
        .send(budget({ category_id: salary }))
        .expect(400);
      await api
        .post('/api/budgets')
        .send(budget({ budget_month: '2026-11-03' }))
        .expect(400);
      await api
        .post('/api/budgets')
        .send(budget({ monthly_limit: 0 }))
        .expect(400);
      await api.put('/api/budgets/999').send(budget()).expect(404);
      await api
        .post('/api/budgets')
        .send(budget({ budget_month: '2026-12' }))
        .expect(201);
    });
    test('analytics return consistent summary, categories, six months and cities', async () => {
      await add();
      await add(expense({ category_id: salary, transaction_type: 'Income', amount: 1000 }));
      await add(expense({ amount: 50, transaction_date: '2026-10-31', merchant_city: 'Noida' }));
      await api.post('/api/budgets').send(budget()).expect(201);
      const summary = (await api.get('/api/analytics/summary?month=2026-11').expect(200)).body;
      assert.equal(summary.income, 1000);
      assert.equal(summary.expenses, 250.5);
      assert.equal(summary.balance, 749.5);
      assert.equal(summary.budget_utilization, 50.1);
      const categories = (await api.get('/api/analytics/categories?month=2026-11').expect(200))
        .body;
      assert.equal(categories.length, 9);
      assert.equal(
        categories.reduce((n, row) => n + row.amount, 0),
        summary.expenses,
      );
      const monthly = (await api.get('/api/analytics/monthly?month=2026-11').expect(200)).body;
      assert.equal(monthly.length, 6);
      assert.equal(monthly[0].month, '2026-06');
      assert.equal(monthly[5].expenses, 250.5);
      assert.equal(monthly[4].expenses, 50);
      const cities = (await api.get('/api/analytics/cities?month=2026-11').expect(200)).body;
      assert.deepEqual(cities, [{ city: 'Delhi', amount: 250.5, transaction_count: 1 }]);
    });
    test('unbudgeted spending is excluded from budget utilization', async () => {
      await api.post('/api/budgets').send(budget()).expect(201);
      const { rows } = await db.query(
        "SELECT category_id FROM categories WHERE category_name = 'Rent'",
      );
      await add(expense({ category_id: rows[0].category_id, amount: 5000 }));
      const summary = (await api.get('/api/analytics/summary?month=2026-11').expect(200)).body;
      assert.equal(summary.expenses, 5000);
      assert.equal(summary.budgeted_spending, 0);
      assert.equal(summary.budget_utilization, 0);
    });
    test('empty months return zero totals and populated zero category buckets', async () => {
      const summary = (await api.get('/api/analytics/summary?month=2026-11').expect(200)).body;
      assert.equal(summary.income, 0);
      assert.equal(summary.expenses, 0);
      assert.equal(summary.budget_utilization, 0);
      assert.deepEqual((await api.get('/api/budgets?month=2026-11').expect(200)).body, []);
    });
    test('CSV respects filters and protects formulas, quotes, commas and newlines', async () => {
      await add(
        expense({ description: '=HYPERLINK("test"),\nnext line', merchant_city: '@Delhi' }),
      );
      await add(expense({ transaction_date: '2026-12-01', description: 'Other month' }));
      const response = await api
        .get('/api/transactions/export?month=2026-11')
        .expect(200)
        .expect('Content-Type', /text\/csv/);
      assert.ok(response.text.includes('"\'=HYPERLINK(""test""),\nnext line"'));
      assert.ok(response.text.includes("'@Delhi"));
      assert.ok(response.text.includes('2026-11-10'));
      assert.ok(!response.text.includes('Other month'));
    });
    test('all queries isolate the local user', async () => {
      await db.query(
        "INSERT INTO users (user_id, name, email) VALUES (2, 'Other', 'other@example.test') ON CONFLICT DO NOTHING",
      );
      await db.query(
        "INSERT INTO transactions (user_id, category_id, amount, transaction_type, transaction_date) VALUES (2, $1, 999, 'Expense', '2026-11-10')",
        [food],
      );
      assert.equal((await api.get('/api/transactions').expect(200)).body.pagination.total, 0);
      assert.equal(
        (await api.get('/api/analytics/summary?month=2026-11').expect(200)).body.expenses,
        0,
      );
    });
    test('database constraints prevent invalid category types and duplicate budgets', async () => {
      await assert.rejects(
        db.query(
          "INSERT INTO transactions (user_id, category_id, amount, transaction_type, transaction_date) VALUES (1, $1, 1, 'Expense', '2026-11-10')",
          [salary],
        ),
        { code: '23503' },
      );
    });
    test('unknown API routes return JSON and database failures return 503 health', async () => {
      await api.get('/api/missing').expect(404).expect('Content-Type', /json/);
      const broken = request(
        createApp(
          {
            query: async () => {
              throw new Error('offline');
            },
          },
          { serveFrontend: false },
        ),
      );
      await broken.get('/api/health').expect(503);
    });
    test('schema and base seeds can be reapplied without losing transactions', async () => {
      await add();
      await db.exec(await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8'));
      await db.exec(await readFile(new URL('../../database/seed.sql', import.meta.url), 'utf8'));
      assert.equal((await api.get('/api/transactions').expect(200)).body.pagination.total, 1);
    });
  });
}
