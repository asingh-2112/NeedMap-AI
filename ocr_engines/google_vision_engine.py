from google.cloud import vision

client = vision.ImageAnnotatorClient()

def run_google(image_path):
    with open(image_path, "rb") as f:
        content = f.read()
    image = vision.Image(content=content)
    response = client.text_detection(image=image)
    return response.text_annotations[0].description if response.text_annotations else ""