export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function integer(value, name = 'ID', max = 2147483647) {
  if (
    !['string', 'number'].includes(typeof value) ||
    !/^[1-9]\d*$/.test(String(value)) ||
    Number(value) > max
  )
    fail(`${name} must be a positive integer.`);
  return Number(value);
}

export function text(value, name, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    fail(`${name} must be ${required ? 'non-empty text' : 'text'} up to ${max} characters.`);
  }
  return value.trim();
}

export function type(value) {
  if (!['Income', 'Expense'].includes(value)) fail('Type must be Income or Expense.');
  return value;
}

export function amount(value, name = 'Amount') {
  if (
    !['string', 'number'].includes(typeof value) ||
    !/^\d+(\.\d{1,2})?$/.test(String(value)) ||
    Number(value) <= 0 ||
    Number(value) > 99999999.99
  ) {
    fail(`${name} must be between 0.01 and 99,999,999.99 with at most two decimal places.`);
  }
  return String(value);
}

export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail('Date must use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    value < '1900-01-01' ||
    value > '2100-12-31'
  )
    fail('Enter a valid date between 1900 and 2100.');
  return value;
}

export function month(value = new Date().toISOString().slice(0, 7)) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) fail('Month must use YYYY-MM.');
  return date(`${value}-01`);
}

export function transaction(body) {
  return {
    category_id: integer(body.category_id, 'Category'),
    amount: amount(body.amount),
    transaction_type: type(body.transaction_type),
    description: text(body.description, 'Description', 500),
    transaction_date: date(body.transaction_date),
    merchant_city: text(body.merchant_city, 'City', 100),
  };
}

export function budget(body) {
  return {
    category_id: integer(body.category_id, 'Category'),
    monthly_limit: amount(body.monthly_limit, 'Budget'),
    budget_month: month(body.budget_month),
  };
}

export function filters(query) {
  const allowed = ['month', 'type', 'category_id', 'from', 'to', 'city', 'search', 'page', 'limit'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) fail('Unknown transaction filter.');
  const values = [1];
  const clauses = ['t.user_id = $1'];
  const add = (sql, value) => {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  };
  if (query.month !== undefined) {
    add('t.transaction_date >= ?::date', month(query.month));
    clauses.push(`t.transaction_date < $${values.length}::date + interval '1 month'`);
  }
  if (query.type !== undefined && query.type !== '')
    add('t.transaction_type = ?', type(query.type));
  if (query.category_id !== undefined && query.category_id !== '')
    add('t.category_id = ?', integer(query.category_id, 'Category'));
  if (query.from !== undefined && query.from !== '')
    add('t.transaction_date >= ?::date', date(query.from));
  if (query.to !== undefined && query.to !== '')
    add('t.transaction_date <= ?::date', date(query.to));
  if (query.from && query.to && query.from > query.to) fail('Start date must be before end date.');
  if (query.city !== undefined && query.city !== '')
    add(
      "t.merchant_city ILIKE ? ESCAPE '!'",
      text(query.city, 'City', 100).replace(/[!%_]/g, '!$&'),
    );
  if (query.search !== undefined && query.search !== '') {
    const search = text(query.search, 'Search', 100).replace(/[!%_]/g, '!$&');
    add(
      `(t.description ILIKE ? ESCAPE '!' OR c.category_name ILIKE $${values.length + 1} ESCAPE '!')`,
      `%${search}%`,
    );
  }
  return { sql: clauses.join(' AND '), values };
}
