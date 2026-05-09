"use client"

import React from "react"

interface State {
  caught: { message: string; stack: string; componentStack: string } | null
}

/**
 * Class-component error boundary specifically for tracking down the
 * React #418 hydration mismatch on /apercudecouverte-v3. Wraps the
 * V3 page tree; when React throws during hydration, componentDidCatch
 * receives the error AND a componentStack listing every parent
 * component (file name + line, when source maps are available).
 *
 * The boundary renders a visible red banner with the captured info so
 * we can read the stack without DevTools, plus dumps to console.error
 * with formatting for copy/paste.
 *
 * Temporary debugging aid. Remove once the V3 hydration bug is fixed.
 */
export class HydrationDebugBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { caught: null }
  }

  static getDerivedStateFromError(): null {
    // Don't replace UI on first error — let React try to recover via
    // hydration regen. We only want to RECORD the stack, not block
    // the page.
    return null
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const componentStack = (info?.componentStack ?? "").trim()
    // Surface the captured info in the most copyable way possible —
    // both as a red console banner and as state we render at the top
    // of the page.
    console.error(
      "%c[HYDRATION DEBUG BOUNDARY]",
      "background:#ff0000;color:#fff;padding:4px 8px;font-weight:bold;font-size:14px",
      "\n\nMessage:",
      error.message,
      "\n\nComponent stack:",
      componentStack,
      "\n\nError stack:",
      error.stack,
    )
    this.setState({
      caught: {
        message: error.message,
        stack: error.stack ?? "",
        componentStack,
      },
    })
  }

  render() {
    return (
      <>
        {this.state.caught && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 99999,
              background: "#ff0000",
              color: "#fff",
              padding: "12px 16px",
              fontFamily: "monospace",
              fontSize: "12px",
              maxHeight: "50vh",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            <strong style={{ fontSize: "14px" }}>
              [HYDRATION DEBUG] {this.state.caught.message}
            </strong>
            {"\n\nComponent stack:\n"}
            {this.state.caught.componentStack || "(no component stack)"}
            {"\n\nError stack:\n"}
            {this.state.caught.stack || "(no error stack)"}
          </div>
        )}
        {this.props.children}
      </>
    )
  }
}
