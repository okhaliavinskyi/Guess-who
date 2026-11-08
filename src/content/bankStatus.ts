/**
 * Whether the character bank is the demo fixture set or curated production content.
 *
 * The content-fill session flips this to 'production' once the bank in
 * src/content/characters/*.json has been replaced (see CONTENT_BANK_HANDOFF.md).
 * While 'demo', the UI shows a "Demo content" label and the validator warns.
 */
export const BANK_STATUS: 'demo' | 'production' = 'demo';
