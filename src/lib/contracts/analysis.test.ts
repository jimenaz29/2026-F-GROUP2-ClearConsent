import { describe, it, expect } from 'vitest';
import {
	AnalysisResultSchema,
	EvidenceItemSchema,
	FindingSchema,
	TakeawaySchema,
	FindingEffectEnum,
	RecipientTypeEnum,
	PurposeTypeEnum
} from './analysis';
import { successFixture, InsufficientFixture, FailureFixture, InProgressFixture } from './fixtures';
import {
	FINDING_EFFECTS,
	RECIPIENT_TYPES,
	PURPOSE_TYPES
} from '$lib/server/analysis/consolidation/schemas';

describe('AnalysisResultSchema Contract & Fixtures', () => {
	// success runs on synthetic fixtures (4 tests)
	it('validates the success fixture successfully', () => {
		const result = AnalysisResultSchema.safeParse(successFixture);
		expect(result.success).toBe(true);
	});

	it('validates the insufficient fixture successfully', () => {
		const result = AnalysisResultSchema.safeParse(InsufficientFixture);
		expect(result.success).toBe(true);
	});

	it('validates the failure fixture successfully', () => {
		const result = AnalysisResultSchema.safeParse(FailureFixture);
		expect(result.success).toBe(true);
	});

	it('validates the in_progress fixture successfully', () => {
		const result = AnalysisResultSchema.safeParse(InProgressFixture);
		expect(result.success).toBe(true);
	});

	// malformed payload test runs (9 tests)
	it('rejects malformed payloads', () => {
		const malformed = {
			status: 'success',
			analysisId: 'mock_bad_01',
			schemaVersion: 1,
			summary: 'Missing findings array',
			findings: [], // can't be empty
			takeaways: []
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects unknown status types', () => {
		const malformed = {
			status: 'non_existent_status',
			analysisId: 'mock_bad_02',
			schemaVersion: 1
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects successful result with missing evidence', () => {
		const malformed = {
			status: 'success',
			analysisId: 'mock_bad_03',
			schemaVersion: 1,
			summary: 'Success finding with missing evidence',
			findings: [
				{
					id: 'F1',
					category: 'collection',
					plain_language_description:
						'Location services are automatically collected unless user opts out.',
					dataCategories: ['Location data', 'IP address'],
					purposes: ['Service operation'],
					recipients: [],
					evidence: []
				}
			],
			takeaways: [
				{
					id: 'T1',
					topic: 'Information collection',
					reason:
						'The policy collects approximate location for service operation and shares it with advertising partners only when personalized ads are enabled.',
					label: 'higher_concern',
					findingIds: ['F1']
				}
			]
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects failed state with no error code', () => {
		const malformed = {
			status: 'failed',
			analysisId: 'mock_bad_04',
			schemaVersion: 1,
			message: 'Malformed element, no errorCode'
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects successful result with missing passageId in evidence', () => {
		const malformed = {
			status: 'success',
			analysisId: 'mock_bad_05',
			schemaVersion: 1,
			summary: 'Success finding with missing passageId link to evidence',
			findings: [
				{
					id: 'F1',
					category: 'sharing',
					plain_language_description:
						'Specific user information is saved and shared to third-parties',
					dataCategories: ['User preferences'],
					purposes: ['Better service'],
					recipients: ['Third-party applications'],
					evidence: [
						{
							excerpt:
								'Our website makes use of sharing user preferences with our other applications as third-party services in an effort to enhance the user experience.'
						}
					]
				}
			],
			takeaways: [
				{
					id: 'T1',
					topic: 'Information shared',
					reason: 'Website owners share user set preferences with their third-party applications.',
					label: 'unclear',
					findingIds: ['F1']
				}
			]
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a takeaway that links to a nonexistent finding', () => {
		const malformed = {
			...successFixture,
			takeaways: [
				{
					id: 'T1',
					topic: 'Error message',
					reason: 'This takeaway points to a nonexistent finding.',
					label: 'positive',
					findingIds: ['F9']
				}
			]
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects an insufficient result that includes findings', () => {
		const malformed = {
			...InsufficientFixture,
			findings: []
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a failed result that includes findings', () => {
		const malformed = {
			...FailureFixture,
			findings: []
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects duplicate finding IDs', () => {
		const finding = {
			id: 'F1',
			category: 'collection',
			plain_language_description: 'Approximate location is collected to operate the service.',
			dataCategories: ['Location data'],
			purposes: ['Service operation'],
			recipients: [],
			evidence: [
				{
					passageId: 'P1',
					excerpt: 'We collect approximate location from your IP address to operate the service.'
				}
			]
		};

		const malformed = {
			...successFixture,
			findings: [finding, finding],
			takeaways: [
				{
					id: 'T1',
					topic: 'Information collection',
					reason: 'Location is collected.',
					label: 'positive',
					findingIds: ['F1']
				}
			]
		};

		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});
});

// Blank-string tests
describe('Whitespace-only text is rejected', () => {
	// synthetic fixture to copy from, every test below changes one field
	const evidence = {
		passageId: 'P1',
		excerpt: 'We collect approximate location from your IP address to operate the service.'
	};

	const finding = {
		id: 'F1',
		category: 'collection',
		plain_language_description: 'Approximate location is collected to operate the service.',
		dataCategories: ['Location data'],
		purposes: ['Service operation'],
		recipients: ['Advertising partners'],
		evidence: [evidence]
	};

	const takeaway = {
		id: 'T1',
		topic: 'Information collection',
		reason: 'Location is collected to operate the service.',
		label: 'positive',
		findingIds: ['F1']
	};

	// evidence check for white-space only input
	it('rejects evidence with a whitespace-only passageId', () => {
		const malformed = {
			...evidence,
			passageId: '   '
		};
		const result = EvidenceItemSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects evidence with a whitespace-only excerpt', () => {
		const malformed = {
			...evidence,
			excerpt: '   '
		};
		const result = EvidenceItemSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects an excerpt made only of tabs and newlines', () => {
		const malformed = {
			...evidence,
			excerpt: '\t\n  \n'
		};
		const result = EvidenceItemSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('keeps the spaces around a real excerpt unchanged', () => {
		const padded = {
			...evidence,
			excerpt: '  text  '
		};
		const result = EvidenceItemSchema.safeParse(padded);
		expect(result.success).toBe(true);
		// ensuring input is left unchanged
		expect(result.data?.excerpt).toBe('  text  ');
	});

	// findings
	it('rejects a finding with a whitespace-only id', () => {
		const malformed = {
			...finding,
			id: '   '
		};
		const result = FindingSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a finding with a whitespace-only description', () => {
		const malformed = {
			...finding,
			plain_language_description: '   '
		};
		const result = FindingSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a whitespace-only entry in dataCategories', () => {
		const malformed = {
			...finding,
			dataCategories: ['   ']
		};
		const result = FindingSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a whitespace-only entry in purposes', () => {
		const malformed = {
			...finding,
			purposes: ['   ']
		};
		const result = FindingSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a whitespace-only entry in recipients', () => {
		const malformed = {
			...finding,
			recipients: ['   ']
		};
		const result = FindingSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	// takeaways
	it('rejects a takeaway with a whitespace-only id', () => {
		const malformed = {
			...takeaway,
			id: '   '
		};
		const result = TakeawaySchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a takeaway with a whitespace-only topic', () => {
		const malformed = {
			...takeaway,
			topic: '   '
		};
		const result = TakeawaySchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a takeaway with a whitespace-only reason', () => {
		const malformed = {
			...takeaway,
			reason: '   '
		};
		const result = TakeawaySchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a whitespace-only entry in a takeaway findingIds', () => {
		const malformed = {
			...takeaway,
			findingIds: ['   ']
		};
		const result = TakeawaySchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	// Testing result schemas
	it('rejects a success result with a whitespace-only summary', () => {
		const malformed = {
			...successFixture,
			summary: '   '
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a success result with a whitespace-only analysisId', () => {
		const malformed = {
			...successFixture,
			analysisId: '   '
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects an in_progress result with a whitespace-only analysisId', () => {
		const malformed = {
			...InProgressFixture,
			analysisId: '   '
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects an insufficient result with a whitespace-only analysisId', () => {
		const malformed = {
			...InsufficientFixture,
			analysisId: '   '
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects an insufficient result with a whitespace-only reason', () => {
		const malformed = {
			...InsufficientFixture,
			reason: '   '
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a failed result with a whitespace-only analysisId', () => {
		const malformed = {
			...FailureFixture,
			analysisId: '   '
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a failed result with a whitespace-only errorCode', () => {
		const malformed = {
			...FailureFixture,
			errorCode: '   '
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});

	it('rejects a failed result with a whitespace-only message', () => {
		const malformed = {
			...FailureFixture,
			message: '   '
		};
		const result = AnalysisResultSchema.safeParse(malformed);
		expect(result.success).toBe(false);
	});
});

// Scoring fields tests
describe('Finding scoring fields', () => {
	const base = {
		id: 'F1',
		category: 'sharing',
		plain_language_description: 'Shares location with ad partners if personalized ads are on.',
		evidence: [
			{ passageId: 'P1', excerpt: 'We share approximate location with advertising partners.' }
		]
	};

	it('accepts a finding with all scoring fields', () => {
		const result = FindingSchema.safeParse({
			...base,
			effect: 'exposes',
			ambiguous: false,
			conditional: true,
			recipientTypes: ['advertiser'],
			purposeTypes: ['advertising']
		});

		expect(result.success).toBe(true);
	});

	it('still accepts a finding without scoring fields', () => {
		expect(FindingSchema.safeParse(base).success).toBe(true);
	});

	it('rejects unknown effect, recipient, and purpose values', () => {
		expect(FindingSchema.safeParse({ ...base, effect: 'neutral' }).success).toBe(false);
		expect(FindingSchema.safeParse({ ...base, recipientTypes: ['databroker'] }).success).toBe(
			false
		);
		expect(FindingSchema.safeParse({ ...base, purposeTypes: ['marketing'] }).success).toBe(false);
	});

	it('matches the AI consolidation enum values', () => {
		expect(FindingEffectEnum.options).toEqual([...FINDING_EFFECTS]);
		expect(RecipientTypeEnum.options).toEqual([...RECIPIENT_TYPES]);
		expect(PurposeTypeEnum.options).toEqual([...PURPOSE_TYPES]);
	});
});
