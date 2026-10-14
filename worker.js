export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 建表（首次运行访问 /init 触发）
    if (path === '/init' && request.method === 'GET') {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        amount REAL,
        type TEXT,
        handler TEXT,
        remark TEXT,
        share INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /api/records
    if (path === '/api/records' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM records ORDER BY created_at DESC').all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /api/records
    if (path === '/api/records' && request.method === 'POST') {
      const body = await request.json();
      await env.DB.prepare(
        'INSERT INTO records (date, amount, type, handler, remark, share) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(body.date, body.amount, body.type, body.handler, body.remark || '', body.share ? 1 : 0).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DELETE /api/records/:id
    if (path.startsWith('/api/records/') && request.method === 'DELETE') {
      const id = path.split('/').pop();
      await env.DB.prepare('DELETE FROM records WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /api/clear
    if (path === '/api/clear' && request.method === 'POST') {
      await env.DB.prepare('DELETE FROM records').run();
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};
