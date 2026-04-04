from doctr.io import DocumentFile
from doctr.models import ocr_predictor

model = ocr_predictor(pretrained=True)

def run_doctr(image_path):
    doc = DocumentFile.from_images(image_path)
    result = model(doc)
    return result.render()