# Reference solution for t2-is-bst (trusted, server/learning only; never ship to the client).

def is_bst(root):
    def ok(node, low, high):
        if node is None:
            return True
        return low < node.val < high and ok(node.left, low, node.val) and ok(node.right, node.val, high)
    return ok(root, float("-inf"), float("inf"))
