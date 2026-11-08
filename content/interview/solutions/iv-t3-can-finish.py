# Reference solution for iv-t3-can-finish (trusted, server only; never ship to the client).

from collections import deque

def can_finish(n, prereqs):
    needs = [0] * n
    unlocks = [[] for _ in range(n)]
    for a, b in prereqs:
        needs[a] += 1
        unlocks[b].append(a)
    ready = deque(i for i in range(n) if needs[i] == 0)
    done = 0
    while ready:
        c = ready.popleft()
        done += 1
        for nxt in unlocks[c]:
            needs[nxt] -= 1
            if needs[nxt] == 0:
                ready.append(nxt)
    return done == n
