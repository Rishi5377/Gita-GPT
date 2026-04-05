
const fs = require('fs');
const pdf = require('pdf-parse');

const chapterMap = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6',
    'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11', 'twelve': '12',
    'thirteen': '13', 'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18'
};

async function analyze() {
    const dataBuffer = fs.readFileSync('Assets/Bhagavad-gita-As-It-Is.pdf');
    const data = await pdf(dataBuffer);
    const text = data.text;

    const tocMatches = [...text.matchAll(/CONTENTS|CHAPTER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|\d+)/gi)];
    const tocEndIdx = tocMatches.length > 50 ? tocMatches[50].index : 5000;

    const markers = [...text.matchAll(/(?:\nCHAPTER\s+)(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|\d+)|(TEXTS?)\s+([\d\–\-]+)/g)];
    
    let currentChapter = '0';
    const foundVerses = [];

    for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        if (m.index < tocEndIdx) continue;

        if (m[1]) {
            const chName = m[1].toLowerCase();
            currentChapter = chapterMap[chName] || chName;
            continue;
        }

        if (currentChapter === '4' && m[2]) {
             const vLabel = m[3].trim().replace(/\s+/g, '');
             const snippet = text.substring(m.index - 30, m.index + 50).replace(/\n/g, ' ');
             foundVerses.push({ label: vLabel, snippet, index: m.index });
        }
    }

    console.log(`--- Chapter 4 Analysis ---`);
    console.log(`Total Markers Found: ${foundVerses.length}`);
    foundVerses.forEach((v, idx) => {
        console.log(`${idx + 1}. [${v.label}] "...${v.snippet}..."`);
    });
}

analyze();
