# Reference solution for t2-k-largest (trusted, server/learning only; never ship to the client).

import heapq

def k_largest(scores, k):
    heap = []
    for s in scores:
        heapq.heappush(heap, s)
        if len(heap) > k:
            heapq.heappop(heap)
    return sorted(heap, reverse=True)
