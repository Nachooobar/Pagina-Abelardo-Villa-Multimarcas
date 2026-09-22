const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
process.env.CHROME_PATH = chromePath;

const urls = [
  { name: 'home', url: 'http://localhost:3000/' },
  { name: 'catalogo', url: 'http://localhost:3000/catalogo' },
  { name: 'detalle', url: 'http://localhost:3000/auto/toyota-corolla-1' }
];

console.log('Starting Lighthouse Audits on Mobile...\n');

const results = {};

for (const target of urls) {
  const outputPath = path.join(__dirname, `lh-${target.name}.json`);
  console.log(`Running Lighthouse on ${target.name} (${target.url})...`);

  try {
    const cmd = `npx -y lighthouse ${target.url} --output=json --output-path="${outputPath}" --chrome-flags="--headless --no-sandbox" --form-factor=mobile --quiet`;
    execSync(cmd, { stdio: 'pipe', timeout: 120000 });

    if (fs.existsSync(outputPath)) {
      const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      const categories = data.categories;
      results[target.name] = {
        performance: Math.round((categories.performance?.score || 0) * 100),
        accessibility: Math.round((categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
        seo: Math.round((categories.seo?.score || 0) * 100)
      };
      console.log(`✓ ${target.name.toUpperCase()} Scores:`, results[target.name]);
    }
  } catch (err) {
    console.error(`Error auditing ${target.name}:`, err.message);
  }
}

console.log('\n--- FINAL LIGHTHOUSE AUDIT REPORT ---');
console.table(results);
