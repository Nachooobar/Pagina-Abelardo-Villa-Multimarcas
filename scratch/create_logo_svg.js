const fs = require('fs');
const path = require('path');

// Read the cropped banner PNG
const bannerPath = path.join(__dirname, '../public/images/logo-abelardo-banner.png');
const bannerBuf = fs.readFileSync(bannerPath);

// Save directly to public/images/logo.png (overwriting the old JFIF file)
const logoPngPath = path.join(__dirname, '../public/images/logo.png');
fs.writeFileSync(logoPngPath, bannerBuf);
console.log('Saved public/images/logo.png (size: ' + bannerBuf.length + ' bytes)');

// Convert to base64 for embedding cleanly inside SVG
const base64Png = bannerBuf.toString('base64');
const dataUri = `data:image/png;base64,${base64Png}`;

// Create SVG with exact viewBox and crisp rendering
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 972 260" width="972" height="260">
  <defs>
    <clipPath id="logoRounded">
      <rect width="972" height="260" rx="8" ry="8"/>
    </clipPath>
  </defs>
  <g clip-path="url(#logoRounded)">
    <image href="${dataUri}" width="972" height="260" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>`;

// Write to public/images/logo.svg, logo-light.svg, and logo-dark.svg
fs.writeFileSync(path.join(__dirname, '../public/images/logo.svg'), svgContent, 'utf8');
fs.writeFileSync(path.join(__dirname, '../public/images/logo-light.svg'), svgContent, 'utf8');
fs.writeFileSync(path.join(__dirname, '../public/images/logo-dark.svg'), svgContent, 'utf8');

console.log('Generated logo.svg, logo-light.svg, logo-dark.svg');
