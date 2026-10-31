import { z } from 'zod';

// Shared non-empty string function check
// Takes string as input, fails when string has no non-whitespace character
export const notBlank = (message: string) => z.string().regex(/\S/, message);

// Scoring fields from (docs/scoring-model.md)
export const FindingEffectEnum = z.enum(['exposes', 'protects']);

export type FindingEffect = z.infer<typeof FindingEffectEnum>;

export const RecipientTypeEnum = z.enum([
	'service_provider',
	'affiliate',
	'advertiser',
	'data_broker',
	'government',
	'other',
	'unspecified'
]);

export type RecipientType = z.infer<typeof RecipientTypeEnum>;

export const PurposeTypeEnum = z.enum([
	'service',
	'legal_security',
	'analytics',
	'advertising',
	'sale',
	'other',
	'unspecified'
]);

export type PurposeType = z.infer<typeof PurposeTypeEnum>;

// Fixed 'Category' Enum (Aligned with risk scoring requirements)
export const FindingCategoryEnum = z.enum([
	'collection',
	'use',
	'sharing',
	'retention',
	'user_rights',
	'security_practices'
]);

export type FindingCategory = z.infer<typeof FindingCategoryEnum>; // Extract inferred type

// Attention Labels for #21 AI analysis workflow Takeaways
/* positive: 		A protection or control explicitly described in the policy, with its limits.
   worth_knowing:	A material practice or tradeoff the reader should understand.
   higher_concern:	A practice warrants closer attention; the reason explains its sensitivity, reach, or limited control.
   unclear:			Ambiguity, conflicting wording, or an unspecified limit prevents a definite interpretation.
*/
export const AttentionLabelEnum = z.enum([
	'positive',
	'worth_knowing',
	'higher_concern',
	'unclear'
]); // Aligned with AI workflow proposal labels

export type AttentionLabel = z.infer<typeof AttentionLabelEnum>;

// Evidence Item Schema (Source passage references)
export const EvidenceItemSchema = z.object({
	passageId: notBlank('Evidence item requires an ID'),
	excerpt: notBlank('Non-empty quote excerpt is required')
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// Distinct Finding Schema (consumed by risk scoring)
export const FindingSchema = z.object({
	id: notBlank('Finding ID is required (e.g., "F1")'),
	category: FindingCategoryEnum,
	plain_language_description: notBlank('Plain-language summary is required'),
	dataCategories: z.array(notBlank('Data category must be stated')).default([]),
	purposes: z.array(notBlank('Purpose must be stated')).default([]),
	recipients: z.array(notBlank('Recipients must be stated')).default([]),
	evidence: z
		.array(EvidenceItemSchema)
		.min(1, 'At least one evidence item is required to prevent uncited claims'),
	// scoring fields
	effect: FindingEffectEnum.optional(),
	ambiguous: z.boolean().optional(),
	conditional: z.boolean().optional(),
	recipientTypes: z.array(RecipientTypeEnum).optional(),
	purposeTypes: z.array(PurposeTypeEnum).optional()
});

export type Finding = z.infer<typeof FindingSchema>;

// Readable Takeaway Schema (UI presentation layer)
export const TakeawaySchema = z.strictObject({
	id: notBlank('Takeaway ID is required'),
	topic: notBlank('Topic label is required'),
	reason: notBlank('Reason explaining the statement and conditions is required'),
	label: AttentionLabelEnum,
	findingIds: z
		.array(notBlank('Takeaway must have a written finding ID'))
		.min(1, 'Takeaway must link to at least one finding')
});

export type Takeaway = z.infer<typeof TakeawaySchema>;

// Discriminated Union states for Analysis Result
export const AnalysisInProgressSchema = z.object({
	status: z.literal('in_progress'),
	analysisId: notBlank('Analysis requires an ID'),
	schemaVersion: z.number().int().positive()
});

export const AnalysisSuccessSchema = z
	.object({
		status: z.literal('success'),
		analysisId: notBlank('Analysis requires an ID on success'),
		schemaVersion: z.number().int().positive(),
		summary: notBlank('Success state requires an overall readable summary'),
		findings: z.array(FindingSchema).min(1, 'Success state requires at least one finding'),
		takeaways: z.array(TakeawaySchema).min(1, 'Success state requires at least one takeaway')
	})
	// custom rule for findings and takeaways
	.superRefine((data, ctx) => {
		// create findings into a plain ID list
		const findingIds = new Set(data.findings.map((finding) => finding.id));

		// check for duplicate IDs
		if (findingIds.size !== data.findings.length) {
			ctx.addIssue({
				code: 'custom',
				message: 'Finding IDs must be unique',
				path: ['findings']
			});
		}
		// ensure each takeaway links to an existing finding
		data.takeaways.forEach((takeaway, i) => {
			takeaway.findingIds.forEach((id, j) => {
				if (!findingIds.has(id)) {
					ctx.addIssue({
						code: 'custom',
						message: `Takeaway links to unknown finding "${id}"`,
						path: ['takeaways', i, 'findingIds', j]
					});
				}
			});
		});
	});

export const AnalysisInsufficientSchema = z.strictObject({
	status: z.literal('insufficient'),
	analysisId: notBlank('Analysis requires an ID on insufficient'),
	schemaVersion: z.number().int().positive(),
	reason: notBlank(
		'Insufficient state requires an explanation for why analysis could not be completed'
	)
});

export const AnalysisFailedSchema = z.strictObject({
	status: z.literal('failed'),
	analysisId: notBlank('Analysis requires an ID on failed'),
	schemaVersion: z.number().int().positive(),
	errorCode: notBlank('Error code is required for failure states'),
	message: notBlank('Error message is required')
});

// Main Discriminated Union Contract
export const AnalysisResultSchema = z.discriminatedUnion('status', [
	AnalysisInProgressSchema,
	AnalysisSuccessSchema,
	AnalysisInsufficientSchema,
	AnalysisFailedSchema
]);

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
