# Reference solution for t1-dedupe-keep-order (trusted, server/learning only; never ship to the client).

def dedupe(items):
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out
