# Support

ProfileDeck is a community-maintained, early-stage project. Support is provided
on a best-effort basis.

## Before opening an issue

1. Confirm that you are using a supported ChatGPT Work or Codex plugin surface.
   ProfileDeck does not run in regular Chat.
2. Use Node.js 20 or newer and pnpm 10.34.0.
3. Pull the latest default branch.
4. Run:

   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   ```

5. Rebuild and reinstall the local plugin, then start a new chat or Codex
   session.
6. Check [README.md](README.md), [docs/local-development.md](docs/local-development.md),
   and existing [issues](https://github.com/ssukhpinder/profiledeck/issues).

## Ask for help

Open a
[support or bug issue](https://github.com/ssukhpinder/profiledeck/issues/new/choose)
with:

- ProfileDeck version or commit.
- Product surface and version.
- Operating system and Node.js version.
- Stdio or HTTP transport.
- Exact reproduction steps.
- Expected and actual behavior.
- Sanitized logs.

Do not include profile contents, conversation text, access tokens, cookies,
connector responses, or other private information.

## Unsupported requests

The project cannot:

- Enable ProfileDeck in regular Chat or unsupported product surfaces.
- Restore or revoke third-party connector access.
- Administer an OpenAI workspace.
- Debug a private deployment without reproducible, sanitized information.
- Guarantee compatibility with every third-party connector.

## Security reports

Do not use a public support issue for a vulnerability. Follow
[SECURITY.md](SECURITY.md) and use GitHub Private Vulnerability Reporting.
