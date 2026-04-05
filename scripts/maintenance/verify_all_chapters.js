const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const ASSETS_DIR = path.join(__dirname, '..', 'Assets');
const BG_PDF_PATH = path.join(ASSETS_DIR, 'Bhagavad-gita-As-It-Is.pdf');
const VERSE_COUNTS = {
    '1': 47, '2': 72, '3': 43, '4': 42, '5': 29, '6': 47, '7': 30, '8': 28,
    '9': 34, '10': 42, '11': 55, '12': 20, '13': 35, '14': 27, '15': 20, '16': 24, '17': 28, '18': 78
};

async function extractPdfText(pdfPath) {
    if (!fs.existsSync(pdfPath)) return '';
    const dataBuffer = fs.readFileSync(pdfPath);
    try {
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (e) {
        return '';
    }
}

const chapterMap = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6',
    'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11', 'twelve': '12',
    'thirteen': '13', 'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18'
};

function extractVerses(text) {
    const tocMatches = [...text.matchAll(/CONTENTS|CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|\d+)/gi)];
    const tocEndIdx = tocMatches.length > 50 ? tocMatches[50].index : 5000;

    const markers = [...text.matchAll(/(?:\nCHAPTER\s+)\b(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|\d+)\b|(?:\nTEXTS?)\s+([\d\–\-]+)/g)];
    
    const rawResults = [];
    let currentChapter = '0';

    for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        if (m.index < (tocEndIdx || 0)) continue;

        if (m[1]) {
            const chName = m[1].toLowerCase();
            currentChapter = chapterMap[chName] || chName;
            continue;
        }

        if (m[2] && currentChapter !== '0') {
            const start = m.index + m[0].length;
            const nextMarker = markers[i + 1];
            const end = nextMarker ? nextMarker.index : text.length;
            const content = text.substring(start, end).trim();
            
            const verseLabel = m[2].trim().replace(/\s+/g, '');
            if (!verseLabel) continue;

            const parts = verseLabel.split(/[\–\-]/);
            if (parts.length > 1) {
                const low = parseInt(parts[0]);
                const high = parseInt(parts[parts.length - 1]);
                if (!isNaN(low) && !isNaN(high)) {
                    for (let v = low; v <= high; v++) {
                        rawResults.push({ chapter: currentChapter, verse: v.toString(), content });
                    }
                }
            } else {
                rawResults.push({ chapter: currentChapter, verse: parts[0], content });
            }
        }
    }

    const uniqueMap = new Map();
    for (const res of rawResults) {
        const key = `${res.chapter}:${res.verse}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, res);
        }
    }

    return Array.from(uniqueMap.values());
}

async function run() {
    console.log('Reading PDF...');
    const bgText = await extractPdfText(BG_PDF_PATH);
    console.log('Extracting verses with current logic...');
    const allVerses = extractVerses(bgText);
    
    console.log('\n--- VERIFICATION REPORT ---');
    let allMatched = true;
    for (let i = 1; i <= 18; i++) {
        const ch = i.toString();
        const expected = VERSE_COUNTS[ch];
        const found = allVerses.filter(v => v.chapter === ch);
        const match = found.length === expected;
        if (!match) allMatched = false;
        
        console.log(`Chapter ${ch.padStart(2, ' ')}: Expected ${expected.toString().padStart(2, ' ')} | Found ${found.length.toString().padStart(3, ' ')} -> ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
    }
    
    if (allMatched) {
        console.log('\nSUCCESS: All chapters perfectly match expected verse counts!');
    } else {
        console.log('\nWARNING: Some chapters have discrepancies. Check regex logic.');
    }
}

run().catch(console.error);
