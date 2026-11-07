# Reference solution for t2-first-last-position (trusted, server/learning only; never ship to the client).

def find_span(nums, target):
    def lower(strict):
        lo, hi = 0, len(nums)
        while lo < hi:
            mid = (lo + hi) // 2
            if nums[mid] < target or (strict and nums[mid] == target):
                lo = mid + 1
            else:
                hi = mid
        return lo
    left = lower(False)
    if left == len(nums) or nums[left] != target:
        return [-1, -1]
    return [left, lower(True) - 1]
