import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import postgres from 'postgres';

const scryptAsync = promisify(scrypt);

const DEV_USERS = [
  {
    email: 'admin@packcheck.local',
    displayName: 'Development Admin',
    role: 'administrator',
    passwordEnv: 'SEED_ADMIN_PASSWORD',
    defaultPassword: 'PackCheckAdmin!dev',
  },
  {
    email: 'reviewer@packcheck.local',
    displayName: 'Development Reviewer',
    role: 'reviewer',
    passwordEnv: 'SEED_REVIEWER_PASSWORD',
    defaultPassword: 'PackCheckReviewer!dev',
  },
  {
    email: 'inspector@packcheck.local',
    displayName: 'Development Inspector',
    role: 'inspector',
    passwordEnv: 'SEED_INSPECTOR_PASSWORD',
    defaultPassword: 'PackCheckInspector!dev',
  },
] as const;

const P0_RULES = [
  { ruleCode: 'R01', title: 'Manufacturer/Packer/Importer' },
  { ruleCode: 'R02', title: 'Common/Generic Commodity Name' },
  { ruleCode: 'R03', title: 'Net Quantity/Number' },
  { ruleCode: 'R04', title: 'Manufacture/Pre-pack/Import Date' },
  { ruleCode: 'R05', title: 'Country of Origin where applicable' },
  { ruleCode: 'R06', title: 'MRP/Retail Sale Price' },
  { ruleCode: 'R07', title: 'Unit Sale Price where applicable' },
  { ruleCode: 'R08', title: 'Quantity ↔ Unit-Sale-Price Consistency' },
  { ruleCode: 'R09', title: 'Best Before/Use By where applicable' },
  { ruleCode: 'R10', title: 'Consumer Care Details' },
  { ruleCode: 'R11', title: 'Declaration Readability' },
  { ruleCode: 'R12', title: 'Declaration Visibility/Placement' },
  { ruleCode: 'R13', title: 'Font-Size/Legibility where a verified measurable threshold exists' },
  { ruleCode: 'R14', title: 'Cross-Panel Conflict Detection' },
  { ruleCode: 'R15', title: 'Package Context + Applicability + Exceptions' },
] as const;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function seedDevelopmentData(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    for (const user of DEV_USERS) {
      const password = process.env[user.passwordEnv] ?? user.defaultPassword;
      const passwordHash = await hashPassword(password);
      await sql`
        INSERT INTO users (email, password_hash, display_name, role, is_active)
        VALUES (${user.email}, ${passwordHash}, ${user.displayName}, ${user.role}, true)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          display_name = EXCLUDED.display_name,
          role = EXCLUDED.role,
          is_active = true,
          updated_at = now()
      `;
    }

    for (const rule of P0_RULES) {
      await sql`
        INSERT INTO regulatory_rules (rule_code, title)
        VALUES (${rule.ruleCode}, ${rule.title})
        ON CONFLICT (rule_code) DO UPDATE SET title = EXCLUDED.title
      `;
    }
  } finally {
    await sql.end();
  }
}
