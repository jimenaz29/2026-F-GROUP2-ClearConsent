import { z } from 'zod';
import { FindingCategoryEnum, notBlank, type FindingCategory } from './analysis';

// Shapes for personalized risk evaluation (docs/scoring-model.md sect. 5 and 7)

// Saving the version of the scoring rules
export const RULES_VERSION = '1' as const;

// How much a user cares about one concern
export const LevelEnum = z.enum(['acceptable', 'concern', 'major']);

export type Level = z.infer<typeof LevelEnum>;

// Built-in privacy profiles
export const ProfileIdEnum = z.enum(['balanced', 'strict', 'relaxed']);

export type ProfileId = z.infer<typeof ProfileIdEnum>;

// How serious an 'exposes' finding is
export const TierEnum = z.enum(['routine', 'notable', 'serious']);

export type Tier = z.infer<typeof TierEnum>;

// Matching values as the database enum preference_alignment_indicator
export const IndicatorEnum = z.enum(['conflict', 'alignment', 'insufficient_evidence']);

export type Indicator = z.infer<typeof IndicatorEnum>;

// Record keyed by a level for every concern
export const ConcernLevelsSchema = z.record(FindingCategoryEnum, LevelEnum);

export type ConcernLevels = z.infer<typeof ConcernLevelsSchema>;

// Profile table replicated from scoring-model.md Sect. 5
export const BUILT_IN_PROFILES: Record<ProfileId, ConcernLevels> = {
	balanced: {
		collection: 'concern',
		use: 'concern',
		sharing: 'major',
		retention: 'concern',
		user_rights: 'concern',
		security_practices: 'concern'
	},
	strict: {
		collection: 'major',
		use: 'major',
		sharing: 'major',
		retention: 'major',
		user_rights: 'major',
		security_practices: 'major'
	},
	relaxed: {
		collection: 'acceptable',
		use: 'acceptable',
		sharing: 'concern',
		retention: 'acceptable',
		user_rights: 'concern',
		security_practices: 'concern'
	}
};

// Profile saved in privacy_preferences.preferences, detail level in follow-up
export const StoredPreferencesSchema = z.strictObject({
	profile: ProfileIdEnum
});

export type StoredPreferences = z.infer<typeof StoredPreferencesSchema>;

// Snapshot saved in analyses.preference_snapshot
export const PreferenceSnapshotSchema = z.strictObject({
	profile: ProfileIdEnum,
	levels: ConcernLevelsSchema,
	rulesVersion: notBlank('Snapshot requires a rules version')
});

export type PreferenceSnapshot = z.infer<typeof PreferenceSnapshotSchema>;

export function createPreferenceSnapshot(profile: ProfileId): PreferenceSnapshot {
	return {
		profile,
		levels: { ...BUILT_IN_PROFILES[profile] },
		rulesVersion: RULES_VERSION
	};
}

// Indicators per concern
export const PreferenceIndicatorSchema = z
	.strictObject({
		concern: FindingCategoryEnum,
		level: LevelEnum,
		indicator: IndicatorEnum,
		findingId: notBlank('Finding ID cannot be blank').nullable(),
		tier: TierEnum.nullable(),
		explanation: notBlank('Each indicator needs an explanation')
	})
	.superRefine((item, ctx) => {
		const hasFinding = item.findingId !== null;

		// Checks that matches the preference_evaluation database constraint

		// Ensures that a finding points to evidence
		if (item.indicator === 'insufficient_evidence' && hasFinding) {
			ctx.addIssue({
				code: 'custom',
				message: 'Insufficient evidence must not link a finding',
				path: ['findingId']
			});
		}

		// Ensures a conflict or alignment points to a finding
		if (item.indicator !== 'insufficient_evidence' && !hasFinding) {
			ctx.addIssue({
				code: 'custom',
				message: 'Conflict and alignment must link a finding',
				path: ['findingId']
			});
		}

		// Ensures a lack of finding doesn't gain a level of concern
		if (!hasFinding && item.tier !== null) {
			ctx.addIssue({
				code: 'custom',
				message: 'Tier must be null when no finding is linked',
				path: ['tier']
			});
		}

		// Ensures a conflict must be notable or serious
		if (item.indicator === 'conflict' && (item.tier === null || item.tier === 'routine')) {
			ctx.addIssue({
				code: 'custom',
				message: 'A conflict needs a notable or serious tier',
				path: ['tier']
			});
		}
	});

export type PreferenceIndicator = z.infer<typeof PreferenceIndicatorSchema>;

const Count = z.number().int().nonnegative();

// Scorer output shape (sect. 7)
export const PreferenceEvaluationSchema = z
	.strictObject({
		rulesVersion: z.literal(RULES_VERSION),
		profile: z.strictObject({
			id: ProfileIdEnum,
			levels: ConcernLevelsSchema
		}),
		indicators: z
			.array(PreferenceIndicatorSchema)
			.length(FindingCategoryEnum.options.length, 'Exactly one indicator per concern is required'),
		counts: z.strictObject({
			conflict: Count,
			alignment: Count,
			insufficient_evidence: Count
		}),
		needsReview: z.array(
			z.strictObject({
				findingId: notBlank('Review entry requires a finding ID'),
				reason: z.enum(['ambiguous', 'missing_effect'])
			})
		),
		ungrounded: z.array(
			z.strictObject({
				findingId: notBlank('Ungrounded entry requires a finding ID')
			})
		),
		summary: notBlank('Evaluation requires a summary')
	})
	.superRefine((data, ctx) => {
		// every concern must appear once
		const seen = new Set<FindingCategory>();
		data.indicators.forEach((item, i) => {
			if (seen.has(item.concern)) {
				ctx.addIssue({
					code: 'custom',
					message: `Duplicate indicator for "${item.concern}"`,
					path: ['indicators', i, 'concern']
				});
			}

			seen.add(item.concern);

			// Ensure each indicator uses the level matching profile set for concern
			if (item.level !== data.profile.levels[item.concern]) {
				ctx.addIssue({
					code: 'custom',
					message: `Level for "${item.concern}" must match the profile`,
					path: ['indicators', i, 'level']
				});
			}
		});

		// 'Counts' objects must match indicators
		for (const indicator of IndicatorEnum.options) {
			const actual = data.indicators.filter((item) => item.indicator === indicator).length;

			if (data.counts[indicator] !== actual) {
				ctx.addIssue({
					code: 'custom',
					message: `counts.${indicator} is ${data.counts[indicator]} but there are ${actual}`,
					path: ['counts', indicator]
				});
			}
		}
	});

export type PreferenceEvaluation = z.infer<typeof PreferenceEvaluationSchema>;
