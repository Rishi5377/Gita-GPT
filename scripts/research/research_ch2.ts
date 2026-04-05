import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - pdf-parse lacks official type declarations; used only in research scripts
import pdfParse from 'pdf-parse';

const ASSETS_DIR = path.join(__dirname, '..', 'Assets');
const BG_PDF_PATH = path.join(ASSETS_DIR, 'Bhagavad-gita-As-It-Is.pdf');

async function research() {
    console.log('Reading PDF...');
    const buffer = fs.readFileSync(BG_PDF_PATH);
    const data = await pdfParse(buffer);
    const text = data.text;

    const startIdx = text.indexOf('CHAPTER TWO');
    const endIdx = text.indexOf('CHAPTER THREE');
    
    if (startIdx === -1 || endIdx === -1) {
        console.error('Could not find Chapter 2 or 3 markers');
        return;
    }

    const chapter2Text = text.substring(startIdx, endIdx);
    console.log('Chapter 2 Fragment Length:', chapter2Text.length);

    // More flexible marker search
    // Handles: TEXT 13, TEXTS 33-35, TEXT 13 (with spaces/newlines)
    const markerRegex = /TEXTS?\s+([\d\s\–\-]+)/gi;
    const matches = [...chapter2Text.matchAll(markerRegex)];

    const foundVerses = new Set<number>();
    console.log('--- FOUND MARKERS ---');
    matches.forEach(m => {
        const val = m[1].trim();
        console.log(`Marker: "${val}"`);
        
        // Parse range or single
        const parts = val.split(/[\–\-]/);
        if (parts.length > 1) {
            const low = parseInt(parts[0].trim());
            const high = parseInt(parts[1].trim());
            for (let i = low; i <= high; i++) foundVerses.add(i);
        } else {
            foundVerses.add(parseInt(parts[0].trim()));
        }
    });

    console.log('\n--- MISSING VERSES (1-72) ---');
    const missing = [];
    for (let i = 1; i <= 72; i++) {
        if (!foundVerses.has(i)) missing.push(i);
    }
    console.log(missing.join(', '));
}

research().catch(console.error);
