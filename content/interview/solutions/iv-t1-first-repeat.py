# Reference solution for iv-t1-first-repeat (trusted, server only; never ship to the client).

def first_repeat(ids):
    seen = set()
    for x in ids:
        if x in seen:
            return x
        seen.add(x)
    return -1
