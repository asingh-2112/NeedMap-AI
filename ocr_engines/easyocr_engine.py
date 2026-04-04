import easyocr

# Separate readers (IMPORTANT)
reader_en = easyocr.Reader(['en'])
reader_hi = easyocr.Reader(['hi', 'en'])
reader_te = easyocr.Reader(['te', 'en'])

def run_easyocr(image_path, dataset_name=""):
    dataset_name = dataset_name.lower()

    if "hindi" in dataset_name:
        reader = reader_hi
    elif "telugu" in dataset_name:
        reader = reader_te
    else:
        reader = reader_en

    result = reader.readtext(image_path, detail=0)
    return " ".join(result)