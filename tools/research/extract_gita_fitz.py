import os
import fitz  # PyMuPDF

pdf_dir = r"c:\Users\lenovo\Downloads\Gita-GPT\Assets"
output_dir = r"c:\Users\lenovo\Downloads\Gita-GPT\Docs\text_gita_fitz"
os.makedirs(output_dir, exist_ok=True)

files = ["G279 IND.pdf"]

for file in files:
    print(f"Reading {file} with PyMuPDF...")
    try:
        doc = fitz.open(os.path.join(pdf_dir, file))
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        with open(os.path.join(output_dir, file + ".txt"), "w", encoding="utf-8") as out:
            out.write(text)
        print(f"Read {file}. Total length: {len(text)}")
    except Exception as e:
        print(f"Error {file}: {e}")
print("Done.")
