import React from 'react';
import './ServiceUnavailable.css';

const ServiceUnavailable = () => {
  return (
    <div className="service-unavailable-bg">
      <div className="service-unavailable-card">
        <h1>Service Indisponible</h1>
        <h2>
          À la demande de la direction de GTAW, ce site est actuellement indisponible.<br />
          Nous sommes en cours de migration vers les serveurs officiels de GTAW.
        </h2>
        <div className="service-unavailable-emoji" role="img" aria-label="Sad face">😞</div>
        <div className="service-unavailable-footer">
          &copy; {new Date().getFullYear()} PHMC-FR Tools &mdash; Merci de votre patience.
        </div>
      </div>
    </div>
  );
};

export default ServiceUnavailable;
