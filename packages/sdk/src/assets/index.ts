export type AssetMappingNetwork = "testnet" | "mainnet";

export interface CanonicalStellarAsset {
  code: string;
  issuer?: string;
}

export interface CanonicalSolanaAsset {
  /** SPL token mint address, or NATIVE_SOL_MINT for native SOL. */
  mint: string;
  symbol: string;
}

export const NATIVE_ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
export const NATIVE_STELLAR_ASSET: CanonicalStellarAsset = { code: "XLM" };
export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
export const NATIVE_SOL_ASSET: CanonicalSolanaAsset = { mint: NATIVE_SOL_MINT, symbol: "SOL" };

// ── Error type ────────────────────────────────────────────────────────────

/**
 * Thrown by the strict assertion helpers when an asset has no known mapping
 * on the requested network.  Use the corresponding `isSupportedX()` guard to
 * check before calling into `resolveStellarAsset` / `resolveSolanaAsset` etc.
 * when you want a hard failure instead of the lenient fallback behaviour.
 */
export class UnsupportedAssetError extends Error {
  constructor(
    /** The unrecognised asset identifier (Ethereum address, Stellar key, or Solana mint). */
    public readonly asset: string,
    /** The network on which the mapping was requested. */
    public readonly network: AssetMappingNetwork,
    /** Human-readable description of the direction, e.g. "eth→stellar". */
    public readonly direction: string,
  ) {
    super(`Unsupported asset "${asset}" for ${direction} mapping on ${network}`);
    this.name = "UnsupportedAssetError";
  }
}

// ── Static mapping tables ─────────────────────────────────────────────────

const TESTNET_ETH_TO_STELLAR: Record<string, CanonicalStellarAsset> = {
  [NATIVE_ETH_ADDRESS]: NATIVE_STELLAR_ASSET,
  "0xa0b86a33e6417c4fd30ad9d05d6b9b7cd6dd11b": {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  },
};

const TESTNET_STELLAR_TO_ETH: Record<string, string> = {
  XLM: NATIVE_ETH_ADDRESS,
  "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5":
    "0xa0b86a33e6417c4fd30ad9d05d6b9b7cd6dd11b",
};

const MAINNET_ETH_TO_STELLAR: Record<string, CanonicalStellarAsset> = {
  [NATIVE_ETH_ADDRESS]: NATIVE_STELLAR_ASSET,
};

const MAINNET_STELLAR_TO_ETH: Record<string, string> = {
  XLM: NATIVE_ETH_ADDRESS,
};

const MAPPINGS: Record<AssetMappingNetwork, {
  ethToStellar: Record<string, CanonicalStellarAsset>;
  stellarToEth: Record<string, string>;
}> = {
  testnet: {
    ethToStellar: TESTNET_ETH_TO_STELLAR,
    stellarToEth: TESTNET_STELLAR_TO_ETH,
  },
  mainnet: {
    ethToStellar: MAINNET_ETH_TO_STELLAR,
    stellarToEth: MAINNET_STELLAR_TO_ETH,
  },
};

const TESTNET_ETH_TO_SOLANA: Record<string, CanonicalSolanaAsset> = {
  [NATIVE_ETH_ADDRESS]: NATIVE_SOL_ASSET,
  // USDC on devnet
  "0xa0b86a33e6417c4fd30ad9d05d6b9b7cd6dd11b": {
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    symbol: "USDC",
  },
};

const TESTNET_SOLANA_TO_ETH: Record<string, string> = {
  [NATIVE_SOL_MINT]: NATIVE_ETH_ADDRESS,
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": "0xa0b86a33e6417c4fd30ad9d05d6b9b7cd6dd11b",
};

const MAINNET_ETH_TO_SOLANA: Record<string, CanonicalSolanaAsset> = {
  [NATIVE_ETH_ADDRESS]: NATIVE_SOL_ASSET,
};

const MAINNET_SOLANA_TO_ETH: Record<string, string> = {
  [NATIVE_SOL_MINT]: NATIVE_ETH_ADDRESS,
};

const SOLANA_MAPPINGS: Record<AssetMappingNetwork, {
  ethToSolana: Record<string, CanonicalSolanaAsset>;
  solanaToEth: Record<string, string>;
}> = {
  testnet: { ethToSolana: TESTNET_ETH_TO_SOLANA, solanaToEth: TESTNET_SOLANA_TO_ETH },
  mainnet: { ethToSolana: MAINNET_ETH_TO_SOLANA, solanaToEth: MAINNET_SOLANA_TO_ETH },
};

// ── Normalization helpers ─────────────────────────────────────────────────

/**
 * Normalise an Ethereum token address to lowercase with no surrounding
 * whitespace.  All internal lookups use this canonical form; call it before
 * comparing two Ethereum addresses or constructing a mapping key.
 */
export function normalizeEthereumAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Produce the canonical string key for a Stellar asset:
 *   - Native XLM    →  `"XLM"`
 *   - Issued asset  →  `"CODE:ISSUER"`
 *
 * Accepts either a {@link CanonicalStellarAsset} object (as returned by
 * `resolveStellarAsset`) or a pre-formatted string key.  Leading/trailing
 * whitespace is stripped from string inputs.
 */
export function normalizeStellarAssetKey(asset: string | CanonicalStellarAsset): string {
  if (typeof asset === "string") {
    return asset.trim();
  }
  return asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code;
}

/**
 * Normalise a Solana mint address by trimming surrounding whitespace.
 * Solana base58 addresses are case-sensitive so no case folding is applied.
 */
export function normalizeSolanaMint(mint: string): string {
  return mint.trim();
}

// ── Boolean support guards ────────────────────────────────────────────────

/**
 * Return `true` if `ethereumTokenAddress` has a known eth→stellar mapping
 * on `network`.  Mixed-case and padded addresses are accepted.
 */
export function isSupportedEthToStellar(
  ethereumTokenAddress: string,
  network: AssetMappingNetwork = "testnet",
): boolean {
  const normalized = normalizeEthereumAddress(ethereumTokenAddress);
  return normalized in (MAPPINGS[network]?.ethToStellar ?? MAPPINGS.testnet.ethToStellar);
}

/**
 * Return `true` if `stellarAsset` has a known stellar→eth mapping on
 * `network`.  Accepts both object and string-key forms.
 */
export function isSupportedStellarToEth(
  stellarAsset: string | CanonicalStellarAsset,
  network: AssetMappingNetwork = "testnet",
): boolean {
  const key = normalizeStellarAssetKey(stellarAsset);
  return key in (MAPPINGS[network]?.stellarToEth ?? MAPPINGS.testnet.stellarToEth);
}

/**
 * Return `true` if `ethereumTokenAddress` has a known eth→solana mapping
 * on `network`.  Mixed-case and padded addresses are accepted.
 */
export function isSupportedEthToSolana(
  ethereumTokenAddress: string,
  network: AssetMappingNetwork = "testnet",
): boolean {
  const normalized = normalizeEthereumAddress(ethereumTokenAddress);
  return normalized in SOLANA_MAPPINGS[network].ethToSolana;
}

/**
 * Return `true` if `mint` has a known solana→eth mapping on `network`.
 * Leading/trailing whitespace is stripped before lookup.
 */
export function isSupportedSolanaToEth(
  mint: string,
  network: AssetMappingNetwork = "testnet",
): boolean {
  return normalizeSolanaMint(mint) in SOLANA_MAPPINGS[network].solanaToEth;
}

// ── Assertion (throwing) guards ───────────────────────────────────────────

/**
 * Assert that `ethereumTokenAddress` maps to a known Stellar asset on
 * `network`.  Throws {@link UnsupportedAssetError} if not.
 *
 * Use this before calling `resolveStellarAsset` when you want a hard failure
 * instead of a silent fallback to native XLM.
 */
export function assertSupportedEthToStellar(
  ethereumTokenAddress: string,
  network: AssetMappingNetwork = "testnet",
): void {
  if (!isSupportedEthToStellar(ethereumTokenAddress, network)) {
    throw new UnsupportedAssetError(
      normalizeEthereumAddress(ethereumTokenAddress),
      network,
      "eth→stellar",
    );
  }
}

/**
 * Assert that `stellarAsset` maps to a known Ethereum token on `network`.
 * Throws {@link UnsupportedAssetError} if not.
 */
export function assertSupportedStellarToEth(
  stellarAsset: string | CanonicalStellarAsset,
  network: AssetMappingNetwork = "testnet",
): void {
  if (!isSupportedStellarToEth(stellarAsset, network)) {
    throw new UnsupportedAssetError(
      normalizeStellarAssetKey(stellarAsset),
      network,
      "stellar→eth",
    );
  }
}

/**
 * Assert that `ethereumTokenAddress` maps to a known Solana mint on
 * `network`.  Throws {@link UnsupportedAssetError} if not.
 */
export function assertSupportedEthToSolana(
  ethereumTokenAddress: string,
  network: AssetMappingNetwork = "testnet",
): void {
  if (!isSupportedEthToSolana(ethereumTokenAddress, network)) {
    throw new UnsupportedAssetError(
      normalizeEthereumAddress(ethereumTokenAddress),
      network,
      "eth→solana",
    );
  }
}

/**
 * Assert that `mint` maps to a known Ethereum token on `network`.
 * Throws {@link UnsupportedAssetError} if not.
 */
export function assertSupportedSolanaToEth(
  mint: string,
  network: AssetMappingNetwork = "testnet",
): void {
  if (!isSupportedSolanaToEth(mint, network)) {
    throw new UnsupportedAssetError(normalizeSolanaMint(mint), network, "solana→eth");
  }
}

// ── Discovery helpers ─────────────────────────────────────────────────────

/**
 * Return all Ethereum token addresses that have a mapping on `network` for
 * the given `direction`.  Useful for building UI token pickers or
 * pre-validating user input before calling a `resolve*` function.
 */
export function getSupportedEthereumAddresses(
  direction: "stellar" | "solana",
  network: AssetMappingNetwork = "testnet",
): string[] {
  if (direction === "stellar") {
    return Object.keys(MAPPINGS[network]?.ethToStellar ?? MAPPINGS.testnet.ethToStellar);
  }
  return Object.keys(SOLANA_MAPPINGS[network].ethToSolana);
}

/**
 * Return all Stellar asset keys (`"XLM"` or `"CODE:ISSUER"`) that have a
 * mapping to an Ethereum token on `network`.
 */
export function getSupportedStellarAssets(
  network: AssetMappingNetwork = "testnet",
): string[] {
  return Object.keys(MAPPINGS[network]?.stellarToEth ?? MAPPINGS.testnet.stellarToEth);
}

/**
 * Return all Solana mint addresses that have a mapping to an Ethereum token
 * on `network`.
 */
export function getSupportedSolanaMints(
  network: AssetMappingNetwork = "testnet",
): string[] {
  return Object.keys(SOLANA_MAPPINGS[network].solanaToEth);
}

// ── Lenient resolvers (original API — silent fallback behaviour) ──────────

export function resolveStellarAsset(
  ethereumTokenAddress: string,
  network: AssetMappingNetwork = "testnet",
): CanonicalStellarAsset {
  const normalized = normalizeEthereumAddress(ethereumTokenAddress);
  const mapping = MAPPINGS[network]?.ethToStellar ?? MAPPINGS.testnet.ethToStellar;
  return mapping[normalized] ?? NATIVE_STELLAR_ASSET;
}

export function resolveEthereumToken(
  stellarAsset: string | CanonicalStellarAsset,
  network: AssetMappingNetwork = "testnet",
): string {
  const key = normalizeStellarAssetKey(stellarAsset);
  const mapping = MAPPINGS[network]?.stellarToEth ?? MAPPINGS.testnet.stellarToEth;
  return mapping[key] ?? NATIVE_ETH_ADDRESS;
}

export function resolveSolanaAsset(
  ethereumTokenAddress: string,
  network: AssetMappingNetwork = "testnet",
): CanonicalSolanaAsset {
  const normalized = normalizeEthereumAddress(ethereumTokenAddress);
  return SOLANA_MAPPINGS[network].ethToSolana[normalized] ?? NATIVE_SOL_ASSET;
}

export function resolveEthereumTokenFromSolana(
  mint: string,
  network: AssetMappingNetwork = "testnet",
): string {
  return SOLANA_MAPPINGS[network].solanaToEth[normalizeSolanaMint(mint)] ?? NATIVE_ETH_ADDRESS;
}
