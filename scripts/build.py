#!/usr/bin/env python3
"""Create portable Python zipapp; requires Python 3 on destination host."""
from pathlib import Path
import shutil
import tempfile
import zipapp

root=Path(__file__).resolve().parents[1]
dist=root/"dist"
dist.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as d:
    target=Path(d)
    shutil.copyfile(root/"scripts"/"zssh.py",target/"__main__.py")
    zipapp.create_archive(target,dist/"zssh.pyz",interpreter="/usr/bin/env python3",compressed=True)
print(dist/"zssh.pyz")
