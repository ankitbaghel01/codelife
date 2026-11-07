# Reference solution for t2-queue-two-stacks (trusted, server/learning only; never ship to the client).

def process_queue(ops):
    inbox, outbox, out = [], [], []
    for op in ops:
        if op[0] == "push":
            inbox.append(op[1])
            continue
        if op[0] == "empty":
            out.append(not inbox and not outbox)
            continue
        if not outbox:
            while inbox:
                outbox.append(inbox.pop())
        out.append(outbox.pop() if op[0] == "pop" else outbox[-1])
    return out
