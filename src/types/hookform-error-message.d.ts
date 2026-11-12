import { ComponentType } from 'react'

declare module '@hookform/error-message' {
  export interface ErrorMessageProps {
    errors: Record<string, any>
    name: string
    render: (props: { message: string }) => React.ReactNode
  }
  export const ErrorMessage: ComponentType<ErrorMessageProps>
  export default ErrorMessage
}
