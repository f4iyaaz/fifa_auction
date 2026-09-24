from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "FIFA auction backend is running"}