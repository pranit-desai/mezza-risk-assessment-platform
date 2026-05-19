import json, re
from pathlib import Path

extracted = json.loads(Path("C:/Users/prani/OneDrive/Documents/mezza-backend/epik_extracted.json").read_text(encoding="utf-8-sig"))
schema_text = Path("app/_lib/dataBankSchema.js").read_text(encoding="utf-8")

# Reality paths from extracted_json
ej = extracted["extracted_json"]
reality = {}
for section, content in ej.items():
    if isinstance(content, dict):
        for k, v in content.items():
            reality[f"{section}.{k}"] = type(v).__name__
    elif isinstance(content, list):
        reality[f"{section}"] = f"list[{len(content)}]"

# Schema paths: walk each section block, combine its jsonPath with each field key
schema_paths = {}
# Match each section: id, jsonPath, then its fields array
section_pattern = re.compile(
    r"id:\s*['\"]([^'\"]+)['\"].*?"
    r"jsonPath:\s*['\"]([^'\"]*)['\"].*?"
    r"fields:\s*\[(.*?)\]\s*,?\s*}",
    re.DOTALL
)
field_key_pattern = re.compile(r"key:\s*['\"]([^'\"]+)['\"]")

for match in section_pattern.finditer(schema_text):
    section_id, json_path, fields_block = match.group(1), match.group(2), match.group(3)
    for fmatch in field_key_pattern.finditer(fields_block):
        key = fmatch.group(1)
        full_path = f"{json_path}.{key}" if json_path else key
        schema_paths[full_path] = section_id

reality_paths = set(reality.keys())
schema_path_set = set(schema_paths.keys())

matches = sorted(reality_paths & schema_path_set)
schema_only = sorted(schema_path_set - reality_paths)
reality_only = sorted(reality_paths - schema_path_set)

print(f"=== SCHEMA vs REALITY DIFF ===\n")
print(f"Schema paths: {len(schema_path_set)}  |  Reality paths: {len(reality_paths)}\n")
print(f"--- MATCHES ({len(matches)}) ---")
for p in matches: print(f"  OK  {p}  [section: {schema_paths[p]}]")
print(f"\n--- SCHEMA HAS, REALITY DOES NOT ({len(schema_only)}) - rename or mark manualFill:true ---")
for p in schema_only: print(f"  ??  {p}  [section: {schema_paths[p]}]")
print(f"\n--- REALITY HAS, SCHEMA DOES NOT ({len(reality_only)}) - candidates to ADD ---")
for p in reality_only: print(f"  ++  {p}  ({reality[p]})")