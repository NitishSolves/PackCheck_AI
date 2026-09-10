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

    // Seed official regulatory sources
    const [lmpcSource] = await sql`
      INSERT INTO regulatory_sources (
        title, source_type, issuing_authority, official_url, verification_status, effective_date
      ) VALUES (
        'Legal Metrology (Packaged Commodities) Rules, 2011',
        'rules',
        'Department of Consumer Affairs, Government of India',
        'https://consumeraffairs.nic.in/acts-and-rules/legal-metrology/rules',
        'verified',
        '2011-04-01'
      ) ON CONFLICT DO NOTHING RETURNING id
    `;

    const sourceIdRow = lmpcSource ?? (await sql`
      SELECT id FROM regulatory_sources WHERE title = 'Legal Metrology (Packaged Commodities) Rules, 2011' LIMIT 1
    `)[0];

    if (sourceIdRow) {
      const sourceId = sourceIdRow.id;
      const allRules = await sql`SELECT id, rule_code FROM regulatory_rules`;
      const ruleIdMap = new Map(allRules.map((r) => [r.rule_code, r.id]));

      const VERIFIED_VERSIONS = [
        {
          ruleCode: 'R01',
          clauseReference: 'Rule 6(1)(a) & (b)',
          requirementText: 'Name and complete address of the manufacturer, or where manufacturer is not the packer, name and address of the manufacturer and packer, or for imported packages, the name and address of the importer.',
          validationType: 'FIELD_REQUIRED',
          validationConfig: { fieldKey: 'manufacturer' },
          severity: 'high',
        },
        {
          ruleCode: 'R02',
          clauseReference: 'Rule 6(1)(a)',
          requirementText: 'Generic or common name of the commodity contained in the package shall be clearly declared on the Principal Display Panel.',
          validationType: 'FIELD_REQUIRED',
          validationConfig: { fieldKey: 'common_generic_name' },
          severity: 'high',
        },
        {
          ruleCode: 'R03',
          clauseReference: 'Rule 6(1)(c) & Rule 11',
          requirementText: 'Net quantity in terms of standard metric unit of weight or measure (g, kg, ml, l) or number shall be declared on the Principal Display Panel without any qualifying words.',
          validationType: 'FIELD_REQUIRED',
          validationConfig: { fieldKey: 'net_quantity' },
          severity: 'high',
        },
        {
          ruleCode: 'R04',
          clauseReference: 'Rule 6(1)(d)',
          requirementText: 'Month and year in which the commodity is manufactured or pre-packed or imported shall be clearly indicated.',
          validationType: 'DATE_PARSE',
          validationConfig: { fieldKey: 'manufacture_or_pack_date' },
          severity: 'medium',
        },
        {
          ruleCode: 'R05',
          clauseReference: 'Rule 6(1)(10) / Rule 6(1)(a)',
          requirementText: 'Country of origin or manufacture shall be declared on every imported package.',
          validationType: 'CONDITIONAL_REQUIRED',
          validationConfig: { whenContextKey: 'isImported', fieldKey: 'country_of_origin' },
          severity: 'high',
        },
        {
          ruleCode: 'R06',
          clauseReference: 'Rule 6(1)(e)',
          requirementText: 'Maximum Retail Price (MRP) must be clearly declared as "MRP ₹ xx.xx (incl. of all taxes)" or "Maximum Retail Price ₹ xx.xx (inclusive of all taxes)".',
          validationType: 'FIELD_REQUIRED',
          validationConfig: { fieldKey: 'mrp' },
          severity: 'high',
        },
        {
          ruleCode: 'R07',
          clauseReference: 'Rule 6(1)(e) Second Proviso',
          requirementText: 'Unit sale price in ₹ per g/kg/ml/l/number shall be declared where net quantity exceeds standard threshold.',
          validationType: 'FIELD_REQUIRED',
          validationConfig: { fieldKey: 'unit_sale_price' },
          severity: 'medium',
        },
        {
          ruleCode: 'R08',
          clauseReference: 'Rule 6(1)(e)',
          requirementText: 'Unit sale price multiplied by net quantity must be mathematically consistent with declared Maximum Retail Price.',
          validationType: 'NUMERIC_CONSISTENCY',
          validationConfig: { leftFieldKey: 'mrp', rightFieldKey: 'mrp', tolerance: 0.5 },
          severity: 'medium',
        },
        {
          ruleCode: 'R09',
          clauseReference: 'Rule 6(1)(d) & FSSAI mandate',
          requirementText: 'Best before or use by date declaration for perishable/food items where applicable.',
          validationType: 'CONDITIONAL_REQUIRED',
          validationConfig: { whenContextKey: 'isFoodCommodity', fieldKey: 'best_before' },
          severity: 'medium',
        },
        {
          ruleCode: 'R10',
          clauseReference: 'Rule 6(1)(f)',
          requirementText: 'Name, address, telephone number, and email address of person or office to contact in case of consumer complaints.',
          validationType: 'FIELD_REQUIRED',
          validationConfig: { fieldKey: 'consumer_care' },
          severity: 'high',
        },
        {
          ruleCode: 'R11',
          clauseReference: 'Rule 9(1)',
          requirementText: 'Every declaration which is required to be made on a package shall be conspicuous, legible and prominent.',
          validationType: 'READABILITY',
          validationConfig: {},
          severity: 'medium',
        },
        {
          ruleCode: 'R14',
          clauseReference: 'Rule 6(1)',
          requirementText: 'Declarations on different display panels of the same package must not contradict each other.',
          validationType: 'CROSS_PANEL_CONSISTENCY',
          validationConfig: { fieldKey: 'net_quantity' },
          severity: 'high',
        },
      ];

      for (const v of VERIFIED_VERSIONS) {
        const ruleId = ruleIdMap.get(v.ruleCode);
        if (ruleId) {
          await sql`
            INSERT INTO rule_versions (
              rule_id, version_number, source_id, clause_reference, requirement_text,
              applicability, conditions, exceptions, validation_type, validation_config,
              severity, effective_from, status
            ) VALUES (
              ${ruleId}, 1, ${sourceId}, ${v.clauseReference}, ${v.requirementText},
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ${v.validationType}, ${JSON.stringify(v.validationConfig)}::jsonb,
              ${v.severity}, '2011-04-01', 'active'
            )
            ON CONFLICT (rule_id, version_number) DO UPDATE SET
              clause_reference = EXCLUDED.clause_reference,
              requirement_text = EXCLUDED.requirement_text,
              validation_type = EXCLUDED.validation_type,
              validation_config = EXCLUDED.validation_config,
              severity = EXCLUDED.severity,
              status = 'active',
              effective_from = '2011-04-01'
          `;
        }
      }
    }
  } finally {
    await sql.end();
  }
}
