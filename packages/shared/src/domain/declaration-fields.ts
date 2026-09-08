export const DECLARATION_FIELD_KEYS = [
  'manufacturer',
  'packer',
  'importer',
  'country_of_origin',
  'common_generic_name',
  'net_quantity',
  'manufacture_or_pack_date',
  'import_date',
  'best_before',
  'use_by',
  'mrp',
  'consumer_care',
  'unit_sale_price',
  'dimensions',
] as const;

export type DeclarationFieldKey = (typeof DECLARATION_FIELD_KEYS)[number];

export function isDeclarationFieldKey(value: string): value is DeclarationFieldKey {
  return (DECLARATION_FIELD_KEYS as readonly string[]).includes(value);
}

export const DECLARATION_FIELD_LABELS: Record<DeclarationFieldKey, string> = {
  manufacturer: 'Manufacturer',
  packer: 'Packer',
  importer: 'Importer',
  country_of_origin: 'Country of origin',
  common_generic_name: 'Common/generic name',
  net_quantity: 'Net quantity',
  manufacture_or_pack_date: 'Manufacture or pack date',
  import_date: 'Import date',
  best_before: 'Best before',
  use_by: 'Use by',
  mrp: 'MRP / retail sale price',
  consumer_care: 'Consumer care',
  unit_sale_price: 'Unit sale price',
  dimensions: 'Dimensions',
};
