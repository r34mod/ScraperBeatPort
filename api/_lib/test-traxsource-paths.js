// Test script para verificar las rutas de descarga de Traxsource
const fs = require('fs');
const path = require('path');

console.log('🧪 Verificando estructura de carpetas de Traxsource...');

// Verificar estructura de carpetas
const downloadsDir = path.join(__dirname, 'downloads');
const houseDir = path.join(downloadsDir, 'house');

console.log(`📂 Verificando directorio downloads: ${downloadsDir}`);
console.log(`📂 Existe: ${fs.existsSync(downloadsDir)}`);

if (fs.existsSync(downloadsDir)) {
    const subDirs = fs.readdirSync(downloadsDir).filter(item => {
        return fs.statSync(path.join(downloadsDir, item)).isDirectory();
    });
    console.log(`📁 Subdirectorios encontrados: ${subDirs.join(', ')}`);
    
    // Listar archivos CSV
    subDirs.forEach(dir => {
        const genreDir = path.join(downloadsDir, dir);
        const csvFiles = fs.readdirSync(genreDir).filter(file => file.endsWith('.csv'));
        console.log(`📄 ${dir}: ${csvFiles.length} archivos CSV`);
        csvFiles.forEach(file => {
            console.log(`   - ${file}`);
        });
    });
} else {
    console.log('❌ Directorio downloads no existe');
}

// Verificar también Downloads con mayúscula
const DownloadsDir = path.join(__dirname, 'Downloads');
console.log(`📂 Verificando directorio Downloads: ${DownloadsDir}`);
console.log(`📂 Existe: ${fs.existsSync(DownloadsDir)}`);

if (fs.existsSync(DownloadsDir)) {
    const subDirs = fs.readdirSync(DownloadsDir).filter(item => {
        return fs.statSync(path.join(DownloadsDir, item)).isDirectory();
    });
    console.log(`📁 Subdirectorios encontrados: ${subDirs.join(', ')}`);
}