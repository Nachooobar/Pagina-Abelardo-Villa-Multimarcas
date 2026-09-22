const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- TEST 1: HOME PAGE ---');
  const home = await fetch('http://localhost:3000/');
  console.log('Status:', home.status);
  console.log('Has logo-light.svg:', home.data.includes('logo-light.svg'));
  console.log('Has AutoDealer schema:', home.data.includes('AutoDealer'));
  console.log('Has skip-to-content:', home.data.includes('skip-to-content'));
  console.log('Has id="mainContent":', home.data.includes('id="mainContent"'));
  console.log('Has canonical:', home.data.includes('rel="canonical"'));
  console.log('Has og:title:', home.data.includes('og:title'));
  console.log('Has og:image:', home.data.includes('og:image'));

  console.log('\n--- TEST 2: CATALOGO ---');
  const cat = await fetch('http://localhost:3000/catalogo');
  console.log('Status:', cat.status);
  console.log('Has 400x300 dimensions:', cat.data.includes('width="400"') && cat.data.includes('height="300"'));
  console.log('Has aspect-ratio 4 / 3:', cat.data.includes('aspect-ratio: 4 / 3'));
  console.log('Has loading="lazy":', cat.data.includes('loading="lazy"'));
  console.log('Has decoding="async":', cat.data.includes('decoding="async"'));

  console.log('\n--- TEST 3: FICHA DE VEHICULO ---');
  const detail = await fetch('http://localhost:3000/auto/toyota-corolla-1');
  console.log('Status:', detail.status);
  console.log('Has Car schema:', detail.data.includes('schema.org') && detail.data.includes('Car'));
  console.log('Has Offer schema:', detail.data.includes('Offer'));
  console.log('Has loading="eager":', detail.data.includes('loading="eager"'));
  console.log('Has fetchpriority="high":', detail.data.includes('fetchpriority="high"'));
  console.log('Has 4:3 ratio:', detail.data.includes('aspect-ratio: 4 / 3'));

  console.log('\n--- TEST 4: ROBOTS.TXT & SITEMAP.XML ---');
  const robots = await fetch('http://localhost:3000/robots.txt');
  console.log('Robots status:', robots.status, '| Includes sitemap:', robots.data.includes('sitemap.xml'));
  const sitemap = await fetch('http://localhost:3000/sitemap.xml');
  console.log('Sitemap status:', sitemap.status, '| Includes urlset:', sitemap.data.includes('<urlset'));
}

run().catch(console.error);
