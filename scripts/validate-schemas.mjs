import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ajv = new Ajv({ strict: true });

const configDir = path.resolve(__dirname, '../src/core/config');

/**
 * Each entry pairs a JSON Schema with the data file it governs.
 * Add new versioned config files here as they are introduced.
 */
const targets = [
  { schema: 'activation_profiles.schema.json', data: 'activation_profiles.json' },
  { schema: 'gap_rules.schema.json', data: 'gap_rules.json' },
  { schema: 'ghosttext_stems.schema.json', data: 'ghosttext_stems.json' },
];

function validateTarget({ schema, data }) {
  const schemaPath = path.resolve(configDir, schema);
  const dataPath = path.resolve(configDir, data);

  // Skip pairs whose files do not yet exist (configs land across PRs).
  if (!fs.existsSync(schemaPath) || !fs.existsSync(dataPath)) {
    console.log(`⏭️  Skipping ${data} (schema or data file not present yet)`);
    return true;
  }

  console.log(`Validating ${data} against ${schema}...`);
  const schemaJson = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const dataJson = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const validateFn = ajv.compile(schemaJson);
  const valid = validateFn(dataJson);

  if (!valid) {
    console.error(`❌ ${data} failed validation:`);
    console.error(ajv.errorsText(validateFn.errors));
    return false;
  }

  console.log(`✅ ${data} passed.`);
  return true;
}

try {
  const allValid = targets.map(validateTarget).every(Boolean);
  if (!allValid) {
    process.exit(1);
  }
  console.log('✅ All config files validated successfully!');
} catch (error) {
  console.error('❌ Error during validation:', error);
  process.exit(1);
}
