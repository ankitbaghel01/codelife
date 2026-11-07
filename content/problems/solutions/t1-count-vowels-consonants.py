# Reference solution for t1-count-vowels-consonants (trusted, server/learning only; never ship to the client).

def count_letters(text):
    v = c = 0
    for ch in text.lower():
        if 'a' <= ch <= 'z':
            if ch in 'aeiou':
                v += 1
            else:
                c += 1
    return [v, c]
