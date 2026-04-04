from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en')

def run_paddle(image_path):
    result = ocr.ocr(image_path)
    text = []
    for line in result:
        for word in line:
            text.append(word[1][0])
    return " ".join(text)