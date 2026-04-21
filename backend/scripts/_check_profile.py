import sqlite3, json

conn = sqlite3.connect("djm.db")
c = conn.cursor()
c.execute("SELECT id, title, content_json FROM profile_sections")
for r in c.fetchall():
    d = json.loads(r[2])
    fv = d.get("field_values", {})
    print(f"\n=== Section {r[0]}: {r[1]} ===")
    print(f"  Keys in content_json: {list(d.keys())}")
    print(f"  Keys in field_values: {list(fv.keys())}")
    print(f"  bullet: {d.get('bullet', 'NONE')[:100]}")
    # Check for description/summary at top level
    for k in ["description", "summary", "organization", "company", "school"]:
        if k in d:
            print(f"  TOP.{k}: {str(d[k])[:100]}")
    # Check normalized
    norm = d.get("normalized", {})
    if norm:
        print(f"  normalized keys: {list(norm.keys())}")
