# ProfileDeck Privacy Policy

Effective: July 25, 2026

ProfileDeck is a local-first, open-source project. The ProfileDeck project does
not operate a hosted service, sell personal information, or include analytics,
advertising, or telemetry.

This policy describes the software in this repository. If another person or
organization hosts ProfileDeck, that operator must publish terms and a privacy
policy covering its deployment.

## Supported product surfaces

ProfileDeck is designed for supported plugin surfaces in ChatGPT Work and Codex.
It does not extend regular Chat. ChatGPT, Codex, installed connectors, and
external services process information under their own terms and privacy
policies.

## Information ProfileDeck stores

The local MCP server stores:

- Profile IDs, names, descriptions, and revisions.
- Behavioral and data-handling instructions supplied in profiles.
- ProfileDeck skill IDs and connector IDs.
- Descriptive connector instance labels.
- Allowed operation and approval rules.
- Short-lived context IDs, creation and expiration times, and the profile
  revision and snapshot pinned to each context.

The default data file is:

```text
~/.profiledeck/profiles.json
```

The `PROFILEDECK_DATA_FILE` environment variable can select a different path.
The server writes the data file with restrictive permissions where supported by
the operating system.

## Information profiles must not contain

Profile documents must not contain:

- Passwords, API keys, access tokens, refresh tokens, cookies, or session IDs.
- Raw conversation transcripts or message histories.
- Connector response payloads or copied third-party records.
- Sensitive content used only to decide which profile should be active.

Connector instance labels are descriptive only. ProfileDeck does not inspect or
verify which external account is authenticated.

## Processing and transmission

In the default local configuration, the MCP server reads and writes the local
data file and returns routing decisions to the calling ChatGPT Work or Codex
surface. ProfileDeck does not intentionally transmit profile records to the
project maintainer or another third party.

When a user invokes an independently installed connector, that connector and the
host process the request. ProfileDeck may recommend, allow, confirm, or deny a
route inside its own workflow, but it does not proxy unrelated connector data
and is not an authorization boundary.

A self-hosted HTTP deployment sends MCP requests to the operator's server. The
operator is responsible for TLS, authentication, tenant isolation, storage,
logging, retention, access requests, and legally required disclosures.

## Logs

ProfileDeck does not intentionally log profile contents, MCP tool arguments,
connector data, or secrets. A hosting platform, reverse proxy, operating system,
or container runtime may independently record network and operational metadata.
Operators should disable request-body logging and redact authorization headers,
profile content, and MCP results.

## Retention and deletion

Profiles remain in the configured data file until they are updated or deleted.
At least one profile must remain in a store.

Contexts expire according to their time-to-live, are treated as unavailable immediately,
and are removed from the data file on the next mutation.
Deleting a profile also deletes contexts associated with that profile. Existing
contexts otherwise retain their pinned snapshot even after the profile is
edited, so edits apply to new contexts only.

A local user can remove all locally stored ProfileDeck data by stopping the
server and deleting the configured data file. Starting ProfileDeck again creates
the default Personal and Work profiles.

## Data sharing

The ProfileDeck project does not sell or rent information. The local software
does not intentionally share stored profile data with the maintainer.
Information may be disclosed by a deployment operator when required by law or
needed to protect the security and integrity of that deployment.

## Security

ProfileDeck strictly validates profile inputs, uses optimistic revision checks and an
inter-process file lock for updates, and writes local state atomically with backup
recovery. These controls reduce accidental corruption; they do not turn profiles into
security boundaries.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
Do not put personal information, credentials, or private connector data in a
public issue.

## Changes

Material changes to this policy will be documented in the repository and dated
above. Release notes will identify privacy-relevant behavior changes.

## Contact

For a privacy question about the open-source project, use the contact methods
published on the [maintainer's GitHub profile](https://github.com/ssukhpinder).
For a hosted deployment, contact that deployment's operator.
