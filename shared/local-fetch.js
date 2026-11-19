import { registerRoutes } from './routes.js';

// Run the same API handlers in a browser without an HTTP server.
export function createLocalFetch(db) {
  const routes = [];
  const router = Object.fromEntries(
    ['get', 'post', 'put', 'delete'].map((method) => [
      method,
      (path, handler) => {
        routes.push({ method: method.toUpperCase(), parts: path.split('/'), handler });
      },
    ]),
  );
  registerRoutes(router, db);
  return async (path, options = {}) => {
    options.signal?.throwIfAborted();
    const url = new URL(path, 'https://spendwise.local');
    const parts = (url.pathname.startsWith('/api/') ? url.pathname : `/api${url.pathname}`).split(
      '/',
    );
    const method = options.method || 'GET';
    const route = routes.find(
      (route) =>
        route.method === method &&
        route.parts.length === parts.length &&
        route.parts.every((part, i) => part.startsWith(':') || part === parts[i]),
    );
    if (!route) return Response.json({ error: 'API endpoint not found.' }, { status: 404 });
    let status = 200,
      output = null;
    const headers = new Headers();
    const response = {
      status(code) {
        status = code;
        return this;
      },
      set(name, value) {
        headers.set(name, value);
        return this;
      },
      attachment(name) {
        headers.set('Content-Disposition', `attachment; filename="${name}"`);
        return this;
      },
      json(value) {
        headers.set('Content-Type', 'application/json');
        output = JSON.stringify(value);
        return this;
      },
      send(value) {
        output = value;
        return this;
      },
      sendStatus(code) {
        status = code;
        return this;
      },
    };
    try {
      let body;
      if (['POST', 'PUT'].includes(method)) {
        try {
          body = JSON.parse(options.body);
        } catch {
          throw Object.assign(new Error('Send a valid JSON object.'), { status: 400 });
        }
        if (!body || typeof body !== 'object' || Array.isArray(body))
          throw Object.assign(new Error('Send a JSON object with the required fields.'), {
            status: 400,
          });
      }
      const params = Object.fromEntries(
        route.parts.flatMap((part, i) => (part.startsWith(':') ? [[part.slice(1), parts[i]]] : [])),
      );
      const query = Object.fromEntries(url.searchParams);
      if ([...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length > 1))
        throw Object.assign(new Error('Duplicate filters are not supported.'), { status: 400 });
      await route.handler({ params, query, body, method }, response);
    } catch (error) {
      if (error.code === '23505')
        response
          .status(409)
          .json({ error: 'This category or monthly category budget already exists.' });
      else if (error.code === '23503')
        response
          .status(400)
          .json({ error: 'Choose an existing category with the correct transaction type.' });
      else {
        const code =
          error.status || (['23514', '22003', '22007', '22008'].includes(error.code) ? 400 : 500);
        response.status(code).json({
          error:
            code < 500
              ? error.message
              : 'Unable to complete request. Check the database connection and setup.',
        });
      }
    }
    options.signal?.throwIfAborted();
    return new Response(status === 204 ? null : output, { status, headers });
  };
}
