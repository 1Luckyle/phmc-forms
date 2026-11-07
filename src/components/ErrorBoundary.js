import React, { Component } from 'react';
import * as Sentry from "@sentry/react";
import { isChunkLoadError, reloadOnceForNewVersion } from '../utils/chunkReload';

const notificationStyle = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '15px',
    backgroundColor: '#f85149', // A strong error color
    color: 'white',
    borderRadius: '5px',
    zIndex: 9999, // Ensure it's on top of everything
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
};

const iconStyle = {
    fontSize: '1.5em'
};

const buttonStyle = {
    backgroundColor: 'transparent',
    color: 'white',
    border: '1px solid white',
    borderRadius: '3px',
    padding: '5px 10px',
    cursor: 'pointer',
    fontWeight: 'bold'
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Nouvelle version déployée pendant que la page était ouverte : on recharge, sans alerter Sentry.
    if (isChunkLoadError(error) && reloadOnceForNewVersion()) return;
    Sentry.captureException(error, { extra: errorInfo });
  }

  handleOkClick = () => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError && isChunkLoadError(this.state.error)) {
      return (
        <div style={notificationStyle}>
          <div style={iconStyle}><i className="fas fa-sync-alt"></i></div>
          <span>Une nouvelle version du site est disponible. Rechargez la page pour continuer.</span>
          <button onClick={this.handleOkClick} style={buttonStyle}>Recharger</button>
        </div>
      );
    }
    if (this.state.hasError) {
      return (
        <>
          <div style={notificationStyle}>
            <div style={iconStyle}>
                <i className="fas fa-exclamation-triangle"></i>
            </div>
            <span>ERREUR FATALE ! Veuillez contacter Luckyle sur le Discord de PHMC ou signaler le bug !</span>
            <button onClick={this.handleOkClick} style={buttonStyle}>OK</button>
          </div>
          {/* We still render the children to keep the UI visible */}
          {this.props.children}
        </>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
