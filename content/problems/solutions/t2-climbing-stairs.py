# Reference solution for t2-climbing-stairs (trusted, server/learning only; never ship to the client).

def count_ways(n):
    a, b = 1, 1
    for _ in range(n):
        a, b = b, a + b
    return a
