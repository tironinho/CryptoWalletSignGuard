/**
 * V2: Seed data for lists (trusted/blocked domains). Short bootstrap — external feeds cover volume.
 */

import { CRYPTO_TRUSTED_DOMAINS_SEED } from "../lists/cryptoTrustedDomainsSeed";

export const TRUSTED_DOMAINS_SEED: string[] = [...CRYPTO_TRUSTED_DOMAINS_SEED];

export const BLOCKED_DOMAINS_SEED: string[] = [
  // Minimal seed; feeds will add more
];
