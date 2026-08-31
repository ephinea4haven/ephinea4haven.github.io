"""Tests for authenticated, conflict-protected RBR Wiki publication."""

from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
import urllib.parse
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).parent))

import publish_rbr_update as publisher  # noqa: E402


class Response(io.BytesIO):
    def __enter__(self) -> "Response":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


class QueuedOpener:
    def __init__(self, *payloads: dict[str, object]) -> None:
        self.payloads = list(payloads)
        self.requests: list[dict[str, str]] = []

    def __call__(self, request: object, *, timeout: float) -> Response:
        self.requests.append(
            dict(urllib.parse.parse_qsl(request.data.decode(), keep_blank_values=True))
        )
        if timeout != 12:
            raise AssertionError(f"unexpected timeout {timeout}")
        return Response(json.dumps(self.payloads.pop(0)).encode())


def editable(title: str, revision: int, text: str = "source") -> publisher.EditableWikiPage:
    return publisher.EditableWikiPage(
        title=title,
        page_id=1,
        revision_id=revision,
        revision_timestamp="2026-08-30T00:00:00Z",
        request_timestamp="2026-08-31T00:00:00Z",
        wikitext=text,
    )


class MediaWikiClientTest(unittest.TestCase):
    def test_authenticates_with_clientlogin_and_verifies_user(self) -> None:
        opener = QueuedOpener(
            {"query": {"tokens": {"logintoken": "login-token"}}},
            {"clientlogin": {"status": "PASS", "username": "Maintainer"}},
            {
                "query": {
                    "userinfo": {
                        "name": "Maintainer",
                        "rights": ["read", "edit"],
                    }
                }
            },
        )
        client = publisher.MediaWikiClient(timeout=12, opener=opener)

        self.assertEqual(
            client.authenticate("Maintainer", "secret"),
            "Maintainer",
        )

        self.assertEqual(opener.requests[0]["type"], "login")
        self.assertEqual(opener.requests[1]["action"], "clientlogin")
        self.assertEqual(opener.requests[1]["password"], "secret")
        self.assertEqual(opener.requests[2]["assert"], "user")
        self.assertEqual(opener.requests[2]["uiprop"], "rights")

    def test_edit_uses_revision_and_timestamp_conflict_guards(self) -> None:
        opener = QueuedOpener(
            {"edit": {"result": "Success", "newrevid": 102}},
        )
        client = publisher.MediaWikiClient(timeout=12, opener=opener)

        revision = client.edit_page(
            editable("Template:Example", 101),
            "candidate",
            csrf_token="csrf-token",
            summary="Weekly update",
        )

        self.assertEqual(revision, 102)
        request = opener.requests[0]
        self.assertEqual(request["action"], "edit")
        self.assertEqual(request["assert"], "user")
        self.assertEqual(request["baserevid"], "101")
        self.assertEqual(request["basetimestamp"], "2026-08-30T00:00:00Z")
        self.assertEqual(request["starttimestamp"], "2026-08-31T00:00:00Z")

    def test_csrf_token_requires_an_authenticated_session(self) -> None:
        opener = QueuedOpener(
            {"query": {"tokens": {"csrftoken": "csrf-token"}}},
        )
        client = publisher.MediaWikiClient(timeout=12, opener=opener)

        self.assertEqual(client.csrf_token(), "csrf-token")
        self.assertEqual(opener.requests[0]["assert"], "user")


class CredentialsTest(unittest.TestCase):
    def test_loads_mode_600_local_credentials(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "wiki.json"
            path.write_text(
                json.dumps({"username": "Maintainer", "password": "secret"}),
                encoding="utf-8",
            )
            path.chmod(0o600)

            self.assertEqual(
                publisher.load_credentials(path),
                ("Maintainer", "secret"),
            )

    def test_rejects_credentials_readable_by_other_users(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "wiki.json"
            path.write_text("{}", encoding="utf-8")
            path.chmod(0o644)

            with self.assertRaisesRegex(publisher.RbrPublishError, "mode 600"):
                publisher.load_credentials(path)


class PublishRotationTest(unittest.TestCase):
    def test_already_current_authenticates_without_requesting_csrf(self) -> None:
        class Client:
            def authenticate(self, username: str, _password: str) -> str:
                return username

            def fetch_page(self, title: str) -> publisher.EditableWikiPage:
                return editable(title, 1)

            def csrf_token(self) -> str:
                raise AssertionError("no CSRF token is needed for a no-op")

        plan = {
            "result": "already-current",
            "targetWeek": "30 August 2026",
            "input": {"1": "SA2", "2": "LCV", "4": "NMU1"},
            "wiki": {
                "currentRotation": {"changed": False},
                "tracker": {"changed": False},
            },
            "candidateWikitext": {
                publisher.CURRENT_RBR_TEMPLATE: "source",
                publisher.RBR_TRACKER_TEMPLATE: "source",
            },
        }
        with patch.object(publisher, "build_update_plan", return_value=plan):
            result = publisher.publish_rotation(
                Client(),
                "Maintainer",
                "secret",
                {1: "SA2", 2: "LCV", 4: "NMU1"},
                summary="Weekly update",
            )

        self.assertEqual(result["result"], "already-current")
        self.assertEqual(result["edits"], [])

    def test_aborts_if_a_template_changes_after_planning(self) -> None:
        class Client:
            calls = 0

            def authenticate(self, username: str, _password: str) -> str:
                return username

            def fetch_page(self, title: str) -> publisher.EditableWikiPage:
                self.calls += 1
                revision = 2 if self.calls == 4 else 1
                return editable(title, revision)

            def csrf_token(self) -> str:
                return "csrf"

        plan = {
            "result": "planned",
            "targetWeek": "30 August 2026",
            "input": {"1": "SA2", "2": "LCV", "4": "NMU1"},
            "wiki": {
                "currentRotation": {"changed": True},
                "tracker": {"changed": False},
            },
            "candidateWikitext": {
                publisher.CURRENT_RBR_TEMPLATE: "candidate",
                publisher.RBR_TRACKER_TEMPLATE: "source",
            },
        }
        with patch.object(publisher, "build_update_plan", return_value=plan):
            with self.assertRaisesRegex(publisher.RbrPublishError, "changed after"):
                publisher.publish_rotation(
                    Client(),
                    "Maintainer",
                    "secret",
                    {1: "SA2", 2: "LCV", 4: "NMU1"},
                    summary="Weekly update",
                )


if __name__ == "__main__":
    unittest.main()
