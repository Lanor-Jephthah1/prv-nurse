import pypdf

def extract_pages(pdf_path, pages):
    reader = pypdf.PdfReader(pdf_path)
    for p in pages:
        if p <= len(reader.pages):
            print(f"--- PAGE {p} ---")
            print(reader.pages[p-1].extract_text())
            print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    pdf_file = r"C:\Users\McLanor Jeff\.gemini\antigravity\brain\d557e624-241c-4ea7-b2e1-cf8dbc4d2842\media__1781655506727.pdf"
    extract_pages(pdf_file, [30, 31, 32])
