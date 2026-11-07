# Reference solution for t1-most-frequent-char (trusted, server/learning only; never ship to the client).

def most_frequent_char(text):
    counts = {}
    for c in text:
        if c != ' ':
            counts[c] = counts.get(c, 0) + 1
    best = max(counts.values())
    return next(c for c in text if c != ' ' and counts[c] == best)
