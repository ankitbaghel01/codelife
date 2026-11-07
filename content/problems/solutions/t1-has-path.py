# Reference solution for t1-has-path (trusted, server/learning only; never ship to the client).

def has_path(n, edges, source, target):
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
    seen, stack = {source}, [source]
    while stack:
        node = stack.pop()
        if node == target:
            return True
        for nxt in adj[node]:
            if nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    return False
