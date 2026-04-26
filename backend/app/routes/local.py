from __future__ import annotations

import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import get_settings
from app.paths import LocalDataPaths, ensure_local_data_layout, sqlite_path_from_url

router = APIRouter()

APP_VERSION = "0.2.0"


class CleanupRequest(BaseModel):
    imports: bool = True
    temp: bool = True
    backups: bool = False


def _paths() -> LocalDataPaths:
    settings = get_settings()
    paths, _ = ensure_local_data_layout(settings.app_data_dir, settings.database_url)
    return paths


def _database_path() -> Path | None:
    settings = get_settings()
    sqlite_path = sqlite_path_from_url(settings.database_url)
    if sqlite_path is None:
        return None
    return sqlite_path.resolve()


def _directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    if path.is_file():
        return path.stat().st_size
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            total += item.stat().st_size
    return total


def _file_summary(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {"path": "", "exists": False, "size": 0}
    return {
        "path": str(path),
        "exists": path.exists(),
        "size": _directory_size(path),
    }


def _add_file(zip_file: zipfile.ZipFile, source: Path, arcname: str) -> None:
    if source.exists() and source.is_file():
        zip_file.write(source, arcname)


def _add_directory(zip_file: zipfile.ZipFile, source: Path, arc_prefix: str) -> None:
    if not source.exists():
        return

    for item in source.rglob("*"):
        if item.is_file():
            zip_file.write(item, f"{arc_prefix}/{item.relative_to(source).as_posix()}")


def _write_export_zip(target: Path) -> dict[str, Any]:
    paths = _paths()
    database_path = _database_path()
    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    manifest = {
        "app": "OfferU",
        "version": APP_VERSION,
        "kind": "offeru-local-data",
        "created_at": created_at,
        "includes": {
            "database": bool(database_path and database_path.exists()),
            "config": paths.config_path.exists(),
            "uploads": paths.uploads_dir.exists(),
        },
    }

    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

        if database_path and database_path.exists():
            _add_file(zip_file, database_path, f"database/{database_path.name}")
            _add_file(zip_file, Path(f"{database_path}-wal"), f"database/{database_path.name}-wal")
            _add_file(zip_file, Path(f"{database_path}-shm"), f"database/{database_path.name}-shm")

        _add_file(zip_file, paths.config_path, "config.json")
        _add_directory(zip_file, paths.uploads_dir, "uploads")

    manifest["archive_path"] = str(target)
    manifest["archive_size"] = target.stat().st_size
    return manifest


def _validate_zip_member(name: str) -> None:
    path = Path(name)
    if path.is_absolute() or ".." in path.parts:
        raise HTTPException(status_code=400, detail="数据包包含不安全的文件路径")

    allowed = name == "manifest.json" or name == "config.json" or name.startswith("uploads/") or name.startswith("database/")
    if not allowed:
        raise HTTPException(status_code=400, detail=f"数据包包含不支持的文件：{name}")


def _copy_tree_contents(source: Path, target: Path) -> int:
    if not source.exists():
        return 0

    copied = 0
    target.mkdir(parents=True, exist_ok=True)
    for item in source.rglob("*"):
        if not item.is_file():
            continue
        destination = target / item.relative_to(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, destination)
        copied += 1
    return copied


def _clear_directory(path: Path) -> dict[str, int]:
    if not path.exists():
        return {"files": 0, "bytes": 0}

    removed_files = 0
    removed_bytes = _directory_size(path)
    for item in path.iterdir():
        if item.is_dir():
            removed_files += sum(1 for child in item.rglob("*") if child.is_file())
            shutil.rmtree(item)
        else:
            removed_files += 1
            item.unlink()

    return {"files": removed_files, "bytes": removed_bytes}


@router.get("/status")
async def local_status():
    settings = get_settings()
    paths = _paths()
    database_path = _database_path()

    return {
        "app": "OfferU",
        "version": APP_VERSION,
        "api_version": 1,
        "data_dir": str(paths.data_dir),
        "database_url": settings.database_url if not settings.database_url.startswith("postgres") else "postgresql://***",
        "database": _file_summary(database_path),
        "config": _file_summary(paths.config_path),
        "uploads": _file_summary(paths.uploads_dir),
        "backups": _file_summary(paths.backups_dir),
        "imports": _file_summary(paths.imports_dir),
        "capabilities": [
            "jobs_ingest",
            "resume_list",
            "resume_export_image",
            "local_export",
            "local_import",
            "local_cleanup",
        ],
    }


@router.get("/export")
async def export_local_data():
    paths = _paths()
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    archive_path = paths.backups_dir / f"offeru-data-{stamp}.zip"
    _write_export_zip(archive_path)
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=archive_path.name,
    )


@router.post("/import")
async def import_local_data(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="请上传 OfferU 导出的 .zip 数据包")

    paths = _paths()
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    saved_path = paths.imports_dir / f"import-{stamp}-{Path(file.filename).name}"

    with saved_path.open("wb") as target:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            target.write(chunk)

    try:
        with zipfile.ZipFile(saved_path) as zip_file:
            for member in zip_file.namelist():
                _validate_zip_member(member)

            manifest = json.loads(zip_file.read("manifest.json").decode("utf-8")) if "manifest.json" in zip_file.namelist() else {}
            if manifest and manifest.get("kind") != "offeru-local-data":
                raise HTTPException(status_code=400, detail="这不是 OfferU 本地数据包")

            backup_path = paths.backups_dir / f"before-import-{stamp}.zip"
            _write_export_zip(backup_path)

            extract_dir = paths.temp_dir / f"import-{stamp}"
            if extract_dir.exists():
                shutil.rmtree(extract_dir)
            zip_file.extractall(extract_dir)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="数据包无法解压，请确认文件没有损坏") from exc

    imported: list[str] = []
    config_source = extract_dir / "config.json"
    if config_source.exists():
        shutil.copy2(config_source, paths.config_path)
        imported.append("config")

    uploads_source = extract_dir / "uploads"
    copied_uploads = _copy_tree_contents(uploads_source, paths.uploads_dir)
    if copied_uploads:
        imported.append("uploads")

    database_path = _database_path()
    database_source_dir = extract_dir / "database"
    if database_path is not None and database_source_dir.exists():
        database_candidates = [item for item in database_source_dir.iterdir() if item.is_file() and item.suffix == ".db"]
        if database_candidates:
            from app.database import engine

            await engine.dispose()
            database_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(database_candidates[0], database_path)
            imported.append("database")

    shutil.rmtree(extract_dir, ignore_errors=True)

    return {
        "message": "数据包已导入",
        "imported": imported,
        "saved_import": str(saved_path),
        "backup_path": str(backup_path),
        "restart_recommended": "database" in imported or "config" in imported,
    }


@router.post("/cleanup")
async def cleanup_local_data(request: CleanupRequest):
    paths = _paths()
    result = {"files": 0, "bytes": 0, "scopes": []}

    for enabled, scope, path in (
        (request.imports, "imports", paths.imports_dir),
        (request.temp, "temp", paths.temp_dir),
        (request.backups, "backups", paths.backups_dir),
    ):
        if not enabled:
            continue
        removed = _clear_directory(path)
        result["files"] += removed["files"]
        result["bytes"] += removed["bytes"]
        result["scopes"].append(scope)

    return {
        "message": "清理完成",
        **result,
    }
