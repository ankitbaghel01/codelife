# Reference solution for t1-missing-number (trusted, server/learning only; never ship to the client).

def find_missing(nums, n):
    return n * (n + 1) // 2 - sum(nums)
