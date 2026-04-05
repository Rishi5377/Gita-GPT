import os
import pypdf

pdf_dir = r"c:\Users\lenovo\Downloads\Gita-GPT\Assets"
output_dir = r"c:\Users\lenovo\Downloads\Gita-GPT\Docs\text_gita"
os.makedirs(output_dir, exist_ok=True)

files_to_read = [
    "G279 IND.pdf",
    "Bhagavad-gita-As-It-Is.pdf"
]

for file in files_to_read:
    print(f"Reading {file}...")
    try:
        with open(os.path.join(pdf_dir, file), "rb") as f:
            reader = pypdf.PdfReader(f)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            
            with open(os.path.join(output_dir, file + ".txt"), "w", encoding="utf-8") as out:
                out.write(text)
        print(f"Finished {file}")
    except Exception as e:
        print(f"Failed to read {file}: {e}")
print("Done.")
