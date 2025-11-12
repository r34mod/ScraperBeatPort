// Test de descarga para Traxsource
const http = require('http');
const fs = require('fs');

function testDownload() {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/traxsource/download/house/traxsource_house_top100_2025-11-10.csv',
        method: 'GET'
    };

    console.log('🧪 Testeando descarga de Traxsource...');
    console.log(`📥 URL: http://localhost:3000${options.path}`);

    const req = http.request(options, (res) => {
        console.log(`📊 Status: ${res.statusCode}`);
        console.log(`📋 Headers:`, res.headers);

        if (res.statusCode === 200) {
            console.log('✅ Descarga exitosa');
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📄 Tamaño del archivo: ${data.length} caracteres`);
                console.log(`📝 Primeras líneas del CSV:`);
                console.log(data.substring(0, 500));
                
                // Guardar archivo de prueba
                fs.writeFileSync('test-traxsource-download.csv', data);
                console.log('💾 Archivo guardado como test-traxsource-download.csv');
            });
        } else {
            console.log(`❌ Error: Status ${res.statusCode}`);
            let errorData = '';
            res.on('data', (chunk) => {
                errorData += chunk;
            });
            res.on('end', () => {
                console.log('📜 Respuesta de error:', errorData);
            });
        }
    });

    req.on('error', (e) => {
        console.error(`❌ Error en la request: ${e.message}`);
    });

    req.end();
}

testDownload();