# Reference solution for t1-merge-into-first (trusted, server/learning only; never ship to the client).

def merge_into(a, m, b, n):
    i, j = m - 1, n - 1
    for k in range(m + n - 1, -1, -1):
        if j < 0 or (i >= 0 and a[i] > b[j]):
            a[k] = a[i]
            i -= 1
        else:
            a[k] = b[j]
            j -= 1
    return a
