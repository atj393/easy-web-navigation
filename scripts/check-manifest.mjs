#!/usr/bin/env node
/**
 * Manifest guard.
 *
 * Easy Web Navigation's whole proposition rests on asking for almost nothing:
 * three narrow permissions, no host access at install time, and broad host
 * access only as an optional grant the user triggers. That promise lives in
 * the store listing, the privacy disclosure and the README — but it is
 * ENFORCED by a build tool that generates the manifest from config plus
 * whatever WXT infers from the entrypoints. A dependency upgrade or a stray
 * `matches` entry could widen it without anyone noticing until review.
 *
 * This script asserts the built manifests, for every browser target, are
 * exactly what the product promises. It runs in `pnpm run ci`, after the
 * builds.
 *
 * Usage: node scripts/check-manifest.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const OUTPUT_ROOT = path.resolve("apps/extension/.output");

/** Exactly the permissions the product is allowed to request up front. */
const REQUIRED_PERMISSIONS = ["activeTab", "scripting", "storage"];

/** Optional host access, requested at runtime for automatic checking only. */
const OPTIONAL_HOSTS = ["http://*/*", "https://*/*"];

/**
 * Permissions that would change what the product IS. None of these is needed
 * for read-only inspection of the active tab, and several would have to be
 * justified to store reviewers and disclosed to users.
 */
const FORBIDDEN_PERMISSIONS = [
  "tabs",
  "webRequest",
  "webRequestBlocking",
  "webNavigation",
  "history",
  "bookmarks",
  "cookies",
  "downloads",
  "management",
  "nativeMessaging",
  "notifications",
  "clipboardRead",
  "clipboardWrite",
  "privacy",
  "proxy",
  "debugger",
  "declarativeNetRequest",
  "<all_urls>",
];

const TARGETS = [
  { dir: "chrome-mv3", label: "Chromium MV3", manifestVersion: 3 },
  { dir: "firefox-mv2", label: "Firefox MV2", manifestVersion: 2 },
];

let failures = 0;

function fail(target, message) {
  failures += 1;
  console.error(`FAIL  ${target}: ${message}`);
}

function same(a, b) {
  const left = [...(a ?? [])].sort();
  const right = [...(b ?? [])].sort();
  return JSON.stringify(left) === JSON.stringify(right);
}

for (const target of TARGETS) {
  const failuresBefore = failures;
  const manifestPath = path.join(OUTPUT_ROOT, target.dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    fail(
      target.label,
      `no build at ${manifestPath}. Run \`pnpm build\` and \`pnpm build:firefox\`.`,
    );
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(target.label, `manifest is not valid JSON: ${error.message}`);
    continue;
  }

  if (manifest.manifest_version !== target.manifestVersion) {
    fail(
      target.label,
      `manifest_version is ${manifest.manifest_version}, expected ${target.manifestVersion}.`,
    );
  }

  if (!same(manifest.permissions, REQUIRED_PERMISSIONS)) {
    fail(
      target.label,
      `permissions are ${JSON.stringify(manifest.permissions)}, expected ${JSON.stringify(REQUIRED_PERMISSIONS)}.`,
    );
  }

  // No host access may be requested at install time, in either key.
  if (manifest.host_permissions?.length) {
    fail(
      target.label,
      `host_permissions must be empty, found ${JSON.stringify(manifest.host_permissions)}.`,
    );
  }

  const declaredMatches = (manifest.content_scripts ?? []).flatMap((cs) => cs.matches ?? []);
  if (declaredMatches.length > 0) {
    fail(
      target.label,
      `content scripts must be registered at runtime, but the manifest declares matches ${JSON.stringify(declaredMatches)}.`,
    );
  }

  // Optional host access must be present, under whichever key the manifest
  // version uses, so the automatic-checking scopes can actually be granted.
  const optionalHosts =
    target.manifestVersion === 3
      ? manifest.optional_host_permissions
      : manifest.optional_permissions;
  if (!same(optionalHosts, OPTIONAL_HOSTS)) {
    const key = target.manifestVersion === 3 ? "optional_host_permissions" : "optional_permissions";
    fail(
      target.label,
      `${key} are ${JSON.stringify(optionalHosts)}, expected ${JSON.stringify(OPTIONAL_HOSTS)}.`,
    );
  }

  const requested = [
    ...(manifest.permissions ?? []),
    ...(manifest.host_permissions ?? []),
    ...(manifest.optional_permissions ?? []),
    ...(manifest.optional_host_permissions ?? []),
  ];
  for (const forbidden of FORBIDDEN_PERMISSIONS) {
    if (requested.includes(forbidden)) {
      fail(target.label, `requests "${forbidden}", which this product must never need.`);
    }
  }

  // No remote code: the store listing and privacy disclosure both say so.
  const csp = JSON.stringify(manifest.content_security_policy ?? "");
  if (csp.includes("unsafe-eval") || csp.includes("http://") || csp.includes("https://")) {
    fail(target.label, `content_security_policy allows remote or eval'd code: ${csp}`);
  }

  if (failures === failuresBefore) {
    console.log(
      `PASS  ${target.label}: permissions ${JSON.stringify(manifest.permissions)}, ` +
        `no required hosts, optional hosts ${JSON.stringify(optionalHosts)}.`,
    );
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} manifest problem(s). The permission surface is part of the product.`,
  );
  process.exit(1);
}
console.log("\nManifests match the product's permission promise.");
