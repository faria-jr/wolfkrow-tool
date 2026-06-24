/**
 * POST /api/auth/setup — RegisterUseCase (onboarding wizard: cria owner).
 * Falha 409 se owner já existe. Password validado em força (PlainPassword).
 */

import {
  ConflictError,
  PlainPassword,
  type ValidationError as ValidationErrorType,
} from '@wolfkrow/domain';
import { SetupRequestBodySchema } from '@wolfkrow/shared-types';
import { RegisterUseCase } from '@wolfkrow/use-cases';

import { getAdapters, getRepos } from '@/lib/container';
import { validateBody } from '@/lib/validation';

export async function POST(request: Request) {
  const body = validateBody(SetupRequestBodySchema, await request.json().catch(() => null));
  if (body instanceof Response) return body;

  let password: PlainPassword;
  try {
    password = PlainPassword.create(body.password);
  } catch (error) {
    const msg = (error as ValidationErrorType).message ?? 'Invalid password';
    return Response.json({ error: msg }, { status: 400 });
  }

  const register = new RegisterUseCase(getRepos().user, getAdapters().hasher);
  try {
    const out = await register.execute({
      password,
      displayName: body.displayName,
      email: body.email,
    });
    return Response.json({ userId: out.userId }, { status: 201 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return Response.json({ error: 'Owner already exists' }, { status: 409 });
    }
    throw error;
  }
}
