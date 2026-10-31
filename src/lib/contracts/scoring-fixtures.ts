import type { Finding } from './analysis';
import { BUILT_IN_PROFILES, type PreferenceEvaluation } from './preferences';

// docs/scoring-model.md sect. 8 fitness app policy findings A-F
// where each finding exercises a different scoring rule
export const fitnessFindings: Finding[] = [
	// routine: sharing with a payment processor to complete a purchase never conflicts (sect. 4)
	{
		id: 'A',
		category: 'sharing',
		plain_language_description:
			'Card numbers are shared with a payment processor to complete purchases.',
		dataCategories: ['Payment card number'],
		purposes: ['Completing purchases'],
		recipients: ['Payment processor'],
		evidence: [
			{
				passageId: 'P1',
				excerpt: 'We share your card number with our payment processor to complete purchases.'
			}
		],
		effect: 'exposes',
		ambiguous: false,
		conditional: false,
		recipientTypes: ['service_provider'],
		purposeTypes: ['service']
	},
	// conditional example: advertising is serious but opt-in option drops the finding to notable (sect. 4)
	{
		id: 'B',
		category: 'sharing',
		plain_language_description:
			'Location is shared with ad partners, but only if personalized ads are turned on.',
		dataCategories: ['Location data'],
		purposes: ['Personalized advertising'],
		recipients: ['Advertising partners'],
		evidence: [
			{
				passageId: 'P2',
				excerpt:
					'If you turn on personalized ads, we share your location with our advertising partners.'
			}
		],
		effect: 'exposes',
		ambiguous: false,
		conditional: true,
		recipientTypes: ['advertiser'],
		purposeTypes: ['advertising']
	},
	// missing right: category is user_rights, but effect is 'exposes', so it is serious (sect. 3&4)
	{
		id: 'C',
		category: 'user_rights',
		plain_language_description: 'Users cannot delete their workout history.',
		dataCategories: ['Workout history'],
		purposes: [],
		recipients: [],
		evidence: [
			{
				passageId: 'P3',
				excerpt: 'Workout history cannot be deleted once recorded.'
			}
		],
		effect: 'exposes',
		ambiguous: false,
		conditional: false,
		recipientTypes: [],
		purposeTypes: []
	},
	// protection: protects findings get no tier and support alignment (sect. 6)
	{
		id: 'D',
		category: 'security_practices',
		plain_language_description: 'Data is encrypted while it is sent.',
		dataCategories: [],
		purposes: [],
		recipients: [],
		evidence: [
			{
				passageId: 'P4',
				excerpt: 'We encrypt all data in transit.'
			}
		],
		effect: 'protects',
		ambiguous: false,
		conditional: false,
		recipientTypes: [],
		purposeTypes: []
	},
	// ambiguous: unclear text goes to needsReview and is not used (sect. 3)
	{
		id: 'E',
		category: 'retention',
		plain_language_description: 'Messages are kept for an unclear length of time.',
		dataCategories: ['Messages'],
		purposes: [],
		recipients: [],
		evidence: [
			{
				passageId: 'P5',
				excerpt: 'We keep your messages as long as necessary.'
			}
		],
		effect: 'exposes',
		ambiguous: true,
		conditional: false,
		recipientTypes: [],
		purposeTypes: []
	},
	// routine: collecting an email to create an account never conflicts (sect. 4)
	{
		id: 'F',
		category: 'collection',
		plain_language_description: 'Email is collected to create an account.',
		dataCategories: ['Email address'],
		purposes: ['Creating an account'],
		recipients: [],
		evidence: [
			{
				passageId: 'P6',
				excerpt: 'We collect your email address to create your account.'
			}
		],
		effect: 'exposes',
		ambiguous: false,
		conditional: false,
		recipientTypes: [],
		purposeTypes: ['service']
	}
];

// sect. 8 expected result for the Balanced profile
export const fitnessBalancedEvaluation: PreferenceEvaluation = {
	rulesVersion: '1',
	profile: {
		id: 'balanced',
		levels: BUILT_IN_PROFILES.balanced
	},
	indicators: [
		{
			concern: 'user_rights',
			level: 'concern',
			indicator: 'conflict',
			findingId: 'C',
			tier: 'serious',
			explanation:
				'Conflict: you marked user rights as a concern. The policy says you cannot delete your workout history.'
		},
		{
			concern: 'sharing',
			level: 'major',
			indicator: 'conflict',
			findingId: 'B',
			tier: 'notable',
			explanation:
				'Conflict: you marked sharing as a major concern. The policy shares your location with ad partners if personalized ads are on.'
		},
		{
			concern: 'use',
			level: 'concern',
			indicator: 'insufficient_evidence',
			findingId: null,
			tier: null,
			explanation: "Not enough evidence: the policy doesn't clearly describe how it uses your data."
		},
		{
			concern: 'retention',
			level: 'concern',
			indicator: 'insufficient_evidence',
			findingId: null,
			tier: null,
			explanation:
				"Not enough evidence: the policy doesn't clearly describe how long it keeps your data."
		},
		{
			concern: 'collection',
			level: 'concern',
			indicator: 'alignment',
			findingId: 'F',
			tier: 'routine',
			explanation:
				'Alignment: the policy collects your email to create an account, which is within your preferences.'
		},
		{
			concern: 'security_practices',
			level: 'concern',
			indicator: 'alignment',
			findingId: 'D',
			tier: null,
			explanation: 'Alignment: the policy encrypts your data while it is sent.'
		}
	],
	counts: {
		conflict: 2,
		alignment: 2,
		insufficient_evidence: 2
	},
	needsReview: [
		{
			findingId: 'E',
			reason: 'ambiguous'
		}
	],
	ungrounded: [],
	summary:
		'2 conflicts with your preferences. Most important: you cannot delete your workout history (user rights).'
};
