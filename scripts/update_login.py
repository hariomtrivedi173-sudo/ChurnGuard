with open("frontend/src/pages/Login.jsx", "r", encoding="utf-8") as f:
    text = f.read()

target = "console.error('[ForgotPassword] API error:', raw)"
replacement = "// API error handled cleanly by inline alert banner without leaking details"

if target in text:
    text = text.replace(target, replacement, 1)
    with open("frontend/src/pages/Login.jsx", "w", encoding="utf-8") as f:
        f.write(text)
    print("Login.jsx updated successfully")
else:
    print("Target not found in Login.jsx")

