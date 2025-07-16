# backend/app.py (Временная версия для диагностики)

from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Minimal App is working!"}
