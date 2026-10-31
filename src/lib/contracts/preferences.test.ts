import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { FindingCategoryEnum, FindingSchema } from './analysis';
import {
	BUILT_IN_PROFILES,
	ConcernLevelsSchema,
	PreferenceEvaluationSchema,
	PreferenceSnapshotSchema,
	StoredPreferencesSchema,
	createPreferenceSnapshot,
	type PreferenceEvaluation
} from './preferences';
import { fitnessFindings, fitnessBalancedEvaluation } from './scoring-fixtures';

// Testing a valid evaluation with no usable findings (every concern is insufficient_evidence)
function emptyEvaluation(): PreferenceEvaluation {
	const levels = BUILT_IN_PROFILES.balanced;
	return {
		rulesVersion: '1',
		profile: { id: 'balanced', levels },
		indicators: FindingCategoryEnum.options.map((concern) => ({
			concern,
			level: levels[concern],
			indicator: 'insufficient_evidence' as const,
			findingId: null,
			tier: null,
			explanation: `Not enough evidence: the policy doesn't clearly describe ${concern}.`
		})),
		counts: { conflict: 0, alignment: 0, insufficient_evidence: 6 },
		needsReview: [],
		ungrounded: [],
		summary: 'Not enough evidence to compare this policy with your preferences.'
	};
}

// Same evaluation with the first concern changed to a serious conflict
function withConflict(): PreferenceEvaluation {
	const evaluation = emptyEvaluation();
	evaluation.indicators[0] = {
		...evaluation.indicators[0],
		indicator: 'conflict',
		findingId: 'F1',
		tier: 'serious',
		explanation: 'Conflict: the policy collects data you marked as a concern.'
	};
	evaluation.counts = { conflict: 1, alignment: 0, insufficient_evidence: 5 };
	return evaluation;
}

// Test block for the created profiles
describe('stored preferences', () => {
	it('accepts a built-in profile', () => {
		expect(StoredPreferencesSchema.safeParse({ profile: 'balanced' }).success).toBe(true);
	});

	it('rejects a detail level used as a profile', () => {
		expect(StoredPreferencesSchema.safeParse({ profile: 'quick' }).success).toBe(false);
	});

	it('rejects extra field (detail level) as a built-in component for a profile', () => {
		const result = StoredPreferencesSchema.safeParse({ profile: 'balanced', detail: 'quick' });
		expect(result.success).toBe(false);
	});
});

describe('concern levels', () => {
	it('accepts every built-in profile', () => {
		for (const levels of Object.values(BUILT_IN_PROFILES)) {
			expect(ConcernLevelsSchema.safeParse(levels).success).toBe(true);
		}
	});

	it('rejects levels missing a concern', () => {
		const levels: Record<string, string> = { ...BUILT_IN_PROFILES.balanced };
		delete levels.retention;
		expect(ConcernLevelsSchema.safeParse(levels).success).toBe(false);
	});

	it('rejects an unknown concern', () => {
		const levels = { ...BUILT_IN_PROFILES.balanced, advertising: 'major' };

		expect(ConcernLevelsSchema.safeParse(levels).success).toBe(false);
	});
});

describe('preference snapshot', () => {
	it('builds a valid snapshot that copies the profile levels', () => {
		const snapshot = createPreferenceSnapshot('strict');
		expect(PreferenceSnapshotSchema.safeParse(snapshot).success).toBe(true);
		expect(snapshot.levels).toEqual(BUILT_IN_PROFILES.strict);
		expect(snapshot.levels).not.toBe(BUILT_IN_PROFILES.strict);
	});

	it('keeps an older snapshot valid even if its levels differ from current profile', () => {
		const snapshot = {
			...createPreferenceSnapshot('balanced'),
			levels: {
				...BUILT_IN_PROFILES.balanced,
				sharing: 'concern'
			}
		};
		expect(PreferenceSnapshotSchema.safeParse(snapshot).success).toBe(true);
	});
});

describe('preference evaluation', () => {
	it('accepts an evaluation with no usable findings', () => {
		expect(PreferenceEvaluationSchema.safeParse(emptyEvaluation()).success).toBe(true);
	});

	it('accepts a conflict that links a finding and a tier', () => {
		expect(PreferenceEvaluationSchema.safeParse(withConflict()).success).toBe(true);
	});

	it('rejects fewer than six indicators', () => {
		const evaluation = emptyEvaluation();
		evaluation.indicators.pop();
		evaluation.counts.insufficient_evidence = 5;
		expect(PreferenceEvaluationSchema.safeParse(evaluation).success).toBe(false);
	});

	it('rejects a duplicate concern', () => {
		const evaluation = emptyEvaluation();
		evaluation.indicators[1] = {
			...evaluation.indicators[0]
		};
		expect(PreferenceEvaluationSchema.safeParse(evaluation).success).toBe(false);
	});

	it('rejects insufficient evidence that links a finding', () => {
		const evaluation = emptyEvaluation();
		evaluation.indicators[0] = {
			...evaluation.indicators[0],
			findingId: 'F1'
		};
		expect(PreferenceEvaluationSchema.safeParse(evaluation).success).toBe(false);
	});

	it('rejects a conflict without a finding', () => {
		const evaluation = withConflict();
		evaluation.indicators[0] = {
			...evaluation.indicators[0],
			findingId: null,
			tier: null
		};
		expect(PreferenceEvaluationSchema.safeParse(evaluation).success).toBe(false);
	});

	it('rejects a routine conflict', () => {
		const evaluation = withConflict();
		evaluation.indicators[0] = {
			...evaluation.indicators[0],
			tier: 'routine'
		};
		expect(PreferenceEvaluationSchema.safeParse(evaluation).success).toBe(false);
	});

	it('rejects counts that do not match the indicators', () => {
		const evaluation = withConflict();
		evaluation.counts = { conflict: 0, alignment: 0, insufficient_evidence: 6 };
		expect(PreferenceEvaluationSchema.safeParse(evaluation).success).toBe(false);
	});

	it('rejects a level that differs from the profile', () => {
		const evaluation = emptyEvaluation();
		evaluation.indicators[0] = {
			...evaluation.indicators[0],
			level: 'acceptable'
		};
		expect(PreferenceEvaluationSchema.safeParse(evaluation).success).toBe(false);
	});
});

describe('sect.8 fitness example', () => {
	it('has six valid findings', () => {
		expect(z.array(FindingSchema).length(6).safeParse(fitnessFindings).success).toBe(true);
	});

	it('has a valid Balanced evaluation', () => {
		expect(PreferenceEvaluationSchema.safeParse(fitnessBalancedEvaluation).success).toBe(true);
	});

	it('only references findings that exist', () => {
		const ids = new Set(fitnessFindings.map((finding) => finding.id));
		const referenced = [
			...fitnessBalancedEvaluation.indicators.map((item) => item.findingId),
			...fitnessBalancedEvaluation.needsReview.map((item) => item.findingId)
		].filter((id) => id !== null);

		for (const id of referenced) {
			expect(ids.has(id)).toBe(true);
		}
	});
});
