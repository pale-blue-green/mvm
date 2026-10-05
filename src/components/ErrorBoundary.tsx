import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; resetKey?: string };
type State = { message: string | null };

/** 描画中の例外でアプリ全体が空にならないよう、表示領域だけを置き換える */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.message !== null) this.setState({ message: null });
  }

  render() {
    if (this.state.message !== null) {
      return <p className="p-8 text-red-600 dark:text-red-400">{`表示中にエラーが発生しました: ${this.state.message}`}</p>;
    }
    return this.props.children;
  }
}
