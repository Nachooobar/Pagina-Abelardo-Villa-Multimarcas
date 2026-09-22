const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('1. Realizando login...');
  const postData = 'username=admin&password=ABELARDO2096';
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);

  console.log('Login status:', loginRes.status);
  const cookie = loginRes.headers['set-cookie'];
  console.log('Set-Cookie received:', !!cookie);

  if (!cookie) {
    console.error('No se recibió cookie de sesión. Body:', loginRes.body);
    return;
  }

  const cookieHeader = cookie.map(c => c.split(';')[0]).join('; ');

  const routesToTest = [
    { path: '/admin', name: 'Dashboard' },
    { path: '/admin/autos', name: 'Vehiculos' },
    { path: '/admin/autos/nuevo', name: 'Nuevo Auto' },
    { path: '/admin/consultas', name: 'Consultas' },
    { path: '/admin/config', name: 'Ajustes' }
  ];

  for (const r of routesToTest) {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: r.path,
      method: 'GET',
      headers: { 'Cookie': cookieHeader }
    });
    console.log(`[${r.name}] ${r.path} -> Status: ${res.status} | Length: ${res.body.length}`);
    if (res.status !== 200) {
      console.error(`Error en ${r.name}:`, res.body.substring(0, 300));
    }
  }
}

run().catch(console.error);
