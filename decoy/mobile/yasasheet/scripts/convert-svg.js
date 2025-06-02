const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../src/assets');

// SVGファイルを取得
const svgFiles = fs.readdirSync(assetsDir).filter(file => file.endsWith('.svg'));

// 各SVGファイルをPNGに変換
svgFiles.forEach(svgFile => {
  const svgPath = path.join(assetsDir, svgFile);
  const pngPath = path.join(assetsDir, svgFile.replace('.svg', '.png'));

  sharp(svgPath)
    .resize(400, 400)
    .png()
    .toFile(pngPath)
    .then(() => console.log(`Converted ${svgFile} to PNG`))
    .catch(err => console.error(`Error converting ${svgFile}:`, err));
}); 