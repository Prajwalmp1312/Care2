from document_text_extractor import extract_text_from_path

def generate_document_summary(file_path: str) -> str:
    text = extract_text_from_path(file_path)

    if not text or len(text.strip()) < 50:
        return "No sufficient readable text found to generate AI summary."

    # SAFE TEMP summary (no heavy model)
    return text[:300] + "..."
