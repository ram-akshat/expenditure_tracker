import * as v from './validation.js';

const details = `SELECT t.*, c.category_name FROM transactions t JOIN categories c USING (category_id)`;
const budgetDetails = `SELECT b.*, c.category_name,
  COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = b.user_id
    AND t.category_id = b.category_id AND t.transaction_type = 'Expense'
    AND t.transaction_date >= b.budget_month AND t.transaction_date < b.budget_month + interval '1 month'), 0) AS spent
  FROM budgets b JOIN categories c USING (category_id)`;

export function registerRoutes(app, db) {
  app.get('/api/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res
        .status(503)
        .json({ error: 'Database unavailable. Check configuration and run database setup.' });
    }
  });
  app.get('/api/user', async (req, res) => {
    const { rows } = await db.query('SELECT user_id, name, email FROM users WHERE user_id = 1');
    if (!rows.length) v.fail('Run database setup to create the local user.', 503);
    res.json(rows[0]);
  });
  app.get('/api/categories', async (req, res) => {
    const { rows } = await db.query(
      'SELECT * FROM categories ORDER BY category_type, category_name',
    );
    res.json(rows);
  });
  app.post('/api/categories', async (req, res) => {
    const name = v.text(req.body.category_name, 'Category name', 50, true);
    const type = v.type(req.body.category_type);
    const { rows } = await db.query(
      'INSERT INTO categories (category_name, category_type) VALUES ($1, $2) RETURNING *',
      [name, type],
    );
    res.status(201).json(rows[0]);
  });

  app.get('/api/transactions/export', async (req, res) => {
    const filter = v.filters(req.query);
    const { rows } = await db.query(
      `${details} WHERE ${filter.sql} ORDER BY t.transaction_date DESC, t.transaction_id DESC`,
      filter.values,
    );
    const columns = [
      'transaction_id',
      'transaction_date',
      'transaction_type',
      'category_name',
      'amount',
      'description',
      'merchant_city',
    ];
    const escape = (value) => {
      let cell = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '');
      if (/^\s*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = `'${cell}`;
      return `"${cell.replaceAll('"', '""')}"`;
    };
    const csv = [
      columns.join(','),
      ...rows.map((row) => columns.map((key) => escape(row[key])).join(',')),
    ].join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('spendwise-transactions.csv').send('\uFEFF' + csv);
  });
  app.get('/api/transactions', async (req, res) => {
    const filter = v.filters(req.query);
    const page = v.integer(req.query.page ?? 1, 'Page', 1000000);
    const limit = v.integer(req.query.limit ?? 20, 'Limit', 100);
    const count = await db.query(
      `SELECT COUNT(*)::int AS total FROM transactions t JOIN categories c USING (category_id) WHERE ${filter.sql}`,
      filter.values,
    );
    const { rows } = await db.query(
      `${details} WHERE ${filter.sql} ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT $${filter.values.length + 1} OFFSET $${filter.values.length + 2}`,
      [...filter.values, limit, (page - 1) * limit],
    );
    res.json({ data: rows, pagination: { page, limit, total: count.rows[0].total } });
  });
  app.get('/api/transactions/:id', async (req, res) => {
    const { rows } = await db.query(`${details} WHERE t.transaction_id = $1 AND t.user_id = 1`, [
      v.integer(req.params.id),
    ]);
    if (!rows.length) v.fail('Transaction not found.', 404);
    res.json(rows[0]);
  });
  const saveTransaction = async (req, res) => {
    const values = Object.values(v.transaction(req.body));
    let result;
    if (req.method === 'POST') {
      result = await db.query(
        `INSERT INTO transactions (category_id, amount, transaction_type, description, transaction_date, merchant_city, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *`,
        values,
      );
    } else {
      result = await db.query(
        `UPDATE transactions SET category_id = $1, amount = $2, transaction_type = $3,
        description = $4, transaction_date = $5, merchant_city = $6 WHERE transaction_id = $7 AND user_id = 1 RETURNING *`,
        [...values, v.integer(req.params.id)],
      );
    }
    if (!result.rows.length) v.fail('Transaction not found.', 404);
    res.status(req.method === 'POST' ? 201 : 200).json(result.rows[0]);
  };
  app.post('/api/transactions', saveTransaction);
  app.put('/api/transactions/:id', saveTransaction);
  app.delete('/api/transactions/:id', async (req, res) => {
    const { rows } = await db.query(
      'DELETE FROM transactions WHERE transaction_id = $1 AND user_id = 1 RETURNING transaction_id',
      [v.integer(req.params.id)],
    );
    if (!rows.length) v.fail('Transaction not found.', 404);
    res.sendStatus(204);
  });

  app.get('/api/budgets', async (req, res) => {
    const { rows } = await db.query(
      `${budgetDetails} WHERE b.user_id = 1 AND b.budget_month = $1::date ORDER BY c.category_name`,
      [v.month(req.query.month)],
    );
    res.json(
      rows.map((row) => ({
        ...row,
        remaining: Number(row.monthly_limit) - Number(row.spent),
        utilization: Math.round((Number(row.spent) / Number(row.monthly_limit)) * 10000) / 100,
      })),
    );
  });
  const saveBudget = async (req, res) => {
    const values = Object.values(v.budget(req.body));
    let result;
    if (req.method === 'POST') {
      result = await db.query(
        'INSERT INTO budgets (category_id, monthly_limit, budget_month, user_id) VALUES ($1, $2, $3, 1) RETURNING *',
        values,
      );
    } else {
      result = await db.query(
        'UPDATE budgets SET category_id = $1, monthly_limit = $2, budget_month = $3 WHERE budget_id = $4 AND user_id = 1 RETURNING *',
        [...values, v.integer(req.params.id)],
      );
    }
    if (!result.rows.length) v.fail('Budget not found.', 404);
    res.status(req.method === 'POST' ? 201 : 200).json(result.rows[0]);
  };
  app.post('/api/budgets', saveBudget);
  app.put('/api/budgets/:id', saveBudget);
  app.delete('/api/budgets/:id', async (req, res) => {
    const { rows } = await db.query(
      'DELETE FROM budgets WHERE budget_id = $1 AND user_id = 1 RETURNING budget_id',
      [v.integer(req.params.id)],
    );
    if (!rows.length) v.fail('Budget not found.', 404);
    res.sendStatus(204);
  });

  app.get('/api/analytics/summary', async (req, res) => {
    const month = v.month(req.query.month);
    const { rows } = await db.query(
      `SELECT
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Income'), 0) AS income,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'Expense'), 0) AS expenses,
      COUNT(*)::int AS transaction_count
      FROM transactions WHERE user_id = 1 AND transaction_date >= $1::date AND transaction_date < $1::date + interval '1 month'`,
      [month],
    );
    const budgets = await db.query(
      'SELECT COALESCE(SUM(monthly_limit), 0) AS budget FROM budgets WHERE user_id = 1 AND budget_month = $1::date',
      [month],
    );
    const budgeted = await db.query(
      `SELECT COALESCE(SUM(t.amount), 0) AS spent FROM transactions t
      WHERE t.user_id = 1 AND t.transaction_type = 'Expense' AND t.transaction_date >= $1::date
      AND t.transaction_date < $1::date + interval '1 month'
      AND EXISTS (SELECT 1 FROM budgets b WHERE b.user_id = t.user_id AND b.category_id = t.category_id AND b.budget_month = $1::date)`,
      [month],
    );
    const income = Number(rows[0].income),
      expenses = Number(rows[0].expenses),
      budget = Number(budgets.rows[0].budget);
    res.json({
      month: month.slice(0, 7),
      income,
      expenses,
      balance: Math.round((income - expenses) * 100) / 100,
      transaction_count: rows[0].transaction_count,
      budget,
      budgeted_spending: Number(budgeted.rows[0].spent),
      budget_utilization: budget
        ? Math.round((Number(budgeted.rows[0].spent) / budget) * 10000) / 100
        : 0,
    });
  });
  app.get('/api/analytics/categories', async (req, res) => {
    const { rows } = await db.query(
      `SELECT c.category_id, c.category_name, COALESCE(SUM(t.amount), 0) AS amount
      FROM categories c LEFT JOIN transactions t ON t.category_id = c.category_id AND t.user_id = 1
      AND t.transaction_date >= $1::date AND t.transaction_date < $1::date + interval '1 month'
      WHERE c.category_type = 'Expense' GROUP BY c.category_id ORDER BY amount DESC, c.category_name`,
      [v.month(req.query.month)],
    );
    res.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
  });
  app.get('/api/analytics/monthly', async (req, res) => {
    const { rows } = await db.query(
      `SELECT to_char(m.month, 'YYYY-MM') AS month,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Income'), 0) AS income,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'Expense'), 0) AS expenses
      FROM generate_series($1::date - interval '5 months', $1::date, interval '1 month') AS m(month)
      LEFT JOIN transactions t ON t.user_id = 1 AND t.transaction_date >= m.month AND t.transaction_date < m.month + interval '1 month'
      GROUP BY m.month ORDER BY m.month`,
      [v.month(req.query.month)],
    );
    res.json(
      rows.map((row) => ({ ...row, income: Number(row.income), expenses: Number(row.expenses) })),
    );
  });
  app.get('/api/analytics/cities', async (req, res) => {
    const { rows } = await db.query(
      `SELECT COALESCE(NULLIF(merchant_city, ''), 'Unspecified') AS city, SUM(amount) AS amount,
      COUNT(*)::int AS transaction_count FROM transactions WHERE user_id = 1 AND transaction_type = 'Expense'
      AND transaction_date >= $1::date AND transaction_date < $1::date + interval '1 month'
      GROUP BY COALESCE(NULLIF(merchant_city, ''), 'Unspecified') ORDER BY amount DESC`,
      [v.month(req.query.month)],
    );
    res.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
  });
}
