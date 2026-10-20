"""Sort Dataset web app: a small Python standard-library server powered by Pandas."""
from __future__ import annotations

import argparse
import io
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
MAX_REQUEST_BYTES = 4 * 1024 * 1024
PREVIEW_LIMIT = 100

DATASETS = {
    "employees": {
        "label": "Employee dataset",
        "description": "Sort teams, job titles, and salaries.",
        "file": "employees.csv",
    },
    "students": {
        "label": "Student performance",
        "description": "Compare classes, subjects, averages, and grades.",
        "file": "student_performance.csv",
    },
    "products": {
        "label": "Product inventory",
        "description": "Organize product categories, stock, and prices.",
        "file": "product_inventory.csv",
    },
}


def dataframe_from_csv_text(csv_text: str) -> pd.DataFrame:
    """Read CSV text into a DataFrame and validate that it contains usable data."""
    if not isinstance(csv_text, str) or not csv_text.strip():
        raise ValueError("The CSV file is empty. Choose a CSV file with a header row and data.")
    try:
        frame = pd.read_csv(io.StringIO(csv_text))
    except Exception as exc:
        raise ValueError(f"Could not read this CSV file: {exc}") from exc
    if len(frame.columns) == 0:
        raise ValueError("The CSV file needs a header row with column names.")
    if frame.empty:
        raise ValueError("The CSV has column names but no data rows.")
    # Sorting and JSON output are most predictable when column names are strings.
    frame.columns = [str(column) for column in frame.columns]
    return frame


def load_sample_dataframe(name: str) -> pd.DataFrame:
    """Load one of the bundled sample datasets; never accepts arbitrary paths."""
    if name not in DATASETS:
        raise ValueError("Unknown sample dataset. Please choose one of the provided datasets.")
    file_path = DATA_DIR / DATASETS[name]["file"]
    try:
        frame = pd.read_csv(file_path)
    except Exception as exc:
        raise ValueError(f"Could not load the sample dataset: {exc}") from exc
    frame.columns = [str(column) for column in frame.columns]
    return frame


def dataframe_preview(frame: pd.DataFrame, limit: int = PREVIEW_LIMIT) -> dict:
    """Build JSON-safe information for the preview table."""
    preview = frame.head(limit)
    # Pandas' JSON writer converts NaN/NaT to JSON null and NumPy values to scalars.
    rows = json.loads(preview.to_json(orient="records", date_format="iso", force_ascii=False))
    numeric_columns = [str(column) for column in frame.select_dtypes(include="number").columns]
    return {
        "columns": [str(column) for column in frame.columns],
        "rows": rows,
        "total_rows": int(len(frame)),
        "numeric_columns": numeric_columns,
        "preview_limit": limit,
    }


def sort_dataframe(frame: pd.DataFrame, rules: list[dict]) -> tuple[pd.DataFrame, list[str], list[bool]]:
    """Apply ordered sort rules and return the sorted data plus normalized rule details."""
    if not isinstance(rules, list) or not rules:
        raise ValueError("Add at least one sort rule before sorting.")

    columns: list[str] = []
    ascending: list[bool] = []
    for item in rules:
        if not isinstance(item, dict):
            raise ValueError("Each sort rule must have a column and a direction.")
        column = item.get("column")
        direction = item.get("direction", "asc")
        if column not in frame.columns:
            raise ValueError(f"Column '{column}' was not found in this dataset.")
        if column in columns:
            raise ValueError(f"Column '{column}' is used more than once. Choose different columns for each rule.")
        if direction not in ("asc", "desc"):
            raise ValueError("Sort direction must be ascending or descending.")
        columns.append(column)
        ascending.append(direction == "asc")

    # Stable sorting keeps the row order consistent when values are tied.
    sorted_frame = frame.sort_values(
        by=columns,
        ascending=ascending,
        na_position="last",
        kind="stable",
        ignore_index=True,
    )
    return sorted_frame, columns, ascending


class SortDatasetHandler(BaseHTTPRequestHandler):
    server_version = "SortLab/1.0"

    def _send_bytes(self, content: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def _send_json(self, payload: dict, status: int = 200) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_bytes(content, "application/json; charset=utf-8", status)

    def _read_json_body(self) -> dict:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            content_length = int(raw_length)
        except ValueError as exc:
            raise ValueError("Invalid request size.") from exc
        if content_length <= 0:
            raise ValueError("The request body is empty.")
        if content_length > MAX_REQUEST_BYTES:
            raise ValueError("This request is too large. Please use a CSV file under 3 MB.")
        raw = self.rfile.read(content_length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("The request could not be read. Please retry.") from exc
        if not isinstance(payload, dict):
            raise ValueError("The request body must be a JSON object.")
        return payload

    def _frame_from_source(self, payload: dict) -> pd.DataFrame:
        source = payload.get("source", {})
        if not isinstance(source, dict):
            raise ValueError("Dataset source information is invalid.")
        source_type = source.get("type", "sample")
        if source_type == "sample":
            return load_sample_dataframe(source.get("name", "employees"))
        if source_type == "upload":
            csv_text = source.get("csv_text", "")
            if len(csv_text.encode("utf-8")) > 3 * 1024 * 1024:
                raise ValueError("Please choose a CSV file smaller than 3 MB.")
            return dataframe_from_csv_text(csv_text)
        raise ValueError("Unsupported dataset source.")

    def do_GET(self) -> None:  # noqa: N802 - standard-library handler method name
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/datasets":
            items = [
                {"name": name, "label": details["label"], "description": details["description"]}
                for name, details in DATASETS.items()
            ]
            self._send_json({"datasets": items})
            return

        if path == "/api/data":
            params = parse_qs(parsed.query)
            name = params.get("name", ["employees"])[0]
            try:
                frame = load_sample_dataframe(name)
                result = dataframe_preview(frame)
                result["dataset"] = name
                result["label"] = DATASETS[name]["label"]
                self._send_json(result)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, 400)
            return

        if path == "/api/health":
            self._send_json({"status": "ok", "app": "Sort Lab", "pandas": pd.__version__})
            return

        static_files = {
            "/": (STATIC_DIR / "index.html", "text/html; charset=utf-8"),
            "/index.html": (STATIC_DIR / "index.html", "text/html; charset=utf-8"),
            "/styles.css": (STATIC_DIR / "styles.css", "text/css; charset=utf-8"),
            "/app.js": (STATIC_DIR / "app.js", "text/javascript; charset=utf-8"),
        }
        item = static_files.get(path)
        if item is None:
            self._send_json({"error": "That page was not found."}, 404)
            return
        file_path, content_type = item
        try:
            self._send_bytes(file_path.read_bytes(), content_type)
        except OSError:
            self._send_json({"error": "The app files could not be loaded. Check that the ZIP was fully extracted."}, 500)

    def do_POST(self) -> None:  # noqa: N802 - standard-library handler method name
        path = urlparse(self.path).path
        try:
            payload = self._read_json_body()
            if path == "/api/preview":
                csv_text = payload.get("csv_text", "")
                if len(csv_text.encode("utf-8")) > 3 * 1024 * 1024:
                    raise ValueError("Please choose a CSV file smaller than 3 MB.")
                frame = dataframe_from_csv_text(csv_text)
                result = dataframe_preview(frame)
                result["label"] = payload.get("label", "Uploaded CSV")
                self._send_json(result)
                return

            if path == "/api/sort":
                frame = self._frame_from_source(payload)
                rules = payload.get("rules", [])
                sorted_frame, columns, ascending = sort_dataframe(frame, rules)
                result = dataframe_preview(sorted_frame)
                result["sorted_csv"] = sorted_frame.to_csv(index=False, na_rep="")
                result["sort_rules"] = [
                    {"column": column, "direction": "asc" if is_ascending else "desc"}
                    for column, is_ascending in zip(columns, ascending)
                ]
                result["code"] = (
                    "sorted_df = df.sort_values(\n"
                    f"    by={columns!r},\n"
                    f"    ascending={ascending!r}\n"
                    ")"
                )
                result["label"] = payload.get("label", "Sorted dataset")
                self._send_json(result)
                return

            self._send_json({"error": "That API endpoint was not found."}, 404)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, 400)
        except Exception as exc:  # Keep unexpected errors in a useful, non-crashing response.
            self._send_json({"error": f"Something went wrong while processing the dataset: {exc}"}, 500)

    def log_message(self, format_string: str, *args) -> None:
        # Keep useful server logs without exposing uploaded data.
        print(f"[{self.log_date_time_string()}] {format_string % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Sort Lab dataset sorting web app.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface (default: 127.0.0.1).")
    parser.add_argument("--port", default=8000, type=int, help="Port number (default: 8000).")
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), SortDatasetHandler)
    print("\nSORT LAB — DATASET WORKSPACE")
    print(f"App running at: http://{args.host}:{args.port}")
    print("Press Ctrl+C in this terminal to stop the server.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Sort Lab...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
