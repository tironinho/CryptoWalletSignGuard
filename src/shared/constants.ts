import { CRYPTO_TRUSTED_DOMAINS_SEED } from "../lists/cryptoTrustedDomainsSeed";

export const SUGGESTED_TRUSTED_DOMAINS = CRYPTO_TRUSTED_DOMAINS_SEED.slice(0, 24) as unknown as readonly string[];

