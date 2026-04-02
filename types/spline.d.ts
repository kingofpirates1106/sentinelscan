declare module '@splinetool/react-spline' {
  import { Component } from 'react'

  interface SplineProps {
    scene: string
    className?: string
    onLoad?: () => void
    onError?: () => void
  }

  export default class Spline extends Component<SplineProps> {}
}

