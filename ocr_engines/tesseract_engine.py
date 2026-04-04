import pytesseract
from PIL import Image

# IMPORTANT for Windows (set path if needed)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def run_tesseract(image_path, lang='eng'):
    return pytesseract.image_to_string(Image.open(image_path), lang=lang)