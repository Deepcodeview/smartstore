import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,        # set True only during dev (breaks threading on some OSes)
        workers=1,           # keep 1 worker — models are lazy-loaded into process memory
    )