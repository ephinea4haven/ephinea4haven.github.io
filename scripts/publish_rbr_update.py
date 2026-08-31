#!/usr/bin/env python3
"""Publish one validated RBR rotation to the two Ephinea Wiki templates."""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from build_rbr_data import (
    API_URL,
    CURRENT_RBR_TEMPLATE,
    RBR_PAGE,
    RBR_TRACKER_TEMPLATE,
    RbrDataError,
    WikiPage,
)
from plan_rbr_update import build_update_plan


USER_AGENT = "Haven-PSOBB-RBR-publisher/1.0"
LOGIN_RETURN_URL = "https://wiki.pioneer2.net/w/Main_Page"
DEFAULT_CREDENTIALS_FILE = Path(".secrets/ephinea-wiki.json")


class RbrPublishError(RbrDataError):
    """Raised when authentication or conflict-protected publication fails."""


@dataclass(frozen=True)
class EditableWikiPage:
    """One exact Wiki revision plus timestamps required for safe editing."""

    title: str
    page_id: int
    revision_id: int
    revision_timestamp: str
    request_timestamp: str
    wikitext: str

    def as_wiki_page(self) -> WikiPage:
        return WikiPage(
            title=self.title,
            page_id=self.page_id,
            revision_id=self.revision_id,
            wikitext=self.wikitext,
        )


class MediaWikiClient:
    """Authenticated MediaWiki Action API client with an in-memory session."""

    def __init__(
        self,
        *,
        timeout: float = 30.0,
        opener: Callable[..., Any] | None = None,
    ) -> None:
        self.timeout = timeout
        if opener is None:
            cookie_jar = http.cookiejar.CookieJar()
            session = urllib.request.build_opener(
                urllib.request.HTTPCookieProcessor(cookie_jar)
            )
            self._opener = session.open
        else:
            self._opener = opener

    def _post(self, fields: dict[str, Any]) -> dict[str, Any]:
        body = urllib.parse.urlencode(fields).encode()
        request = urllib.request.Request(
            API_URL,
            data=body,
            headers={"User-Agent": USER_AGENT},
        )
        try:
            response = self._opener(request, timeout=self.timeout)
            with response:
                payload = json.load(response)
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
            raise RbrPublishError(f"MediaWiki request failed: {error}") from error
        if api_error := payload.get("error"):
            code = api_error.get("code", "unknown")
            info = api_error.get("info", "MediaWiki rejected the request")
            raise RbrPublishError(f"MediaWiki API error {code}: {info}")
        return payload

    def _token(self, token_type: str, *, assert_user: bool = False) -> str:
        fields = {
            "action": "query",
            "meta": "tokens",
            "type": token_type,
            "format": "json",
            "formatversion": "2",
        }
        if assert_user:
            fields["assert"] = "user"
        payload = self._post(
            fields
        )
        try:
            return payload["query"]["tokens"][f"{token_type}token"]
        except (KeyError, TypeError) as error:
            raise RbrPublishError(
                f"MediaWiki did not return a {token_type} token"
            ) from error

    def authenticate(self, username: str, password: str, /) -> str:
        """Log in through AuthManager and return the verified account name."""
        login = self._post(
            {
                "action": "clientlogin",
                "username": username,
                "password": password,
                "logintoken": self._token("login"),
                "loginreturnurl": LOGIN_RETURN_URL,
                "format": "json",
                "formatversion": "2",
            }
        ).get("clientlogin", {})
        if login.get("status") != "PASS":
            message = login.get("messagecode", "authentication failed")
            raise RbrPublishError(f"MediaWiki login failed: {message}")

        userinfo = self._post(
            {
                "action": "query",
                "meta": "userinfo",
                "uiprop": "rights",
                "assert": "user",
                "format": "json",
                "formatversion": "2",
            }
        )
        try:
            authenticated_user = userinfo["query"]["userinfo"]
            authenticated_name = authenticated_user["name"]
            rights = authenticated_user["rights"]
        except (KeyError, TypeError) as error:
            raise RbrPublishError("Could not verify the logged-in Wiki user") from error
        if authenticated_name.casefold() != username.casefold():
            raise RbrPublishError(
                f"Authenticated as unexpected Wiki user {authenticated_name!r}"
            )
        if "edit" not in rights:
            raise RbrPublishError(
                f"Wiki user {authenticated_name!r} does not have edit permission"
            )
        return authenticated_name

    def fetch_page(self, title: str, /) -> EditableWikiPage:
        payload = self._post(
            {
                "action": "query",
                "prop": "revisions",
                "rvprop": "ids|timestamp|content",
                "rvslots": "main",
                "titles": title,
                "curtimestamp": "1",
                "format": "json",
                "formatversion": "2",
            }
        )
        try:
            page = payload["query"]["pages"][0]
            revision = page["revisions"][0]
            return EditableWikiPage(
                title=page["title"],
                page_id=int(page["pageid"]),
                revision_id=int(revision["revid"]),
                revision_timestamp=revision["timestamp"],
                request_timestamp=payload["curtimestamp"],
                wikitext=revision["slots"]["main"]["content"],
            )
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise RbrPublishError(
                f"MediaWiki returned an invalid revision for {title!r}"
            ) from error

    def edit_page(
        self,
        page: EditableWikiPage,
        wikitext: str,
        /,
        *,
        csrf_token: str,
        summary: str,
    ) -> int:
        payload = self._post(
            {
                "action": "edit",
                "title": page.title,
                "text": wikitext,
                "summary": summary,
                "token": csrf_token,
                "assert": "user",
                "baserevid": page.revision_id,
                "basetimestamp": page.revision_timestamp,
                "starttimestamp": page.request_timestamp,
                "format": "json",
                "formatversion": "2",
            }
        )
        edit = payload.get("edit", {})
        if edit.get("result") != "Success" or "newrevid" not in edit:
            raise RbrPublishError(
                f"MediaWiki did not confirm the edit of {page.title!r}"
            )
        return int(edit["newrevid"])

    def csrf_token(self) -> str:
        """Return a CSRF token only while the authenticated session is valid."""
        return self._token("csrf", assert_user=True)


def publish_rotation(
    client: MediaWikiClient,
    username: str,
    password: str,
    selected: dict[int, str],
    /,
    *,
    summary: str,
) -> dict[str, Any]:
    """Authenticate, plan from exact revisions, publish, and verify each edit."""
    authenticated_name = client.authenticate(username, password)
    pages = {
        title: client.fetch_page(title)
        for title in (RBR_PAGE, CURRENT_RBR_TEMPLATE, RBR_TRACKER_TEMPLATE)
    }
    plan = build_update_plan(
        pages[RBR_PAGE].as_wiki_page(),
        pages[CURRENT_RBR_TEMPLATE].as_wiki_page(),
        pages[RBR_TRACKER_TEMPLATE].as_wiki_page(),
        selected,
        include_wikitext=True,
    )
    candidates = plan.pop("candidateWikitext")
    results: list[dict[str, Any]] = []

    changed_titles = [
        title
        for title, key in (
            (CURRENT_RBR_TEMPLATE, "currentRotation"),
            (RBR_TRACKER_TEMPLATE, "tracker"),
        )
        if plan["wiki"][key]["changed"]
    ]
    if changed_titles:
        csrf_token = client.csrf_token()
        for title in changed_titles:
            latest = client.fetch_page(title)
            planned = pages[title]
            if latest.revision_id != planned.revision_id:
                raise RbrPublishError(
                    f"{title} changed after planning: expected revision "
                    f"{planned.revision_id}, found {latest.revision_id}"
                )
            new_revision = client.edit_page(
                latest,
                candidates[title],
                csrf_token=csrf_token,
                summary=summary,
            )
            verified = client.fetch_page(title)
            if (
                verified.revision_id != new_revision
                or verified.wikitext != candidates[title]
            ):
                raise RbrPublishError(
                    f"Post-edit verification failed for {title}"
                )
            results.append(
                {
                    "title": title,
                    "previousRevision": latest.revision_id,
                    "revision": new_revision,
                    "verified": True,
                }
            )

    return {
        "mode": "publish",
        "result": "published" if results else "already-current",
        "targetWeek": plan["targetWeek"],
        "input": plan["input"],
        "authenticatedUser": authenticated_name,
        "edits": results,
    }


def parse_args() -> argparse.Namespace:
    """Parse the observed rotation and local credential-file path."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episode-1", required=True)
    parser.add_argument("--episode-2", required=True)
    parser.add_argument("--episode-4", required=True)
    parser.add_argument(
        "--credentials-file",
        type=Path,
        default=DEFAULT_CREDENTIALS_FILE,
        help=f"Local ignored JSON file (default: {DEFAULT_CREDENTIALS_FILE})",
    )
    parser.add_argument(
        "--summary",
        default="Update weekly Ragol Boost Road rotation",
    )
    return parser.parse_args()


def load_credentials(path: Path, /) -> tuple[str, str]:
    """Load a username and password from a mode-600 local JSON file."""
    try:
        if path.stat().st_mode & 0o077:
            raise RbrPublishError(
                f"Wiki credentials file must have mode 600: {path}"
            )
        data = json.loads(path.read_text(encoding="utf-8"))
        username = data["username"]
        password = data["password"]
    except RbrPublishError:
        raise
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as error:
        raise RbrPublishError(
            f"Could not load Wiki credentials from {path}"
        ) from error
    if not isinstance(username, str) or not username.strip():
        raise RbrPublishError(f"Invalid Wiki username in {path}")
    if not isinstance(password, str) or not password:
        raise RbrPublishError(f"Invalid Wiki password in {path}")
    return username.strip(), password


def main() -> int:
    """Publish the requested rotation and print a non-sensitive result."""
    args = parse_args()
    try:
        username, password = load_credentials(args.credentials_file)
        result = publish_rotation(
            MediaWikiClient(),
            username,
            password,
            {1: args.episode_1, 2: args.episode_2, 4: args.episode_4},
            summary=args.summary,
        )
    except RbrDataError as error:
        raise SystemExit(f"RBR publication failed: {error}") from error
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
