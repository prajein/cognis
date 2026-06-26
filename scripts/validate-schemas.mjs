import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ajv = new Ajv({ strict: true });

function validate() {
  const schemaPath = path.resolve(__dirname, '../src/core/config/activation_profiles.schema.json');
  const dataPath = path.resolve(__dirname, '../src/core/config/activation_profiles.json');

  console.log(`Loading schema from ${schemaPath}...`);
  const schemaStr = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaStr);

  console.log(`Loading data from ${dataPath}...`);
  const dataStr = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(dataStr);

  const validateFn = ajv.compile(schema);
  const valid = validateFn(data);

  if (!valid) {
    console.error('❌ Validation failed:');
    console.error(ajv.errorsText(validateFn.errors));
    process.exit(1);
  }

  console.log('✅ Validation passed successfully!');
}

try {
  validate();
} catch (error) {
  console.error('❌ Error during validation:', error);
  process.exit(1);
}
