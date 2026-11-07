# Reference solution for t3-meeting-rooms (trusted, server/learning only; never ship to the client).

import heapq

def rooms_needed(sessions):
    ends, best = [], 0
    for start, end in sorted(sessions):
        if ends and ends[0] <= start:
            heapq.heappop(ends)
        heapq.heappush(ends, end)
        best = max(best, len(ends))
    return best
