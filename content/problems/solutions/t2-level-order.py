# Reference solution for t2-level-order (trusted, server/learning only; never ship to the client).

def level_order(root):
    out, level = [], [root] if root else []
    while level:
        out.append([n.val for n in level])
        level = [c for n in level for c in (n.left, n.right) if c]
    return out
