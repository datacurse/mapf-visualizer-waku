@echo off
echo Starting FastAPI dev server with hot reload...
python -m uvicorn server.app:create_app --factory --reload --reload-dir server --reload-delay 1.0 --reload-exclude ".*(__pycache__|\.py[cod]|\.pyo|\.pyd|~)$"
pause
