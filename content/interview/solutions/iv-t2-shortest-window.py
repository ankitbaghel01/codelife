# Reference solution for iv-t2-shortest-window (trusted, server only; never ship to the client).

def shortest_window(target, nums):
    best = 0
    total = left = 0
    for right, x in enumerate(nums):
        total += x
        while total >= target:
            size = right - left + 1
            if best == 0 or size < best:
                best = size
            total -= nums[left]
            left += 1
    return best
