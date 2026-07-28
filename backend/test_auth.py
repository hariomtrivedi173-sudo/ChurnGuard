from auth import hash_password, verify_password, create_access_token, decode_access_token

hashed = hash_password("mypassword123")
print("Hashed password:", hashed)

print("Correct password check:", verify_password("mypassword123", hashed))
print("Wrong password check:", verify_password("wrongpassword", hashed))

token = create_access_token({"sub": "hariom@example.com"})
print("Token:", token)

decoded = decode_access_token(token)
print("Decoded token:", decoded)