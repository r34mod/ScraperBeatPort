// Test script para probar el scraper de 1001tracklists
const https = require('https');
const http = require('http');

function testScraper() {
    const postData = JSON.stringify({
        searchType: 'popular'
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/1001tracklists/scrape',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    console.log('🧪 Testeando scraper de 1001tracklists...');
    console.log('📊 Tipo de búsqueda: popular');

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('📨 Respuesta recibida:');
            console.log('Status:', res.statusCode);
            
            try {
                const response = JSON.parse(data);
                console.log('🎯 Resultado:', JSON.stringify(response, null, 2));
                
                if (response.success) {
                    console.log(`✅ Test exitoso: ${response.tracklistsCount} tracklists encontrados`);
                    console.log(`📄 Archivo CSV generado: ${response.filename}`);
                } else {
                    console.log(`❌ Test falló: ${response.error || 'Error desconocido'}`);
                }
            } catch (e) {
                console.log('❌ Error parseando respuesta JSON:', e.message);
                console.log('📜 Respuesta cruda:', data);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`❌ Error en la request: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

// Ejecutar test
testScraper();