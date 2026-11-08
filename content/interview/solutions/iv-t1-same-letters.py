# Reference solution for iv-t1-same-letters (trusted, server only; never ship to the client).

def same_letters(a, b):
    counts = {}
    for ch in a.lower():
        if ch != " ":
            counts[ch] = counts.get(ch, 0) + 1
    for ch in b.lower():
        if ch != " ":
            counts[ch] = counts.get(ch, 0) - 1
    return all(v == 0 for v in counts.values())
