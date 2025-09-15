import re
from typing import TypedDict

class Grid(TypedDict):
  width: int
  height: int
  obstacles: list[tuple[int, int]]

def get_grid(map_file: str) -> Grid:
  width, height = 0, 0
  with open(map_file, "r", encoding="utf-8") as f:
    for line in f:
      s = line.strip().lower()
      m = re.match(r"width\s+(\d+)", s)
      if m: width = int(m.group(1)); continue
      m = re.match(r"height\s+(\d+)", s)
      if m: height = int(m.group(1)); continue
      if s == "map": break
    rows: list[str] = []
    for _ in range(height):
      row = f.readline().rstrip("\n")
      rows.append(row)
  assert len(rows) == height
  obstacles: list[tuple[int, int]] = []
  for y, row in enumerate(rows):
    if len(row) != width: raise ValueError("row width mismatch")
    for x, ch in enumerate(row):
      if ch == "@":
        obstacles.append((x, y))
  return {"width": width, "height": height, "obstacles": obstacles}