import contextlib
import importlib.util
import io
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "zfleet", Path(__file__).resolve().parents[1] / "scripts" / "zfleet.py")
zfleet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zfleet)


def fake_ssh(directory):
    """Use Python as a portable fake SSH executable for Windows/macOS/Linux."""
    script = Path(directory) / "fake_ssh.py"
    script.write_text(
        "import json, os, sys, time\n"
        "args = sys.argv[1:]\n"
        "alias, command = args[-2:]\n"
        "if alias == 'good':\n"
        "    print('hi')\n"
        "elif alias == 'bad':\n"
        "    print('err', file=sys.stderr)\n"
        "    sys.exit(3)\n"
        "elif alias == 'slow':\n"
        "    time.sleep(5)\n"
        "elif alias == 'loud':\n"
        "    os.write(1, b'x' * 75000)\n"
        "elif alias == 'binary':\n"
        "    os.write(1, bytes([255, 254]))\n"
        "else:\n"
        "    print(json.dumps(args))\n",
        encoding="utf-8",
    )
    return [sys.executable, str(script)]


class FleetTests(unittest.TestCase):
    def test_load_and_explicit_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            conf = Path(directory) / ".ssh" / "zssh"
            conf.mkdir(parents=True)
            (conf / "hosts.conf").write_text(
                "\nHost web1\n  HostName x\nHost db1\n  HostName y\n"
                "Host WEB1\nHost *\n", encoding="utf-8")
            names = zfleet.load_aliases(directory)
            self.assertEqual(names, ["web1", "db1"])
            self.assertEqual(
                zfleet.select(names, pattern="^web"), ["web1"])
            self.assertEqual(
                zfleet.select(names, hosts=["db1", "db1"]), ["db1"])
            self.assertEqual(
                zfleet.select(names, all_hosts=True), names)
            with self.assertRaises(ValueError):
                zfleet.select(names)
            with self.assertRaises(ValueError):
                zfleet.select(names, hosts=["missing"])
            with self.assertRaises(re.error):
                zfleet.select(names, pattern="(", all_hosts=False)

    def test_success_failure_timeout_and_real_argv(self):
        with tempfile.TemporaryDirectory() as directory:
            ssh = fake_ssh(directory)
            results = zfleet.run_fleet(
                ["good", "bad", "slow", "argv"],
                "printf hello", timeout=1, parallel=4, ssh=ssh)
            by_host = {entry["host"]: entry for entry in results}
            self.assertTrue(by_host["good"]["ok"])
            self.assertEqual(by_host["good"]["stdout"].strip(), "hi")
            self.assertEqual(by_host["bad"]["exit"], 3)
            self.assertFalse(by_host["slow"]["ok"])
            self.assertIn("timeout", by_host["slow"]["stderr"])
            args = json.loads(by_host["argv"]["stdout"])
            self.assertEqual(args[-2:], ["argv", "printf hello"])
            self.assertNotIn("--", args)
            self.assertIn("StrictHostKeyChecking=yes", args)
            self.assertIn("BatchMode=yes", args)
            self.assertIn("ClearAllForwardings=yes", args)
            self.assertIn("-n", args)
            self.assertIn("-T", args)

    def test_capped_output_and_binary_decoding(self):
        with tempfile.TemporaryDirectory() as directory:
            ssh = fake_ssh(directory)
            loud = zfleet.run_one("loud", "echo ok", 5, ssh=ssh)
            self.assertTrue(loud["ok"])
            self.assertEqual(len(loud["stdout"]), zfleet.MAX_OUT)
            self.assertTrue(loud["stdout_truncated"])
            binary = zfleet.run_one("binary", "echo ok", 5, ssh=ssh)
            self.assertTrue(binary["ok"])
            self.assertIn("\ufffd", binary["stdout"])

    def test_missing_ssh_binary_fails_closed(self):
        result = zfleet.run_one(
            "good", "echo ok", 1, ssh="/nonexistent/ssh")
        self.assertFalse(result["ok"])
        self.assertIsNone(result["exit"])

    def test_invalid_alias_or_empty_command_never_executes(self):
        self.assertFalse(
            zfleet.run_one("-oProxyCommand=bad", "echo ok", 1)["ok"])
        self.assertFalse(zfleet.run_one("good", " ", 1)["ok"])

    def test_preview_is_default_and_does_not_execute(self):
        output = io.StringIO()
        with patch.object(zfleet, "load_aliases", return_value=["web1"]), \
             patch.object(zfleet, "run_fleet") as execute, \
             contextlib.redirect_stdout(output):
            result = zfleet.main(["uname -a", "--host", "web1"])
        self.assertEqual(result, 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "dry-run")
        execute.assert_not_called()

    def test_execute_requires_approval_for_all_hosts(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            status = zfleet.main(["uptime", "--all", "--execute"])
        self.assertEqual(status, 2)
        self.assertIn("--confirm-all", err.getvalue())

    def test_execute_single_host_returns_fleet_status(self):
        out = io.StringIO()
        mock_result = [{"host": "web1", "ok": True, "exit": 0,
                        "stdout": "", "stderr": "", "seconds": 0.1}]
        with patch.object(zfleet, "load_aliases", return_value=["web1"]), \
             patch.object(zfleet, "run_fleet", return_value=mock_result) as run, \
             contextlib.redirect_stdout(out):
            status = zfleet.main(["uptime", "--host", "web1", "--execute"])
        self.assertEqual(status, 0)
        run.assert_called_once()
        self.assertEqual(json.loads(out.getvalue())["host"], "web1")

    def test_rejects_invalid_limits(self):
        for extra in [
            ["--timeout", "0"],
            ["--connect-timeout", "-1"],
            ["--parallel", "999"],
        ]:
            with self.subTest(extra=extra):
                with contextlib.redirect_stderr(io.StringIO()):
                    status = zfleet.main(["uptime", "--host", "web1"] + extra)
                self.assertEqual(status, 2)


if __name__ == "__main__":
    unittest.main()
