# Reference solution for iv-t1-sticky-backspace (trusted, server only; never ship to the client).

def final_text(typed):
    stack = []
    for ch in typed:
        if ch == "#":
            if stack:
                stack.pop()
        else:
            stack.append(ch)
    return "".join(stack)
