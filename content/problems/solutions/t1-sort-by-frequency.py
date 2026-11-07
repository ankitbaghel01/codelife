# Reference solution for t1-sort-by-frequency (trusted, server/learning only; never ship to the client).

from collections import Counter

def sort_by_frequency(nums):
    count = Counter(nums)
    return sorted(nums, key=lambda x: (-count[x], x))
