#!/usr/bin/env python3
"""zSSH local-first OpenSSH bootstrap. No remote execution, no private key export."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys

NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$")
HOST = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,252}$")

def paths(home=None):
    root = Path(home) if home else Path.home()
    ssh = root / ".ssh"
    return ssh, ssh / "zssh", ssh / "config", ssh / "zssh" / "hosts.conf"

def lock_down(path, directory=False):
    if os.name == "posix":
        path.chmod(0o700 if directory else 0o600)

def ensure_directory(path):
    path.mkdir(parents=True, exist_ok=True)
    lock_down(path, True)

def key_path(home=None):
    return paths(home)[1] / "id_ed25519"

def bootstrap(home=None, dry_run=False, comment=None):
    ssh, managed, config, hosts = paths(home)
    key = key_path(home)
    if not shutil.which("ssh") or not shutil.which("ssh-keygen"):
        raise RuntimeError("OpenSSH client and ssh-keygen are required")
    changes = []
    if not ssh.is_dir(): changes.append("create ~/.ssh")
    if not managed.is_dir(): changes.append("create ~/.ssh/zssh")
    if not key.exists(): changes.append("generate unique Ed25519 private key")
    if not config.exists() or "Include ~/.ssh/zssh/hosts.conf" not in config.read_text(encoding="utf-8"):
        changes.append("enable managed SSH host include")
    if dry_run:
        return {"status":"dry-run","changes":changes,"key":str(key)}
    ensure_directory(ssh)
    ensure_directory(managed)
    if not key.exists():
        if (key.with_suffix(".pub")).exists():
            raise RuntimeError("Public key exists without its private counterpart; refusing overwrite")
        cmd = ["ssh-keygen","-q","-t","ed25519","-a","64","-f",str(key),"-C",comment or ("zssh@" + socket.gethostname())]
        # Interactive passphrase by default: do not set -N "".
        subprocess.run(cmd, check=True)
    lock_down(key)
    if not hosts.exists():
        hosts.write_text("# Managed by zSSH. Do not store passwords here.\n",encoding="utf-8")
    lock_down(hosts)
    include = "Include ~/.ssh/zssh/hosts.conf"
    if config.exists():
        existing=config.read_text(encoding="utf-8")
    else:
        existing=""
    if include not in existing.splitlines():
        # Include must precede Host * for OpenSSH first-value precedence.
        config.write_text(include+"\n"+existing,encoding="utf-8")
    lock_down(config)
    return {"status":"ok","changes":changes,"key":str(key),"public_key":str(key)+".pub"}

def safe_field(value, pattern, name):
    if not pattern.fullmatch(value) or value.startswith("-"):
        raise ValueError("Invalid "+name)
    return value

def add_host(alias, hostname, user, port=22, home=None, dry_run=False):
    alias=safe_field(alias,NAME,"alias")
    hostname=safe_field(hostname,HOST,"hostname")
    user=safe_field(user,NAME,"user")
    if not 1 <= port <= 65535: raise ValueError("Invalid port")
    _,managed,_,hosts=paths(home)
    if not hosts.exists(): raise RuntimeError("Run 'init' before adding hosts")
    text=hosts.read_text(encoding="utf-8")
    if re.search(r"(?im)^Host\s+"+re.escape(alias)+r"\s*$",text):
        raise ValueError("Host alias already exists; edit manually")
    block=("\nHost "+alias+"\n  HostName "+hostname+"\n  User "+user+
           "\n  Port "+str(port)+"\n  IdentityFile "+str(key_path(home))+
           "\n  IdentitiesOnly yes\n  StrictHostKeyChecking yes\n")
    if not dry_run:
        with hosts.open("a",encoding="utf-8") as f: f.write(block)
        lock_down(hosts)
    return {"status":"dry-run" if dry_run else "ok","alias":alias}

def doctor(home=None, repair=False):
    ssh,managed,config,hosts=paths(home)
    key=key_path(home)
    checks={"ssh":bool(shutil.which("ssh")),"ssh_keygen":bool(shutil.which("ssh-keygen")),
      "ssh_dir":ssh.is_dir(),"key":key.is_file(),"public_key":Path(str(key)+".pub").is_file(),
      "config":config.is_file(),"managed_hosts":hosts.is_file()}
    if repair and checks["ssh"] and checks["ssh_keygen"] and checks["key"]:
        ensure_directory(ssh);ensure_directory(managed)
        lock_down(key)
        if hosts.exists():lock_down(hosts)
        if config.exists():lock_down(config)
    return {"healthy":all(checks.values()),"checks":checks}

def main(argv=None):
    p=argparse.ArgumentParser(description="zSSH secure local SSH starter kit")
    p.add_argument("--home",help="Override user home (for testing)")
    sub=p.add_subparsers(dest="command",required=True)
    init=sub.add_parser("init");init.add_argument("--dry-run",action="store_true");init.add_argument("--comment")
    sub.add_parser("doctor")
    sub.add_parser("repair")
    host=sub.add_parser("add-host");host.add_argument("alias");host.add_argument("hostname");host.add_argument("user")
    host.add_argument("--port",type=int,default=22);host.add_argument("--dry-run",action="store_true")
    args=p.parse_args(argv)
    try:
        if args.command=="init":result=bootstrap(args.home,args.dry_run,args.comment)
        elif args.command=="add-host":result=add_host(args.alias,args.hostname,args.user,args.port,args.home,args.dry_run)
        else:result=doctor(args.home,args.command=="repair")
        print(json.dumps(result,indent=2))
        return 0 if result.get("healthy",True) else 1
    except (OSError,ValueError,RuntimeError,subprocess.CalledProcessError) as exc:
        print(json.dumps({"error":str(exc)}),file=sys.stderr);return 2

if __name__=="__main__":
    raise SystemExit(main())
