import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                hasError: false,
                error: null,
            }
        });
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '2rem',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                }, children: [_jsx("h1", { style: { fontSize: '2rem', marginBottom: '1rem', color: '#ef4444' }, children: "Something went wrong" }), _jsxs("div", { style: {
                            maxWidth: '600px',
                            padding: '1.5rem',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                        }, children: [_jsx("p", { style: { marginBottom: '1rem', fontWeight: 'bold' }, children: "Error details:" }), _jsx("pre", { style: {
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    fontSize: '0.875rem',
                                    color: '#1f2937',
                                }, children: this.state.error?.message || 'Unknown error' }), this.state.error?.stack && (_jsxs("details", { style: { marginTop: '1rem' }, children: [_jsx("summary", { style: { cursor: 'pointer', color: '#6b7280' }, children: "Stack trace" }), _jsx("pre", { style: {
                                            marginTop: '0.5rem',
                                            fontSize: '0.75rem',
                                            color: '#6b7280',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                        }, children: this.state.error.stack })] }))] }), _jsx("button", { onClick: () => window.location.reload(), style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                        }, children: "Reload Page" })] }));
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
