# Reference solution for t1-clean-palindrome (trusted, server/learning only; never ship to the client).

def is_clean_palindrome(text):
    letters = [c.lower() for c in text if c.isascii() and c.isalpha()]
    return letters == letters[::-1]
