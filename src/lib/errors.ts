export type AuthCode = 'UNAUTHORIZED' | 'FORBIDDEN'

export class AuthError extends Error {
  readonly status: number
  constructor(public readonly code: AuthCode) {
    super(code)
    this.status = code === 'UNAUTHORIZED' ? 401 : 403
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly extra?: Record<string, unknown>
  ) {
    super(code)
  }
}
