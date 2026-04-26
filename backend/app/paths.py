from __future__ import annotations

import os
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path


APP_NAME = "OfferU"
DEFAULT_DB_NAME = "offeru.db"


@dataclass(frozen=True)
class LocalDataPaths:
    data_dir: Path
    database_path: Path | None
    config_path: Path
    uploads_dir: Path
    backups_dir: Path
    imports_dir: Path
    temp_dir: Path


def legacy_backend_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def default_data_dir() -> Path:
    if os.name == "nt":
        root = os.environ.get("APPDATA")
        if root:
            return Path(root) / APP_NAME / "data"
        return Path.home() / "AppData" / "Roaming" / APP_NAME / "data"

    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME / "data"

    root = os.environ.get("XDG_DATA_HOME")
    if root:
        return Path(root) / APP_NAME
    return Path.home() / ".local" / "share" / APP_NAME


def resolve_data_dir(value: str | None = None) -> Path:
    configured = value or os.environ.get("OFFERU_DATA_DIR") or os.environ.get("APP_DATA_DIR")
    data_dir = Path(configured).expanduser() if configured else default_data_dir()
    return data_dir.resolve()


def sqlite_url_for_path(path: Path) -> str:
    return f"sqlite+aiosqlite:///{path.resolve().as_posix()}"


def sqlite_path_from_url(database_url: str) -> Path | None:
    prefixes = ("sqlite+aiosqlite:///", "sqlite:///")
    for prefix in prefixes:
        if not database_url.startswith(prefix):
            continue

        raw_path = database_url[len(prefix):]
        if raw_path in {"", ":memory:"}:
            return None
        return Path(raw_path)

    return None


def _is_absolute_sqlite_path(path: Path) -> bool:
    raw = path.as_posix()
    return path.is_absolute() or (len(raw) > 1 and raw[1] == ":")


def resolve_database_url(database_url: str, data_dir: Path) -> tuple[str, Path | None]:
    if not database_url.strip():
        database_path = data_dir / DEFAULT_DB_NAME
        return sqlite_url_for_path(database_path), database_path

    sqlite_path = sqlite_path_from_url(database_url)
    if sqlite_path is None:
        return database_url, None

    if _is_absolute_sqlite_path(sqlite_path):
        database_path = sqlite_path
    else:
        database_path = data_dir / sqlite_path.name

    return sqlite_url_for_path(database_path), database_path


def ensure_local_data_layout(
    app_data_dir: str | None = None,
    database_url: str = "",
) -> tuple[LocalDataPaths, str]:
    data_dir = resolve_data_dir(app_data_dir)
    resolved_database_url, database_path = resolve_database_url(database_url, data_dir)

    paths = LocalDataPaths(
        data_dir=data_dir,
        database_path=database_path,
        config_path=data_dir / "config.json",
        uploads_dir=data_dir / "uploads",
        backups_dir=data_dir / "backups",
        imports_dir=data_dir / "imports",
        temp_dir=data_dir / "temp",
    )

    for directory in (
        paths.data_dir,
        paths.uploads_dir,
        paths.backups_dir,
        paths.imports_dir,
        paths.temp_dir,
    ):
        directory.mkdir(parents=True, exist_ok=True)

    _bootstrap_legacy_files(paths)
    return paths, resolved_database_url


def get_local_data_paths(app_data_dir: str | None = None, database_url: str = "") -> LocalDataPaths:
    paths, _ = ensure_local_data_layout(app_data_dir, database_url)
    return paths


def _same_path(left: Path, right: Path) -> bool:
    try:
        return left.resolve() == right.resolve()
    except OSError:
        return False


def _copy_file_if_missing(source: Path, target: Path) -> None:
    if not source.exists() or target.exists() or _same_path(source, target):
        return

    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def _copy_tree_contents_if_missing(source: Path, target: Path) -> None:
    if not source.exists() or _same_path(source, target):
        return

    target.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        destination = target / item.name
        if destination.exists():
            continue
        if item.is_dir():
            shutil.copytree(item, destination)
        else:
            shutil.copy2(item, destination)


def _bootstrap_legacy_files(paths: LocalDataPaths) -> None:
    backend_dir = legacy_backend_dir()

    if paths.database_path is not None and not paths.database_path.exists():
        for candidate in (backend_dir / "offeru.db", backend_dir / "djm.db"):
            if candidate.exists():
                _copy_file_if_missing(candidate, paths.database_path)
                break

    _copy_file_if_missing(backend_dir / "config.json", paths.config_path)
    _copy_tree_contents_if_missing(backend_dir / "uploads", paths.uploads_dir)
