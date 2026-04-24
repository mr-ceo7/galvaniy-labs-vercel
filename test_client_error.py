import google.genai.errors
try:
    raise google.genai.errors.ClientError(500, None, None)
except Exception as e:
    print(repr(str(e)))
