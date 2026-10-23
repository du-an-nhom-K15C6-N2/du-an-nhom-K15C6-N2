const fs = require('fs');
const path = require('path');

const targetProject = process.argv[2] || 'D:/FILETONG/aaaaa';
const sourceDir = path.resolve(__dirname, 'project-source');

console.log('='.repeat(64));
console.log(`🚀 BẮT ĐẦU GHÉP MÃ NGUỒN DNKN-14 VÀO DỰ ÁN CHÍNH:`);
console.log(`   Nguồn: ${sourceDir}`);
console.log(`   Đích:  ${targetProject}`);
console.log('='.repeat(64));

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(` ✓ Đã ghép: ${path.relative(sourceDir, src)}`);
  }
}

try {
  copyRecursive(sourceDir, targetProject);
  console.log('='.repeat(64));
  console.log('🎉 GHÉP MÃ NGUỒN THÀNH CÔNG 100%!');
  console.log('   Bạn có thể chuyển tới D:\\FILETONG\\aaaaa và chạy "npm test" để kiểm tra.');
  console.log('='.repeat(64));
} catch (error) {
  console.error('❌ Lỗi trong quá trình ghép mã nguồn:', error);
  process.exit(1);
}
