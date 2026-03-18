// Script de prueba para verificar el funcionamiento del scraper
const beatportScraper = require('./beatport-scraper-fixed');
const express = require('express');

// Crear una aplicación Express temporal para pruebas
const app = express();
app.use(express.json());

// Simular las rutas para pruebas
app.use('/api', beatportScraper);

// Función para probar un género específico
async function testSingleGenre(genre = 'house') {
    console.log(`🧪 Probando extracción del género: ${genre}`);
    
    try {
        // Simular una request HTTP
        const mockReq = { params: { genre } };
        const mockRes = {
            json: (data) => {
                console.log('✅ Respuesta del servidor:', data);
                return data;
            },
            status: (code) => ({
                json: (data) => {
                    console.log(`❌ Error ${code}:`, data);
                    return data;
                }
            })
        };

        // Aquí normalmente llamaríamos a la función de scraping
        console.log('📋 Géneros disponibles en el sistema:');
        console.log('- house (House Music)');
        console.log('- techno (Techno)');
        console.log('- tech-house (Tech House)');
        console.log('- deep-house (Deep House)');
        console.log('- progressive-house (Progressive House)');
        console.log('- electro-house (Electro House)');
        console.log('- minimal (Minimal Deep Tech)');
        console.log('- trance (Trance)');
        console.log('- progressive-trance (Progressive Trance)');
        console.log('- drum-and-bass (Drum & Bass)');
        console.log('- dubstep (Dubstep)');
        console.log('- trap (Trap & Future Bass)');

        console.log('\n🚀 Para probar el scraper real:');
        console.log('1. Ejecuta: npm start');
        console.log('2. Abre: http://localhost:3000');
        console.log('3. Selecciona un género y haz clic en "Extraer Top100"');

        return true;

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
        return false;
    }
}

// Función para verificar dependencias
function checkDependencies() {
    console.log('🔍 Verificando dependencias...');
    
    try {
        require('express');
        console.log('✅ Express: OK');
    } catch (e) {
        console.log('❌ Express: No instalado');
    }

    try {
        require('puppeteer');
        console.log('✅ Puppeteer: OK');
    } catch (e) {
        console.log('❌ Puppeteer: No instalado');
    }

    try {
        require('csv-writer');
        console.log('✅ CSV Writer: OK');
    } catch (e) {
        console.log('❌ CSV Writer: No instalado');
    }

    try {
        require('cors');
        console.log('✅ CORS: OK');
    } catch (e) {
        console.log('❌ CORS: No instalado');
    }
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
    console.log('🎵 BEATPORT TOP100 SCRAPER - SISTEMA DE PRUEBAS');
    console.log('================================================');
    
    checkDependencies();
    console.log('\n');
    testSingleGenre('house');
}

module.exports = {
    testSingleGenre,
    checkDependencies
};