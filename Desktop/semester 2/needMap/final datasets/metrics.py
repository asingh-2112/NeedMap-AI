import re

def normalize(text: str) -> str:
    """Lowercase and collapse whitespace."""
    return re.sub(r"\s+", " ", text.lower().strip())

def character_error_rate(predicted: str, ground_truth: str) -> float:
    """
    CER = edit distance at character level / len(ground_truth)
    Returns 0.0 if ground_truth is empty.
    """
    pred = normalize(predicted)
    gt   = normalize(ground_truth)
    if not gt:
        return 0.0
    return _edit_distance(pred, gt) / len(gt)

def word_error_rate(predicted: str, ground_truth: str) -> float:
    """
    WER = edit distance at word level / number of words in ground_truth
    Returns 0.0 if ground_truth is empty.
    """
    pred_words = normalize(predicted).split()
    gt_words   = normalize(ground_truth).split()
    if not gt_words:
        return 0.0
    return _edit_distance(pred_words, gt_words) / len(gt_words)

def _edit_distance(a, b) -> int:
    """Standard dynamic programming edit distance (works on lists or strings)."""
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[:]
        dp[0] = i
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[j] = prev[j - 1]
            else:
                dp[j] = 1 + min(prev[j], dp[j - 1], prev[j - 1])
    return dp[n]