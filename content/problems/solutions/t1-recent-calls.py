# Reference solution for t1-recent-calls (trusted, server/learning only; never ship to the client).

from collections import deque

def count_recent(times):
    window, out = deque(), []
    for t in times:
        window.append(t)
        while window[0] < t - 3000:
            window.popleft()
        out.append(len(window))
    return out
