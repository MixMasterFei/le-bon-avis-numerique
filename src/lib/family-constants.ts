/**
 * Family-profile caps — single source of truth, so the limits can be pinned by
 * the expectations registry and stay consistent across every write path.
 *
 *  • MAX_FAMILY_MEMBERS — profiles a single account may create.
 *  • MAX_FAMILY_INTERESTS — interests stored per member (extra entries are
 *    truncated server-side on save).
 */
export const MAX_FAMILY_MEMBERS = 10
export const MAX_FAMILY_INTERESTS = 20
