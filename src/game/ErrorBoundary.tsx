import { Component, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback: ReactNode | ((error: Error) => ReactNode)
}

type State = {
  error: Error | null
}

// Shows a fallback instead of a white screen when something below it crashes.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { fallback } = this.props
    return typeof fallback === 'function' ? fallback(error) : fallback
  }
}