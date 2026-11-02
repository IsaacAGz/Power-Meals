#!/usr/bin/env bash
# Deploys Power Meals on the EC2 server. Run as root (it switches to the app user for git, npm and the build).
#
#   deploy.sh [ref]            build <ref> (branch, tag or sha; default main) into a new release and switch to it
#   deploy.sh rollback [name]  switch back to the previous good release (or to <name>)
#   deploy.sh list             show the releases
#
# Layout (docs/ec2-setup.md, sections 1 and 6):
#   $APP_ROOT/repo.git       mirror of the GitHub repo
#   $APP_ROOT/shared/.env    the only .env; every release links to it
#   $APP_ROOT/releases/<number>-<UTC time>-<sha>/
#   $APP_ROOT/current        symlink to the running release; the systemd units run from here
#
# The running release keeps serving while the new one installs and builds. Migrations run before the switch, so
# they must work with the release that is still running (add columns and tables; drop them a deploy later).
# Neither a rollback nor a failed health check undoes a migration.
set -Eeuo pipefail

APP_ROOT=${APP_ROOT:-/srv/power-meals}
APP_USER=${APP_USER:-powermeals}
SERVICE=${SERVICE:-power-meals}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/api/health}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}
KEEP_RELEASES=${KEEP_RELEASES:-5}
SYSTEMD_DIR=${SYSTEMD_DIR:-/etc/systemd/system}

REPO=$APP_ROOT/repo.git
RELEASES=$APP_ROOT/releases
SHARED_ENV=$APP_ROOT/shared/.env
CURRENT=$APP_ROOT/current
# A release that failed its health check or was rolled back from gets this file, so it is never picked again.
BAD_MARKER=.deploy-bad

log() { printf '%s deploy: %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() {
  log "error: $*"
  exit 1
}

as_app() {
  if [[ $(id -un) == "$APP_USER" ]]; then "$@"; else runuser -u "$APP_USER" -- "$@"; fi
}

# Release names start with a zero-padded sequence number, so a plain sort is deploy order. Not the clock: it can
# step backwards (NTP), and a rollback must never pick a newer release.
releases() {
  [[ -d $RELEASES ]] || return 0
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
}

next_number() {
  local last
  last=$(releases | tail -n 1)
  last=${last%%-*}
  printf '%05d' $((10#${last:-0} + 1))
}

current_release() {
  if [[ -L $CURRENT ]]; then basename "$(readlink "$CURRENT")"; fi
}

# The newest release older than the current one that was not marked bad.
previous_release() {
  local current candidate=""
  current=$(current_release)
  while read -r name; do
    [[ $name == "$current" ]] && break
    [[ -e $RELEASES/$name/$BAD_MARKER ]] || candidate=$name
  done < <(releases)
  printf '%s' "$candidate"
}

health_ok() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  # Asks at least once, even if the clock passes the deadline before the first try.
  while true; do
    if curl -fsS --max-time 3 -o /dev/null "$HEALTH_URL"; then return 0; fi
    if ((SECONDS >= deadline)); then return 1; fi
    sleep 1
  done
}

# Updates unit files that are already installed and lists the ones that are not (installing and enabling a timer
# is a deliberate step in docs/ec2-setup.md).
sync_units() {
  local dir=$1 changed=0 file name
  for file in "$dir"/deploy/systemd/*.service "$dir"/deploy/systemd/*.timer; do
    [[ -e $file ]] || continue
    name=$(basename "$file")
    if [[ ! -e $SYSTEMD_DIR/$name ]]; then
      log "not installed: $name (see docs/ec2-setup.md)"
    elif ! cmp -s "$file" "$SYSTEMD_DIR/$name"; then
      install -m 0644 "$file" "$SYSTEMD_DIR/$name"
      log "updated unit $name"
      changed=1
    fi
  done
  if ((changed)); then systemctl daemon-reload; fi
}

# Points current at the release (one atomic rename), restarts the app and waits for /api/health.
activate() {
  local name=$1
  sync_units "$RELEASES/$name"
  ln -sfn "releases/$name" "$APP_ROOT/.current.tmp"
  mv -T "$APP_ROOT/.current.tmp" "$CURRENT"
  if [[ ! -e $SYSTEMD_DIR/$SERVICE.service ]]; then
    log "current -> $name; $SERVICE.service is not installed yet, so nothing was restarted"
    return 0
  fi
  log "current -> $name; restarting $SERVICE"
  systemctl restart "$SERVICE"
  if health_ok; then
    log "healthy: $name"
    return 0
  fi
  log "$HEALTH_URL did not answer 200 within ${HEALTH_TIMEOUT}s"
  return 1
}

mark_bad() { as_app touch "$RELEASES/$1/$BAD_MARKER"; }

prune() {
  local keep current name
  current=$(current_release)
  keep=$(releases | tail -n "$KEEP_RELEASES")
  while read -r name; do
    [[ -z $name || $name == "$current" ]] && continue
    grep -qxF "$name" <<<"$keep" && continue
    rm -rf "${RELEASES:?}/$name"
    log "pruned $name"
  done < <(releases)
}

lock() {
  exec 9>"$APP_ROOT/.deploy.lock"
  flock -n 9 || die "another deploy or rollback is running"
}

preflight() {
  if [[ $(id -u) -ne 0 && $(id -un) != "$APP_USER" ]]; then die "run as root (sudo)"; fi
  [[ -d $REPO ]] || die "$REPO not found; create it with git clone --mirror (docs/ec2-setup.md section 1)"
  [[ -f $SHARED_ENV ]] || die "$SHARED_ENV not found (docs/ec2-setup.md section 2)"
}

# A release that failed before the switch is deleted, so it can never be picked by a rollback.
building=""
on_error() {
  if [[ -n $building ]]; then
    log "removing unfinished release $building"
    rm -rf "${RELEASES:?}/$building"
  fi
}
trap on_error ERR

deploy() {
  local ref=${1:-main} sha name dir previous
  preflight
  lock

  log "fetching"
  as_app git --git-dir="$REPO" fetch --prune --quiet origin
  sha=$(as_app git --git-dir="$REPO" rev-parse --verify --quiet "$ref^{commit}") || die "unknown ref: $ref"
  name="$(next_number)-$(date -u +%Y%m%dT%H%M%SZ)-${sha:0:7}"
  dir=$RELEASES/$name
  previous=$(current_release)

  log "building $ref ($sha) into releases/$name"
  building=$name
  as_app mkdir -p "$dir"
  as_app git --git-dir="$REPO" archive "$sha" | as_app tar -x -C "$dir"
  printf '%s\n' "$sha" | as_app tee "$dir/REVISION" >/dev/null
  as_app ln -s ../../shared/.env "$dir/.env"

  # Only the .env, not this shell's environment, so a variable exported by hand cannot hide a missing one.
  env -i PATH="$PATH" node --env-file="$SHARED_ENV" "$dir/scripts/check-deploy-env.mjs"

  # No subshells: they would inherit the ERR trap and clean up twice.
  cd "$dir"
  as_app npm ci --no-audit --no-fund
  as_app npm run build
  log "migrating"
  as_app npm run db:migrate
  cd /
  building=""

  if activate "$name"; then
    prune
    log "deployed $name"
    return 0
  fi

  mark_bad "$name"
  if [[ -z $previous ]]; then die "first release is unhealthy; check journalctl -u $SERVICE"; fi
  log "rolling back to $previous"
  activate "$previous" || die "$previous is unhealthy too; check journalctl -u $SERVICE"
  die "$name was unhealthy and is marked bad; running $previous again (migrations were not undone)"
}

rollback() {
  local target=${1:-} current
  preflight
  lock
  current=$(current_release)
  [[ -n $current ]] || die "nothing is deployed"
  target=${target:-$(previous_release)}
  [[ -n $target ]] || die "no earlier good release to roll back to"
  [[ -d $RELEASES/$target ]] || die "no release named $target"
  [[ $target != "$current" ]] || die "$target is already current"

  log "rolling back from $current to $target (migrations are not undone)"
  mark_bad "$current"
  rm -f "$RELEASES/$target/$BAD_MARKER"
  activate "$target" || die "$target is unhealthy; check journalctl -u $SERVICE"
}

list() {
  local current name flags
  current=$(current_release)
  while read -r name; do
    [[ -n $name ]] || continue
    flags=""
    [[ $name == "$current" ]] && flags+=" current"
    [[ -e $RELEASES/$name/$BAD_MARKER ]] && flags+=" bad"
    printf '%s%s\n' "$name" "$flags"
  done < <(releases)
}

case ${1:-} in
  rollback) rollback "${2:-}" ;;
  list) list ;;
  -h | --help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) deploy "${1:-main}" ;;
esac
