# Reference solution for iv-t2-path-sum (trusted, server only; never ship to the client).

def has_path_sum(root, target):
    if root is None:
        return False
    remaining = target - root.val
    if root.left is None and root.right is None:
        return remaining == 0
    return has_path_sum(root.left, remaining) or has_path_sum(root.right, remaining)
