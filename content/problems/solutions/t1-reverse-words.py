# Reference solution for t1-reverse-words (trusted, server/learning only; never ship to the client).

def reverse_words(sentence):
    return " ".join(reversed(sentence.split()))
