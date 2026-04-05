const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const sourcePath = path.join(__dirname, 'assets', 'icon.png');
  if (!fs.existsSync(sourcePath)) {
    console.error("icon.png not found in assets/");
    process.exit(1);
  }

  const sizes = [16, 48, 128];
  
  for (const size of sizes) {
    const outPath = path.join(__dirname, 'assets', `icon${size}.png`);
    await sharp(sourcePath)
      .resize(size, size)
      // Setting density to ensure scalable conversion maintains extreme crispness
      .png({ quality: 100 })
      .toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
}

generateIcons().catch(err => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
