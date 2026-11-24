#!/usr/bin/env python3
"""Keep plugin.xlsx opening in Excel without a repair prompt.

    workbook.py check plugin.xlsx   exit 1 and one line per table Excel would repair, or "workbook: ok"
    workbook.py fit   plugin.xlsx   put back a table header that data overwrote, extend every table to its last
                                    filled row, and group the Components rows (agent, command, skill, connector, hook,
                                    setting, then by name); prints what it changed, then runs check

Excel refuses a table whose header cells differ from its column names, and hides rows below a table's range.
Business purpose: the board and every role open their workbook straight away, with no "We found a problem" prompt.
Needs openpyxl.
"""
import sys
from copy import copy

try:
    from openpyxl import load_workbook
    from openpyxl.utils import get_column_letter, range_boundaries
except ImportError:
    sys.exit("workbook: needs openpyxl (pip install openpyxl)")


def tables(wb):
    for ws in wb.worksheets:
        for t in ws.tables.values():
            yield ws, t


def header(ws, t):
    c1, r1, c2, _ = range_boundaries(t.ref)
    return [ws.cell(r1, c).value for c in range(c1, c2 + 1)], [c.name for c in t.tableColumns]


def last_row(ws, t):
    c1, r1, c2, _ = range_boundaries(t.ref)
    last = r1
    for r in range(r1 + 1, ws.max_row + 1):  # the table's rows run to the first empty row; a footer after a gap stays out
        if not any(ws.cell(r, c).value not in (None, "") for c in range(c1, c2 + 1)):
            break
        last = r
    return max(last, r1 + 1)  # a table keeps at least one data row


def problems(wb):
    out = []
    for ws, t in tables(wb):
        got, want = header(ws, t)
        if [str(v) if v is not None else None for v in got] != want:
            out.append(f"{ws.title}: header row {t.ref.split(':')[0]} holds {got[:2]}..., not the columns {want[:2]}...")
        _, _, _, r2 = range_boundaries(t.ref)
        if last_row(ws, t) > r2:
            out.append(f"{ws.title}: rows below {t.ref} are outside the table")
    return out


KIND_ORDER = ["agent", "command", "skill", "connector", "hook", "setting"]


def group_components(ws, t):
    """Order the Components rows the way a reader scans a plugin: agents, commands, skills, connectors, then the rest."""
    c1, r1, c2, r2 = range_boundaries(t.ref)
    rows = [[ws.cell(r, c).value for c in range(c1, c2 + 1)] for r in range(r1 + 1, r2 + 1)]
    rows = [row for row in rows if any(v not in (None, "") for v in row)]

    def key(row):
        kind = str(row[0] or "").strip().lower()
        rank = next((i for i, k in enumerate(KIND_ORDER) if kind.startswith(k)), len(KIND_ORDER))
        return rank, kind, str(row[1] or "").lower()

    ordered = sorted(rows, key=key)
    if ordered == rows:
        return False
    for i, row in enumerate(ordered):
        for j, value in enumerate(row):
            ws.cell(r1 + 1 + i, c1 + j).value = value
    return True


def fit(wb):
    changed = []
    for ws, t in tables(wb):
        c1, r1, c2, _ = range_boundaries(t.ref)
        got, want = header(ws, t)
        if [str(v) if v is not None else None for v in got] != want:
            ws.insert_rows(r1)  # the overwritten header row moves down as data; the header goes back on top
            data_style = r1 + 2 if ws.cell(r1 + 2, c1).has_style else None  # a plain data row to copy the look from
            for i, name in enumerate(want):
                head, moved = ws.cell(r1, c1 + i), ws.cell(r1 + 1, c1 + i)
                head.value, head._style = name, copy(moved._style)  # the header keeps the header look
                moved._style = copy(ws.cell(data_style, c1 + i)._style) if data_style else copy(ws.cell(r1 + 3, c1 + i)._style)
            ws.row_dimensions[r1 + 1].height = None
            changed.append(f"{ws.title}: header put back")
        ref = f"{get_column_letter(c1)}{r1}:{get_column_letter(c2)}{last_row(ws, t)}"
        if ref != t.ref:
            changed.append(f"{ws.title}: table {t.ref} -> {ref}")
            t.ref = ref
            if t.autoFilter is not None:
                t.autoFilter.ref = ref
        if ws.title == "Components" and group_components(ws, t):
            changed.append("Components: rows grouped agent, command, skill, connector")
    return changed


def main(argv):
    if len(argv) != 2 or argv[0] not in ("check", "fit"):
        print(__doc__.strip().splitlines()[2], file=sys.stderr)
        return 2
    mode, path = argv
    wb = load_workbook(path)
    if mode == "fit":
        for line in fit(wb):
            print(f"workbook: {line}")
        wb.save(path)
        wb = load_workbook(path)
    bad = problems(wb)
    for line in bad:
        print(f"workbook: {line}")
    if not bad:
        print("workbook: ok")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
