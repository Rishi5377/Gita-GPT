import os
import pdfplumber

pdf_dir = r"c:\Users\lenovo\Downloads\Gita-GPT\Assets"
output_dir = r"c:\Users\lenovo\Downloads\Gita-GPT\Docs\text_gita_plumber"
os.makedirs(output_dir, exist_ok=True)

files = ["G279 IND.pdf"]

for file in files:
    print(f"Reading {file} with pdfplumber...")
    try:
        with pdfplumber.open(os.path.join(pdf_dir, file)) as pdf:
            text = ""
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            with open(os.path.join(output_dir, file + ".txt"), "w", encoding="utf-8") as out:
                out.write(text)
        print(f"Read {file}")
    except Exception as e:
        print(f"Error {file}: {e}")
print("Done.")
