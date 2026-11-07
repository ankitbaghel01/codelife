# Reference solution for t2-group-anagrams (trusted, server/learning only; never ship to the client).

from collections import defaultdict

def group_anagrams(words):
    groups = defaultdict(list)
    for w in words:
        groups["".join(sorted(w))].append(w)
    return [sorted(g) for g in groups.values()]
