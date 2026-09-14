# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.

Use GitHub's [private vulnerability reporting](https://github.com/prajein/cognis/security/advisories/new) on this repository. Include what you found, how to reproduce it, and what an attacker could do with it.

Expect an initial response within a week. Cognis is a small early-stage project maintained part-time, so please be patient — but if something is actively dangerous to users, say so clearly in the subject and it will be prioritised.

## Scope

Cognis is a browser extension that runs on third-party AI sites, reads what you type there, and modifies the page. Issues that are in scope include:

- Prompt text or other sensitive input escaping local storage, being transmitted, or being written somewhere it should not be
- The extension exposing its data or messaging surface to the host page or other extensions
- Injection through content read from the page
- Anything that lets a visited site read or alter stored behavioural data

Note that the extension deliberately modifies your prompts before submission — see [Prompt enrichment](README.md#prompt-enrichment) in the README. That is intended behaviour, not a vulnerability, though bugs in how it does so may well be.

## Supported versions

Cognis is pre-1.0 and unreleased. Only the current `main` branch receives fixes.
