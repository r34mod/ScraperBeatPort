const { createObjectCsvStringifier } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const { uploadCsvToStorage } = require('../scraper-utils');

/**
 * Generates a CSV string from records, uploads to Supabase Storage,
 * and falls back to local disk if storage is unavailable.
 *
 * @param {object} opts
 * @param {object[]} opts.records        - Array of data objects to serialize
 * @param {Array<{id:string,title:string}>} opts.headers - csv-writer header definitions
 * @param {string} opts.storagePath      - Path in Supabase Storage bucket
 * @param {string} opts.localDir         - Absolute local directory for disk fallback
 * @param {string} opts.fileName         - File name (used for both storage and disk)
 * @param {string} opts.fallbackUrl      - API URL to return when writing to disk
 * @returns {Promise<{fileName: string, downloadUrl: string}>}
 */
async function generateAndStoreCsv({ records, headers, storagePath, localDir, fileName, fallbackUrl }) {
    const stringifier = createObjectCsvStringifier({ header: headers });
    const csvContent = stringifier.getHeaderString() + stringifier.stringifyRecords(records);

    let downloadUrl = null;
    try {
        downloadUrl = await uploadCsvToStorage(csvContent, storagePath);
        if (downloadUrl) console.log(`☁️  CSV subido a Supabase Storage: ${storagePath}`);
    } catch (e) {
        console.warn('⚠️  No se pudo subir CSV a Supabase Storage:', e.message);
    }

    if (!downloadUrl) {
        fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, fileName), csvContent, 'utf-8');
        downloadUrl = fallbackUrl;
        console.log(`💾 CSV guardado localmente: ${path.join(localDir, fileName)}`);
    }

    return { fileName, downloadUrl };
}

module.exports = { generateAndStoreCsv };
