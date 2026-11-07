# Reference solution for t1-middle-node (trusted, server/learning only; never ship to the client).

def middle_node(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
    return slow
