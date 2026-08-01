from pathlib import Path
import re

workflow = Path('.github/workflows/agent-scenario-camera-view.yml').read_text()
start_marker = "          python <<'PY'\n"
end_marker = "\n          PY\n      - run: npm ci"
start = workflow.index(start_marker) + len(start_marker)
end = workflow.index(end_marker, start)
script = '\n'.join(
    line[10:] if line.startswith('          ') else line
    for line in workflow[start:end].splitlines()
)

robust_contract_patch = '''for contract_id in (
    'CFC-FN-NORMALIZE-CONFIG',
    'CFC-FN-WIDGET-START-SCENARIO',
    'CFC-FN-WIDGET-PREVIOUS-STEP',
    'CFC-FN-WIDGET-NEXT-STEP',
    'CFC-FN-VIEWER-START-SCENARIO',
    'CFC-FN-VIEWER-GO-SCENARIO-STEP',
):
    def add_scenario_camera_requirement(block: str, contract_id=contract_id) -> str:
        if '<REQUIREMENT ref="FR-SCENARIO-CAMERA-VIEW" />' in block:
            return block
        match = re.search(r'(?m)^([ \\t]*)</REQUIREMENTS>', block)
        if match is None:
            raise RuntimeError(f'{contract_id}: requirements end not found')
        indent = match.group(1)
        addition = f'{indent}<REQUIREMENT ref="FR-SCENARIO-CAMERA-VIEW" />\\n'
        return block[:match.start()] + addition + block[match.start():]
    update_block('ClassFunctionContracts.xml', 'FUNCTION_CONTRACT', contract_id, add_scenario_camera_requirement)
'''

script, count = re.subn(
    r"def add_contract_requirement\(.*?update_block\('ClassFunctionContracts.xml', 'FUNCTION_CONTRACT', contract_id, transform_viewer\)\n",
    robust_contract_patch,
    script,
    count=1,
    flags=re.DOTALL,
)
if count != 1:
    raise RuntimeError('Could not replace format-dependent ClassFunctionContracts patch section')

exec(compile(script, 'scenario-camera-view-patch.py', 'exec'))
