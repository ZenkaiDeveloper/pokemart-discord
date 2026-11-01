# Discord interaction signature fixtures

Discord verifies every HTTP interaction with **Ed25519** over `timestamp + body` using the application's public key (`X-Signature-Ed25519`, `X-Signature-Timestamp`).

See: https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization

This package mints vectors at test time with Node's Ed25519 (same curve / 32-byte raw public key Discord publishes as hex). Valid signatures must verify; tampered body or signature must return 401 at the Worker edge.

`queries.json` holds the 10 card-resolution fixtures for `/price` acceptance.
