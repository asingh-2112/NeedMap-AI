from jiwer import wer, cer

def compute_metrics(gt, pred):
    return {
        "wer": wer(gt, pred),
        "cer": cer(gt, pred)
    }