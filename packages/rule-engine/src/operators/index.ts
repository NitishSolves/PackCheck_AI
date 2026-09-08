import type { ValidationOperator } from '@packcheck/shared';
import type { Operator } from './types.js';

function fieldFor(fields: { fieldKey: string; rawValue: string | null; normalizedValue: string | null }[], key: unknown) {
  if (typeof key !== 'string') {
    return undefined;
  }
  return fields.find((field) => field.fieldKey === key);
}

const fieldRequired: Operator = (rule, fields) => {
  const key = rule.validationConfig['fieldKey'];
  const field = fieldFor(fields, key);
  const value = field?.normalizedValue ?? field?.rawValue ?? null;
  if (!value) {
    return {
      decision: 'ISSUE',
      explanation: 'Required declaration field was not extracted.',
      detectedValue: value,
    };
  }
  return {
    decision: 'PASS',
    explanation: 'Required declaration field is present.',
    detectedValue: value,
  };
};

const conditionalRequired: Operator = (rule, fields, context) => {
  const conditionField = rule.validationConfig['whenContextKey'];
  if (typeof conditionField !== 'string' || context[conditionField] === undefined) {
    return {
      decision: 'REVIEW',
      explanation: 'Applicability is unknown; conditional requirement cannot be evaluated.',
      detectedValue: null,
    };
  }
  if (!context[conditionField]) {
    return {
      decision: 'PASS',
      explanation: 'Conditional requirement is not applicable for this package context.',
      detectedValue: null,
    };
  }
  return fieldRequired(rule, fields, context);
};

const fieldFormat: Operator = (rule, fields) => {
  const key = rule.validationConfig['fieldKey'];
  const pattern = rule.validationConfig['pattern'];
  const field = fieldFor(fields, key);
  const value = field?.normalizedValue ?? field?.rawValue ?? null;
  if (!value) {
    return {
      decision: 'REVIEW',
      explanation: 'No value available to check format.',
      detectedValue: null,
    };
  }
  if (typeof pattern !== 'string') {
    return {
      decision: 'REVIEW',
      explanation: 'Format pattern is not configured on this verified rule version.',
      detectedValue: value,
    };
  }
  const matches = new RegExp(pattern).test(value);
  return {
    decision: matches ? 'PASS' : 'ISSUE',
    explanation: matches ? 'Value matches the configured format.' : 'Value does not match the configured format.',
    detectedValue: value,
  };
};

const dateParse: Operator = (rule, fields) => {
  const key = rule.validationConfig['fieldKey'];
  const field = fieldFor(fields, key);
  const value = field?.normalizedValue ?? field?.rawValue ?? null;
  if (!value) {
    return {
      decision: 'REVIEW',
      explanation: 'No date value available to parse.',
      detectedValue: null,
    };
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return {
      decision: 'REVIEW',
      explanation: 'Date could not be parsed with current evidence; needs verification.',
      detectedValue: value,
    };
  }
  return {
    decision: 'PASS',
    explanation: 'Date value parsed successfully.',
    detectedValue: value,
  };
};

const readability: Operator = (_rule, fields) => {
  const lowConfidence = fields.some((field) => field.confidence < 0.6 || field.needsReview);
  if (lowConfidence || fields.length === 0) {
    return {
      decision: 'REVIEW',
      explanation: 'Low OCR confidence must not automatically produce a legal violation.',
      detectedValue: null,
    };
  }
  return {
    decision: 'PASS',
    explanation: 'Extracted declarations meet the configured readability gate.',
    detectedValue: null,
  };
};

const numericConsistency: Operator = (rule, fields) => {
  const leftKey = rule.validationConfig['leftFieldKey'];
  const rightKey = rule.validationConfig['rightFieldKey'];
  const left = fieldFor(fields, leftKey);
  const right = fieldFor(fields, rightKey);
  const leftValue = Number(left?.normalizedValue ?? left?.rawValue);
  const rightValue = Number(right?.normalizedValue ?? right?.rawValue);
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
    return {
      decision: 'REVIEW',
      explanation: 'Numeric values are incomplete or unparsed; consistency cannot be determined.',
      detectedValue: null,
    };
  }
  const tolerance = typeof rule.validationConfig['tolerance'] === 'number' ? rule.validationConfig['tolerance'] : 0;
  const consistent = Math.abs(leftValue - rightValue) <= tolerance;
  return {
    decision: consistent ? 'PASS' : 'ISSUE',
    explanation: consistent
      ? 'Numeric values are consistent within tolerance.'
      : 'Numeric values are inconsistent within configured tolerance.',
    detectedValue: `${leftValue} vs ${rightValue}`,
  };
};

const crossPanelConsistency: Operator = (rule, fields) => {
  const key = rule.validationConfig['fieldKey'];
  if (typeof key !== 'string') {
    return {
      decision: 'REVIEW',
      explanation: 'Cross-panel field key is not configured.',
      detectedValue: null,
    };
  }
  const matching = fields.filter((field) => field.fieldKey === key);
  const values = matching
    .filter((field) => field.normalizedValue)
    .map((field) => `${field.panel ?? 'unknown'}:${field.normalizedValue}`);
  if (matching.length === 0) {
    return {
      decision: 'REVIEW',
      explanation: 'No panel values available for consistency comparison.',
      detectedValue: null,
    };
  }
  const unique = new Set(matching.map((field) => field.normalizedValue));
  if (unique.size <= 1) {
    return {
      decision: 'PASS',
      explanation: 'No cross-panel conflict detected for this field.',
      detectedValue: values.join('; ') || null,
    };
  }
  return {
    decision: 'ISSUE',
    explanation: 'Conflicting values were detected across panels.',
    detectedValue: values.join('; '),
  };
};

export const operators: Record<ValidationOperator, Operator> = {
  FIELD_REQUIRED: fieldRequired,
  CONDITIONAL_REQUIRED: conditionalRequired,
  FIELD_FORMAT: fieldFormat,
  DATE_PARSE: dateParse,
  READABILITY: readability,
  NUMERIC_CONSISTENCY: numericConsistency,
  CROSS_PANEL_CONSISTENCY: crossPanelConsistency,
};
