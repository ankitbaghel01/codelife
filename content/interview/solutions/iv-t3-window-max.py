# Reference solution for iv-t3-window-max (trusted, server only; never ship to the client).

from collections import deque

def window_max(nums, k):
    q, out = deque(), []
    for i, x in enumerate(nums):
        while q and nums[q[-1]] <= x:
            q.pop()
        q.append(i)
        if q[0] <= i - k:
            q.popleft()
        if i >= k - 1:
            out.append(nums[q[0]])
    return out
