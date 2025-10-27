fname = "full_dump.sql"
with open(fname, "rb") as f:
    b = f.read()
try:
    b.decode("utf-8")
    print("file is valid UTF-8")
except Exception as e:
    print("NOT valid UTF-8:", e)
