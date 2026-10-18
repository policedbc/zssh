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

def verify_windows_key_acl(key):
    """Reject keys with access permissions outside current user, SYSTEM or Administrators."""
    script = (
        "$ErrorActionPreference='Stop';"
        "$acl=Get-Acl -LiteralPath $args[0];"
        "$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;"
        "$allowed=@($me,'S-1-5-18','S-1-5-32-544');"
        "foreach($ace in $acl.Access){"
        "$sid=$ace.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;"
        "if($ace.AccessControlType -eq 'Allow' -and $sid -notin $allowed){exit 5}"
        "};exit 0"
    )
    result = subprocess.run(["powershell","-NoProfile","-NonInteractive","-Command",script,str(key)],capture_output=True,text=True)
    if result.returncode:
        raise RuntimeError("Windows key ACL is unsafe or cannot be verified")

INCLUDE_LINE = "Include ~/.ssh/zssh/hosts.conf"

def has_include(text):
    return INCLUDE_LINE in [line.strip() for line in text.splitlines()]

def write_private(path, text):
    """Atomically replace path, creating the new file with owner-only mode.

    Follows symlinks (dotfile managers) so the link itself is preserved.
    """
    target = Path(os.path.realpath(path))
    tmp = target.with_name(target.name + ".zssh-tmp-" + str(os.getpid()))
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
        os.replace(str(tmp), str(target))
    except BaseException:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise

def ssh_quote(path):
    value = str(path)
    if any(ch in value for ch in ('"', '\r', '\n', '\0')):
        raise ValueError("Unsupported character in path")
    if re.search(r"[\s#]", value):
        return '"' + value + '"'
    return value

def mode_is_private(path):
    if os.name != "posix":
        return True
    return (path.stat().st_mode & 0o077) == 0

def is_windows():
    return os.name == "nt"

def key_is_private(key):
    if is_windows():
        try:
            verify_windows_key_acl(key)
            return True
        except (RuntimeError, OSError):
            return False
    return mode_is_private(key)

def bootstrap(home=None, dry_run=False, comment=None):
    ssh, managed, config, hosts = paths(home)
    key = key_path(home)
    if not shutil.which("ssh") or not shutil.which("ssh-keygen"):
        raise RuntimeError("OpenSSH client and ssh-keygen are required")
    changes = []
    if not ssh.is_dir(): changes.append("create ~/.ssh")
    if not managed.is_dir(): changes.append("create ~/.ssh/zssh")
    if not key.exists(): changes.append("generate unique Ed25519 private key")
    if not config.exists() or not has_include(config.read_text(encoding="utf-8")):
        changes.append("enable managed SSH host include")
    if dry_run:
        return {"status":"dry-run","changes":changes,"key":str(key)}
    ensure_directory(ssh)
    ensure_directory(managed)
    if not key.exists():
        if Path(str(key) + ".pub").exists():
            raise RuntimeError("Public key exists without its private counterpart; refusing overwrite")
        cmd = ["ssh-keygen","-q","-t","ed25519","-a","64","-f",str(key),"-C",comment or ("zssh@" + socket.gethostname())]
        # Interactive passphrase by default: do not set -N "".
        subprocess.run(cmd, check=True)
    lock_down(key)
    if os.name == "nt":
        verify_windows_key_acl(key)
    if not hosts.exists():
        write_private(hosts,"# Managed by zSSH. Do not store passwords here.\n")
    lock_down(hosts)
    existing = config.read_text(encoding="utf-8") if config.exists() else ""
    if not has_include(existing):
        backup = Path(str(config) + ".zssh-backup")
        if existing and not backup.exists():
            write_private(backup, existing)
        # Include must precede Host * for OpenSSH first-value precedence.
        write_private(config, INCLUDE_LINE + "\n" + existing)
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
    if re.search(r"(?im)^\s*Host\s+(?:\S+\s+)*"+re.escape(alias)+r"(?:\s+\S+)*\s*$",text):
        raise ValueError("Host alias already exists; edit manually")
    block=("\nHost "+alias+"\n  HostName "+hostname+"\n  User "+user+
           "\n  Port "+str(port)+"\n  IdentityFile "+ssh_quote(key_path(home))+
           "\n  IdentitiesOnly yes\n  StrictHostKeyChecking yes\n")
    if not dry_run:
        if text and not text.endswith("\n"): block="\n"+block
        write_private(hosts, text + block)
        lock_down(hosts)
    return {"status":"dry-run" if dry_run else "ok","alias":alias}

def doctor(home=None, repair=False):
    ssh,managed,config,hosts=paths(home)
    key=key_path(home)
    def collect():
        checks={"ssh":bool(shutil.which("ssh")),"ssh_keygen":bool(shutil.which("ssh-keygen")),
          "ssh_dir":ssh.is_dir(),"key":key.is_file(),"public_key":Path(str(key)+".pub").is_file(),
          "config":config.is_file(),"managed_hosts":hosts.is_file()}
        checks["include_enabled"]=config.is_file() and has_include(config.read_text(encoding="utf-8"))
        checks["key_permissions"]=key.is_file() and key_is_private(key)
        checks["hosts_permissions"]=hosts.is_file() and mode_is_private(hosts)
        return checks
    checks=collect()
    if repair and checks["ssh"] and checks["ssh_keygen"] and checks["key"]:
        ensure_directory(ssh);ensure_directory(managed)
        lock_down(key)
        if hosts.exists():lock_down(hosts)
        if config.exists():lock_down(config)
        checks=collect()
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
