# Reference solution for t1-tree-max-depth (trusted, server/learning only; never ship to the client).

def max_depth(root):
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))
