import os
try:
    import fitz
except ImportError:
    os.system("pip install PyMuPDF")
    import fitz

pdf_dir = r"c:\Users\lenovo\Downloads\Gita-GPT\Docs"
output_dir = r"c:\Users\lenovo\Downloads\Gita-GPT\Docs\text"
os.makedirs(output_dir, exist_ok=True)
files = ["PRD.pdf", "Tech Stack.pdf", "plan-1.pdf", "update-plan.pdf"]

for file in files:
    print(f"Reading {file} with PyMuPDF...")
    try:
        doc = fitz.open(os.path.join(pdf_dir, file))
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        with open(os.path.join(output_dir, file + ".fitz.txt"), "w", encoding="utf-8") as out:
            out.write(text)
    except Exception as e:
        print(f"Error {file}: {e}")
print("Done.")
