import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import subprocess

spec=importlib.util.spec_from_file_location("zssh",Path(__file__).resolve().parents[1]/"scripts"/"zssh.py")
zssh=importlib.util.module_from_spec(spec)
spec.loader.exec_module(zssh)

class BootstrapTests(unittest.TestCase):
    def test_dry_run_does_not_write(self):
        with tempfile.TemporaryDirectory() as d:
            with patch.object(zssh.shutil,"which",return_value="/usr/bin/ssh"):
                x=zssh.bootstrap(d,dry_run=True)
            self.assertEqual(x["status"],"dry-run")
            self.assertFalse((Path(d)/".ssh").exists())

    def test_idempotent_init_and_add_host(self):
        with tempfile.TemporaryDirectory() as d:
            def fake_run(cmd,check):
                self.assertEqual(cmd[0],"ssh-keygen")
                Path(cmd[cmd.index("-f")+1]).write_text("private")
                Path(cmd[cmd.index("-f")+1]+".pub").write_text("public")
                return subprocess.CompletedProcess(cmd,0)
            with patch.object(zssh.shutil,"which",return_value="/usr/bin/ssh"),patch.object(zssh.subprocess,"run",side_effect=fake_run) as run:
                zssh.bootstrap(d)
                zssh.bootstrap(d)
                self.assertEqual(run.call_count,1)
            zssh.add_host("dev","dev.internal","ubuntu",home=d)
            content=zssh.paths(d)[3].read_text()
            self.assertIn("StrictHostKeyChecking yes",content)
            with self.assertRaises(ValueError):
                zssh.add_host("dev","dev.internal","ubuntu",home=d)

    def test_rejects_command_injection(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                zssh.add_host("safe","example.org;touch /tmp/bad","user",home=d)
            with self.assertRaises(ValueError):
                zssh.add_host("-oProxyCommand=evil","example.org","user",home=d)

if __name__=="__main__":
    unittest.main()
