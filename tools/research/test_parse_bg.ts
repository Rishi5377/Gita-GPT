import fs from 'fs';
import pdfParse from 'pdf-parse';

async function test() {
    const dataBuffer = fs.readFileSync('c:/Users/lenovo/Downloads/Gita-GPT/Assets/Bhagavad-gita-As-It-Is.pdf');
    try {
        const data = await pdfParse(dataBuffer);
        const lines = data.text.split('\n');
        // print lines 100 to 150 to see formatting
        console.log("Total lines:", lines.length);
        console.log(lines.slice(2000, 2050).join('\n'));
    } catch(e) {
        console.error("error", e);
    }
}
test();
