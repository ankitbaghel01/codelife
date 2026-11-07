# Reference solution for t1-second-largest-distinct (trusted, server/learning only; never ship to the client).

def second_largest(nums):
    best = second = None
    for x in nums:
        if best is None or x > best:
            best, second = x, best
        elif x != best and (second is None or x > second):
            second = x
    return second
