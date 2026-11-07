# Reference solution for t2-power-set (trusted, server/learning only; never ship to the client).

def all_subsets(items):
    items = sorted(items)
    out = []

    def go(i, cur):
        if i == len(items):
            out.append(list(cur))
            return
        go(i + 1, cur)
        cur.append(items[i])
        go(i + 1, cur)
        cur.pop()

    go(0, [])
    return out
