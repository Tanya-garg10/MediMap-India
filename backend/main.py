"""
MediMap-India Backend — FastAPI server with CORS, query endpoint, map data, and stats.
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from query_engine import search_hospitals, get_all_hospitals_for_map, get_stats

app = FastAPI(title="MediMap-India", description="AI-powered hospital trust scoring API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    print("Initializing database...")
    init_db()
    print("Server ready.")


@app.get("/query")
def query_hospitals(q: str = Query(..., description="Natural language query")):
    """Search hospitals using natural language query."""
    results = search_hospitals(q)
    return results


@app.get("/hospitals/map")
def hospitals_map():
    """Get all hospitals with coordinates for map display."""
    return get_all_hospitals_for_map()


@app.get("/stats")
def statistics():
    """Get aggregate statistics."""
    return get_stats()


@app.get("/")
def root():
    return {
        "service": "MediMap-India",
        "status": "running",
        "endpoints": {
            "/query?q=...": "Natural language hospital search",
            "/hospitals/map": "All hospitals for map",
            "/stats": "Aggregate statistics",
            "/docs": "Swagger API docs",
            "/health": "Health check",
        }
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "MediMap-India"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
