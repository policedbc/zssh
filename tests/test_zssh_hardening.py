import importlib.util
import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "zssh", Path(__file__).resolve().parents[1] / "scripts" / "zssh.py")
zssh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zssh)

POSIX = os.name == "posix"


def init(d):
    def fake_run(cmd, check):
        k = Path(cmd[cmd.index("-f") + 1])
        k.write_text("private")
        Path(str(k) + ".pub").write_text("public")
        return subprocess.CompletedProcess(cmd, 0)
    with patch.object(zssh.shutil, "which", return_value="/usr/bin/ssh"), \
         patch.object(zssh.subprocess, "run", side_effect=fake_run), \
         patch.object(zssh, "verify_windows_key_acl"):
        return zssh.bootstrap(d)


class HardeningTests(unittest.TestCase):
    def test_existing_config_backed_up_once_and_include_first(self):
        with tempfile.TemporaryDirectory() as d:
            ssh = Path(d) / ".ssh"
            ssh.mkdir()
            (ssh / "config").write_text("Host *\n  ServerAliveInterval 30\n")
            init(d)
            init(d)
            text = (ssh / "config").read_text()
            self.assertTrue(text.startswith(zssh.INCLUDE_LINE + "\n"))
            self.assertEqual(text.count(zssh.INCLUDE_LINE), 1)
            backup = ssh / "config.zssh-backup"
            self.assertEqual(backup.read_text(), "Host *\n  ServerAliveInterval 30\n")

    def test_dry_run_ignores_commented_include(self):
        with tempfile.TemporaryDirectory() as d:
            ssh = Path(d) / ".ssh"
            ssh.mkdir()
            (ssh / "config").write_text("# " + zssh.INCLUDE_LINE + "\n")
            with patch.object(zssh.shutil, "which", return_value="/usr/bin/ssh"):
                r = zssh.bootstrap(d, dry_run=True)
            self.assertIn("enable managed SSH host include", r["changes"])

    @unittest.skipUnless(POSIX, "posix modes")
    def test_new_files_are_owner_only_from_creation(self):
        with tempfile.TemporaryDirectory() as d:
            init(d)
            hosts = zssh.paths(d)[3]
            self.assertEqual(stat.S_IMODE(hosts.stat().st_mode), 0o600)

    @unittest.skipUnless(POSIX, "symlinks")
    def test_symlinked_config_is_preserved(self):
        with tempfile.TemporaryDirectory() as d:
            ssh = Path(d) / ".ssh"
            ssh.mkdir()
            real = Path(d) / "dotfiles-config"
            real.write_text("Host x\n")
            (ssh / "config").symlink_to(real)
            init(d)
            self.assertTrue((ssh / "config").is_symlink())
            self.assertTrue(real.read_text().startswith(zssh.INCLUDE_LINE))

    def test_alias_collision_detected_in_multi_pattern_host_line(self):
        with tempfile.TemporaryDirectory() as d:
            init(d)
            hosts = zssh.paths(d)[3]
            hosts.write_text(hosts.read_text() + "Host a dev b\n  HostName z\n")
            with self.assertRaises(ValueError):
                zssh.add_host("dev", "dev.internal", "ubuntu", home=d)

    def test_add_host_adds_newline_when_file_lacks_one(self):
        with tempfile.TemporaryDirectory() as d:
            init(d)
            hosts = zssh.paths(d)[3]
            hosts.write_text("# no trailing newline")
            zssh.add_host("dev", "dev.internal", "ubuntu", home=d)
            self.assertIn("# no trailing newline\n\nHost dev\n", hosts.read_text())

    def test_identity_file_path_with_space_is_quoted(self):
        with tempfile.TemporaryDirectory(prefix="has space ") as d:
            init(d)
            zssh.add_host("dev", "dev.internal", "ubuntu", home=d)
            line = [l for l in zssh.paths(d)[3].read_text().splitlines()
                    if l.strip().startswith("IdentityFile")][0]
            self.assertRegex(line, r'IdentityFile ".*has space .*id_ed25519"$')

    def test_ssh_quote_rejects_embedded_quote(self):
        with self.assertRaises(ValueError):
            zssh.ssh_quote('a b"c')

    @unittest.skipUnless(POSIX, "posix modes")
    def test_doctor_detects_loose_permissions_and_repair_fixes_them(self):
        with tempfile.TemporaryDirectory() as d:
            init(d)
            key = zssh.key_path(d)
            key.chmod(0o644)
            with patch.object(zssh.shutil, "which", return_value="/usr/bin/ssh"), \
                 patch.object(zssh, "verify_windows_key_acl"):
                before = zssh.doctor(d)
                self.assertFalse(before["healthy"])
                self.assertFalse(before["checks"]["key_permissions"])
                after = zssh.doctor(d, repair=True)
            self.assertTrue(after["checks"]["key_permissions"])
            self.assertTrue(after["healthy"])

    def test_doctor_uses_windows_acl_verifier_on_nt(self):
        with tempfile.TemporaryDirectory() as d:
            init(d)
            with patch.object(zssh, "is_windows", return_value=True), \
                 patch.object(zssh, "verify_windows_key_acl", side_effect=RuntimeError("unsafe")):
                self.assertFalse(zssh.key_is_private(zssh.key_path(d)))
            with patch.object(zssh, "is_windows", return_value=True), \
                 patch.object(zssh, "verify_windows_key_acl"):
                self.assertTrue(zssh.key_is_private(zssh.key_path(d)))

    def test_doctor_reports_missing_include(self):
        with tempfile.TemporaryDirectory() as d:
            init(d)
            cfg = zssh.paths(d)[2]
            cfg.write_text("Host *\n")
            with patch.object(zssh.shutil, "which", return_value="/usr/bin/ssh"), \
                 patch.object(zssh, "verify_windows_key_acl"):
                r = zssh.doctor(d)
            self.assertFalse(r["checks"]["include_enabled"])
            self.assertFalse(r["healthy"])


if __name__ == "__main__":
    unittest.main()
