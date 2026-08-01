import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Hakim Plus interface error", { name: error?.name, componentStack: info?.componentStack });
  }

  render() {
    if (this.state.failed) {
      return <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center"><div className="max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5"><p className="text-sm font-bold text-red-700">Something went wrong</p><h1 className="mt-3 text-2xl font-bold">This page could not be displayed</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your request was not submitted again. Refresh once, or return to the Hakim Plus home page.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><button className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white" type="button" onClick={() => window.location.reload()}>Refresh page</button><a className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700" href="/">Return home</a></div></div></main>;
    }
    return this.props.children;
  }
}

