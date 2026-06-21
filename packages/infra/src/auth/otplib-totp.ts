import type { TotpVerifier } from '@wolfkrow/domain';
import { authenticator } from 'otplib';


/**
 * TotpVerifier via otplib (RFC 6238). Implementa o port do domínio.
 * authenticator usa SHA-1/30s/6 dígitos (padrão Google Authenticator).
 */
export class OtplibTotp implements TotpVerifier {
  verify(secret: string, code: string): boolean {
    return authenticator.check(code, secret);
  }

  generateSecret(account: string) {
    const secret = authenticator.generateSecret();
    return {
      secret,
      otpauthUrl: authenticator.keyuri(account, 'Wolfkrow', secret),
    };
  }
}
