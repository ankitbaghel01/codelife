# Reference solution for t2-max-sum-window (trusted, server/learning only; never ship to the client).

def best_window_sum(sales, k):
    cur = best = sum(sales[:k])
    for i in range(k, len(sales)):
        cur += sales[i] - sales[i - k]
        best = max(best, cur)
    return best
