"""Quick launcher for uvicorn from correct directory"""
import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())
import uvicorn
uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
