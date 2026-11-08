# Reference solution for iv-t1-running-balance (trusted, server only; never ship to the client).

def running_balance(start, changes):
    out, bal = [], start
    for c in changes:
        bal += c
        out.append(bal)
    return out
