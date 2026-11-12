declare module '@hookform/error-message' {
  export function errorMessage(errors: Record<string, any>, name: string, opts?: any): string | undefined
  export const ErrorMessage: typeof errorMessage
  export default errorMessage
}
