const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const BG_PDF_PATH = path.join(__dirname, '..', 'Assets', 'Bhagavad-gita-As-It-Is.pdf');

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

    const startPos = text.indexOf('CHAPTER TWO');
    const endPos = text.indexOf('CHAPTER THREE');
    const chapter2Text = text.substring(startPos, endPos);
    console.log('Chapter 2 Fragment Length:', chapter2Text.length);

    // Look for ANY instance of TEXT followed by a number
    // We'll use a very loose regex to see all matches
    const markerRegex = /TEXTS?\s+([\d\s\–\-]+)/gi;
    const matches = [...chapter2Text.matchAll(markerRegex)];

    const foundVerses = new Set();
    console.log('--- FOUND MARKERS ---');
    matches.forEach(m => {
        const val = m[1].trim();
        console.log(`Marker: "${val}"`);
        
        // Handle newline or space separated numbers (e.g. "33\n35")
        const normalized = val.replace(/\s+/g, '-');
        const parts = normalized.split(/[\–\-]/);
        
        if (parts.length > 1) {
            const low = parseInt(parts[0]);
            const high = parseInt(parts[parts.length - 1]);
            if (!isNaN(low) && !isNaN(high)) {
                for (let i = low; i <= high; i++) foundVerses.add(i);
            }
        } else {
            const num = parseInt(parts[0]);
            if (!isNaN(num)) foundVerses.add(num);
        }
    });

    console.log('\n--- MISSING VERSES (1-72) ---');
    const missing = [];
    for (let i = 1; i <= 72; i++) {
        if (!foundVerses.has(i)) missing.push(i);
    }
    console.log(missing.join(', '));
    
    // Check for "T E X T" or other variants
    const variants = [...chapter2Text.matchAll(/T\s*E\s*X\s*T\s*S?\s+([\d]+)/gi)];
    if (variants.length > matches.length) {
        console.log('Found variants! Total:', variants.length);
    }
}

research().catch(console.error);
