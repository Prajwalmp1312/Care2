import pandas as pd
import pytesseract
from PIL import Image
from PyPDF2 import PdfReader
from docx import Document
import os

def extract_text_from_path(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        reader = PdfReader(file_path)
        return "".join(page.extract_text() or "" for page in reader.pages)

    elif ext in [".xls", ".xlsx"]:
        df = pd.read_excel(file_path)
        return df.to_string(index=False)

    elif ext in [".jpg", ".jpeg", ".png"]:
        image = Image.open(file_path)
        return pytesseract.image_to_string(image)

    elif ext == ".docx":
        doc = Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs)

    elif ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    return ""
