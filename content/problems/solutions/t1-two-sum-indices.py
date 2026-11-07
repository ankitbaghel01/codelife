# Reference solution for t1-two-sum-indices (trusted, server/learning only; never ship to the client).

def pair_for_budget(prices, budget):
    seen = {}
    for i, p in enumerate(prices):
        if budget - p in seen:
            return [seen[budget - p], i]
        seen[p] = i
