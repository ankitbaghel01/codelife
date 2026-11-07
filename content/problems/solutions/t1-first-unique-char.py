# Reference solution for t1-first-unique-char (trusted, server/learning only; never ship to the client).

def first_unique_index(text):
    counts = {}
    for c in text:
        counts[c] = counts.get(c, 0) + 1
    for i, c in enumerate(text):
        if counts[c] == 1:
            return i
    return -1
