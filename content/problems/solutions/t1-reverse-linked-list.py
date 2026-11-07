# Reference solution for t1-reverse-linked-list (trusted, server/learning only; never ship to the client).

def reverse_list(head):
    prev = None
    while head:
        head.next, prev, head = prev, head, head.next
    return prev
