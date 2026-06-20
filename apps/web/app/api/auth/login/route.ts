// Placeholder login endpoint — será substituído pelo use-case real na Fase 4
// Schema: POST /api/auth/login { password: string } → { success: true, requiresTotp?: boolean }
// TODO: Implementar AuthenticateUser + SetSessionCookie

interface LoginBody {
  password: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;

    if (!body.password || body.password.length < 1) {
      return Response.json({ error: 'Password is required' }, { status: 400 });
    }

    // Placeholder: aceita qualquer password >= 8 chars
    if (body.password.length < 8) {
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }

    // TODO: set HttpOnly cookie with JWT
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
