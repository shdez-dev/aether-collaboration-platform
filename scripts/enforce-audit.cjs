const fs = require('node:fs');

const auditPath = process.argv[2];
if (!auditPath) throw new Error('Usage: node scripts/enforce-audit.cjs <pnpm-audit.json>');

let report;
try {
  report = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
} catch (error) {
  throw new Error(`Could not read pnpm audit output: ${error.message}`);
}

if (!report.advisories || !report.metadata?.vulnerabilities) {
  throw new Error('pnpm audit did not return a valid advisory report');
}

const patchedLocally = new Set(['GHSA-vfj7-8cjw-p6xm']);
const unexpected = Object.values(report.advisories).filter(
  (advisory) => !patchedLocally.has(advisory.github_advisory_id)
);

if (unexpected.length) {
  for (const advisory of unexpected) {
    console.error(`${advisory.severity}: ${advisory.module_name} (${advisory.github_advisory_id || advisory.id})`);
  }
  process.exitCode = 1;
} else {
  console.log(`No new advisories; ${patchedLocally.size} locally patched advisory allowed.`);
}
