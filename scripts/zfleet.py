#!/usr/bin/env python3
"""zfleet: bounded parallel SSH execution for explicitly selected zSSH hosts.

Host aliases come from ~/.ssh/zssh/hosts.conf. Execution is opt-in with
--execute; otherwise this command only previews the target selection.
OpenSSH still executes the supplied command through the remote user's shell.
This is not a safe interface for executing untrusted AI-generated commands.
"""
import argparse
import json
import re
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ALIAS = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$")
MAX_OUT = 65536
MAX_PARALLEL = 16


def load_aliases(home=None):
    root = Path(home) if home is not None else Path.home()
    conf = root / ".ssh" / "zssh" / "hosts.conf"
    if not conf.is_file():
        raise RuntimeError("No hosts.conf; run zssh init and add-host first")
    names = []
    seen = set()
    for line in conf.read_text(encoding="utf-8").splitlines():
        match = re.match(r"(?i)^\s*Host\s+(\S+)\s*$", line)
        if match and ALIAS.fullmatch(match.group(1)):
            name = match.group(1)
            if name.lower() not in seen:
                names.append(name)
                seen.add(name.lower())
    return names


def select(names, hosts=None, pattern=None, all_hosts=False):
    modes = int(hosts is not None) + int(pattern is not None) + int(all_hosts)
    if modes != 1:
        raise ValueError("Select exactly one: --host, --match, or --all")
    if hosts is not None:
        unknown = [host for host in hosts if host not in names]
        if unknown:
            raise ValueError("Unknown host(s): " + ", ".join(unknown))
        return list(dict.fromkeys(hosts))
    if pattern is not None:
        regex = re.compile(pattern)
        return [name for name in names if regex.search(name)]
    return list(names)


def _drain(stream, buffer, truncated):
    """Consume the entire pipe without keeping more than MAX_OUT bytes."""
    try:
        while True:
            chunk = stream.read(8192)
            if not chunk:
                break
            remaining = MAX_OUT - len(buffer)
            if remaining > 0:
                buffer.extend(chunk[:remaining])
            if len(chunk) > remaining:
                truncated[0] = True
    finally:
        stream.close()


def run_one(alias, command, timeout, connect_timeout=10, ssh="ssh"):
    start = time.monotonic()
    if not ALIAS.fullmatch(alias):
        return {"host": alias, "ok": False, "exit": None, "stdout": "",
                "stderr": "invalid host alias", "seconds": 0.0}
    if not command.strip():
        return {"host": alias, "ok": False, "exit": None, "stdout": "",
                "stderr": "empty remote command", "seconds": 0.0}
    ssh_prefix = [ssh] if isinstance(ssh, str) else list(ssh)
    # The remote command must follow the destination directly; placing "--"
    # after the destination makes it part of the remote command.
    cmd = ssh_prefix + [
        "-n", "-T",
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=yes",
        "-o", "ConnectTimeout=%d" % connect_timeout,
        "-o", "ForwardAgent=no",
        "-o", "ClearAllForwardings=yes",
        "-o", "PermitLocalCommand=no",
        alias, command,
    ]
    try:
        proc = subprocess.Popen(
            cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except OSError as exc:
        return {"host": alias, "ok": False, "exit": None, "stdout": "",
                "stderr": str(exc), "seconds": round(time.monotonic() - start, 2)}

    out, err = bytearray(), bytearray()
    out_trunc, err_trunc = [False], [False]
    threads = [
        threading.Thread(target=_drain, args=(proc.stdout, out, out_trunc)),
        threading.Thread(target=_drain, args=(proc.stderr, err, err_trunc)),
    ]
    for thread in threads:
        thread.start()

    timed_out = False
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        proc.kill()
        proc.wait()
    finally:
        for thread in threads:
            thread.join()

    return {
        "host": alias,
        "ok": not timed_out and proc.returncode == 0,
        "exit": None if timed_out else proc.returncode,
        "stdout": out.decode("utf-8", errors="replace"),
        "stderr": ("timeout after %ss" % timeout if timed_out
                   else err.decode("utf-8", errors="replace")),
        "stdout_truncated": out_trunc[0],
        "stderr_truncated": err_trunc[0],
        "seconds": round(time.monotonic() - start, 2),
    }


def run_fleet(aliases, command, timeout=30, parallel=10, ssh="ssh",
              connect_timeout=10):
    if not 1 <= parallel <= MAX_PARALLEL:
        raise ValueError("parallel must be between 1 and %d" % MAX_PARALLEL)
    with ThreadPoolExecutor(max_workers=parallel) as executor:
        return list(executor.map(
            lambda alias: run_one(alias, command, timeout,
                                  connect_timeout=connect_timeout, ssh=ssh),
            aliases,
        ))


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="zfleet",
        description="Preview or run an SSH command on selected zSSH hosts",
    )
    parser.add_argument("command", help="remote shell command (one string)")
    selectors = parser.add_mutually_exclusive_group(required=True)
    selectors.add_argument("--host", action="append", help="alias (repeatable)")
    selectors.add_argument("--match", help="regex over aliases")
    selectors.add_argument("--all", action="store_true",
                           help="select all managed aliases")
    parser.add_argument("--execute", action="store_true",
                        help="actually execute; otherwise only preview")
    parser.add_argument("--dry-run", action="store_true",
                        help="preview selection (the default)")
    parser.add_argument("--confirm-all", action="store_true",
                        help="required with --execute --all")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--connect-timeout", type=int, default=10)
    parser.add_argument("--parallel", type=int, default=10)
    args = parser.parse_args(argv)

    def error(message):
        print(json.dumps({"status": "error", "error": message}),
              file=sys.stderr)
        return 2

    if args.execute and args.dry_run:
        return error("--execute and --dry-run are mutually exclusive")
    if args.execute and args.all and not args.confirm_all:
        return error("--execute --all requires --confirm-all")
    if args.confirm_all and not args.all:
        return error("--confirm-all requires --all")
    if not 1 <= args.timeout <= 3600:
        return error("--timeout must be between 1 and 3600 seconds")
    if not 1 <= args.connect_timeout <= 60:
        return error("--connect-timeout must be between 1 and 60 seconds")
    if not 1 <= args.parallel <= MAX_PARALLEL:
        return error("--parallel must be between 1 and %d" % MAX_PARALLEL)
    if not args.command.strip():
        return error("remote command must not be empty")

    try:
        targets = select(load_aliases(), args.host, args.match, args.all)
    except (RuntimeError, ValueError, re.error, OSError) as exc:
        return error(str(exc))
    if not targets:
        return error("no hosts selected")
    if not args.execute:
        print(json.dumps({
            "status": "dry-run", "hosts": targets, "command": args.command,
        }))
        return 0

    results = run_fleet(
        targets, args.command, args.timeout, args.parallel,
        connect_timeout=args.connect_timeout,
    )
    for result in results:
        print(json.dumps(result))
    return 0 if all(result["ok"] for result in results) else 1


if __name__ == "__main__":
    sys.exit(main())
