export interface TotpSecret {
  secret: string;
  otpauthUrl: string;
}

/** Port TOTP (segundo fator). Infra implementa com otplib. */
export interface TotpVerifier {
  verify(secret: string, code: string): boolean;
  generateSecret(account: string): TotpSecret;
}
