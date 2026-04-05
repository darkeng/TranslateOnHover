const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const OUT_DIR = 'dist';

async function build() {
  console.log('Starting build process...');

  // 1. Clean output directory
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_DIR);

  try {
    // 2. Minify JS & CSS using esbuild
    await esbuild.build({
      entryPoints: [
        'src/background/background.js',
        'src/content/content.js',
        'src/content/content.css',
        'src/options/options.js',
        'src/options/options.css'
      ],
      outdir: OUT_DIR + '/src',
      minify: true,
      bundle: false, // Since this is a simple extension without node_modules imports, we just minify in place
      target: ['es2020'],
      format: 'esm'
    });
    console.log('Successfully minified JS and CSS.');

    // 3. Copy Static Assets
    const filesToCopy = ['manifest.json', 'src/options/options.html'];
    filesToCopy.forEach(file => {
      const dest = path.join(OUT_DIR, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
    });

    // Copy Directories (_locales, assets)
    copyDirRecursively('_locales', path.join(OUT_DIR, '_locales'));
    copyDirRecursively('assets', path.join(OUT_DIR, 'assets'));
    
    console.log('Copied static assets and HTML.');

    // 4. Zip the results
    await createZipManifest(OUT_DIR, 'TranslateOnHover_Production.zip');
    
  } catch (err) {
    console.error('Build Failed:', err);
    process.exit(1);
  }
}

function copyDirRecursively(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirRecursively(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createZipManifest(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    // Also backup the root zip for easy deployment
    const rootOutPath = path.join(__dirname, outPath);
    const output = fs.createWriteStream(rootOutPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Successfully created ZIP archive: ${outPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

build();
