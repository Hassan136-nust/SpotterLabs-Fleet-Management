import React from 'react';
import {
  FiMap,
  FiPlay,
  FiTrendingUp,
  FiActivity,
  FiClock,
  FiShield,
  FiArrowRight,
  FiGlobe,
  FiGithub,
  FiDroplet
} from 'react-icons/fi';
import './Dashboard.css'; // Reuse homepage styles

const Homepage = ({ onTabChange }) => {
  return (
    <div className="dashboard-root-layout-no-sidebar">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <div className="navbar-container">
          <div className="navbar-logo">
            <span className="logo-text">Spotter.ai</span>
          </div>

          <div className="navbar-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#documentation">Documentation</a>
            <a href="#contact">Contact</a>
          </div>

          <div className="navbar-actions">
            <button className="navbar-btn-orange" onClick={() => onTabChange('plan-trip')}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="homepage-hero-wrapper">
        {/* Full BG Hero Section */}
        <section className="hero-section-full-bg">
          {/* Looping Background Video */}
          <video autoPlay loop muted playsInline className="hero-bg-video">
            <source src="/The_truck_is_not_shown_fully_m.mp4" type="video/mp4" />
          </video>

          {/* Dark Overlay */}
          <div className="hero-overlay-dark"></div>

          {/* Left Aligned Content */}
          <div className="hero-full-bg-content">


            <h1 className="hero-title-all-caps">
              PLAN SMARTER.<br />
              <span className="orange-highlight-caps">DRIVE FURTHER.</span><br />
              STAY COMPLIANT.
            </h1>

            <p className="hero-description-caps">
              The next-generation logistics engine for enterprise fleets. Leverage Spotter.ai's high-performance neural networks to optimize every mile and ensure 100% FMCSA compliance.
            </p>

            <div className="hero-buttons-caps">
              <button className="btn-orange-filled-caps" onClick={() => onTabChange('plan-trip')}>
                INITIALIZE DISPATCH <FiArrowRight className="btn-arrow-icon" />
              </button>

            </div>
          </div>

          {/* Bottom Right Floating Stats */}
          <div className="hero-bottom-right-specs">
            <div className="spec-box-caps">
              <span className="spec-lbl-caps">LATENCY</span>
              <span className="spec-val-caps">14ms</span>
            </div>
            <div className="spec-box-caps">
              <span className="spec-lbl-caps">ACCURACY</span>
              <span className="spec-val-caps">99.9%</span>
            </div>
          </div>
        </section>
      </div>

      <div className="content-container">
        {/* Stats Strip */}
        <section id="how-it-works" className="stats-grid-row">
          <div className="stat-box-item">
            <span className="stat-lbl-main">ROUTES PLANNED</span>
            <div className="stat-val-wrapper">
              <span className="stat-val-main">12M+</span>
              <FiTrendingUp className="stat-icon-orange" />
            </div>
          </div>
          <div className="stat-box-item">
            <span className="stat-lbl-main">MILES OPTIMIZED</span>
            <div className="stat-val-wrapper">
              <span className="stat-val-main">850M</span>
              <FiActivity className="stat-icon-orange" />
            </div>
          </div>
          <div className="stat-box-item">
            <span className="stat-lbl-main">HOURS SAVED</span>
            <div className="stat-val-wrapper">
              <span className="stat-val-main">420K</span>
              <FiClock className="stat-icon-orange" />
            </div>
          </div>
          <div className="stat-box-item">
            <span className="stat-lbl-main">COMPLIANCE ACCURACY</span>
            <div className="stat-val-wrapper">
              <span className="stat-val-main">99.9%</span>
              <FiShield className="stat-icon-orange" />
            </div>
          </div>
        </section>

        {/* Core Capabilities Section */}
        <section id="features" className="capabilities-centered-section">
          <span className="section-label-orange">CORE CAPABILITIES</span>
          <h2 className="section-title-large">Engineered for Reliability</h2>
          <p className="section-subtitle-large">
            Streamlining the logistics chain through advanced telemetry and automated decision making.
          </p>

          <div className="capabilities-grid-layout">
            {/* Card 1: AI Route Optimization */}
            <div className="cap-card-item">
              <div className="cap-card-header">
                <div className="cap-icon-box">
                  <FiMap />
                </div>
                <h3 className="cap-card-title">AI Route Optimization</h3>
              </div>
              <p className="cap-card-desc">
                Predictive algorithms analyze traffic patterns, weather, and topography to find the most fuel-efficient path for every load.
              </p>
              {/* Graphical Line Visualizer */}
              <div className="route-visualizer-box">
                <svg className="route-visualizer-svg" viewBox="0 0 300 40">
                  <line x1="20" y1="20" x2="280" y2="20" className="route-line-base" />
                  <circle cx="20" cy="20" r="4" className="route-point-active" />
                  <circle cx="100" cy="20" r="4" className="route-point-active" />
                  <circle cx="200" cy="20" r="4" className="route-point-active" />
                  <circle cx="280" cy="20" r="4" className="route-point-active" />
                </svg>
              </div>
            </div>

            {/* Card 2: Automatic ELD Log Generation */}
            <div className="cap-card-item">
              <div className="cap-card-header">
                <div className="cap-icon-box">
                  <FiClock />
                </div>
                <h3 className="cap-card-title">Automatic ELD Log Generation</h3>
              </div>
              <p className="cap-card-desc">
                Zero-touch logging. Our system captures duty status automatically, reducing human error and audit risk.
              </p>
              <div className="eld-status-meta">
                <span className="eld-meta-lbl">LOG ACCURACY</span>
                <span className="eld-meta-val">HIGH FIDELITY</span>
              </div>
            </div>

            {/* Card 3: FMCSA HOS Compliance */}
            <div className="cap-card-item">
              <div className="cap-card-header">
                <div className="cap-icon-box">
                  <FiShield />
                </div>
                <h3 className="cap-card-title">FMCSA HOS Compliance</h3>
              </div>
              <p className="cap-card-desc">
                Real-time alerts for HOS violations before they happen. Keep your safety score pristine and your drivers safe.
              </p>
              <div className="compliance-monitor-status">
                <span className="pulse-green-dot"></span> COMPLIANCE MONITOR ACTIVE
              </div>
            </div>

            {/* Card 4: Smart Fuel & Rest Stop Planning */}
            <div className="cap-card-item flex-two-columns">
              <div className="cap-card-header">
                <div className="cap-icon-box">
                  <FiDroplet />
                </div>
                <h3 className="cap-card-title">Smart Fuel & Rest Stop Planning</h3>
              </div>
              <p className="cap-card-desc">
                Optimize stops based on fuel price data and safe parking availability, ensuring drivers rest where it's best for business.
              </p>
              <button onClick={() => onTabChange('routes')} className="explore-network-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', marginTop: '16px' }}>
                EXPLORE NETWORK <span className="arrow-small">→</span>
              </button>

              <div className="fuel-savings-metric-boxes">
                <div className="metric-mini-box">
                  <span className="metric-mini-lbl">FUEL SAVINGS</span>
                  <span className="metric-mini-val">14.2%</span>
                </div>
                <div className="metric-mini-box">
                  <span className="metric-mini-lbl">PARK SUCCESS</span>
                  <span className="metric-mini-val">92%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="contact" className="cta-modern-section">
          <h2 className="cta-modern-title">Ready to modernize your dispatch?</h2>
          <p className="cta-modern-desc">
            Join thousands of fleet managers who trust Spotter.ai to handle the heavy lifting of logistics and compliance.
          </p>
          <div className="cta-modern-buttons">
            <button className="btn-modern-orange" onClick={() => onTabChange('plan-trip')}>Start Free Trial</button>
            <button className="btn-modern-outline" onClick={() => onTabChange('plan-trip')}>Schedule a Demo</button>
          </div>
        </section>

        {/* Footer */}
        <footer id="documentation" className="footer-modern">
          <div className="footer-top-grid">
            <div className="footer-info-block">
              <div className="footer-brand-title">Spotter.ai</div>
              <p className="footer-brand-desc">
                Intelligent fleet management for the modern road. Built for drivers, designed for dispatchers.
              </p>
              <div className="footer-social-row">
                <a href="#globe" aria-label="Website"><FiGlobe /></a>
                <a href="#github" aria-label="Github"><FiGithub /></a>
              </div>
            </div>

            <div className="footer-links-column">
              <h4 className="footer-col-title">PLATFORM</h4>
              <a href="#ai-routing">AI Routing</a>
              <a href="#eld-solutions">ELD Solutions</a>
              <a href="#safety">Safety Control</a>
              <a href="#mobile-app">Mobile App</a>
            </div>

            <div className="footer-links-column">
              <h4 className="footer-col-title">COMPANY</h4>
              <a href="#about">About Us</a>
              <a href="#careers">Careers</a>
              <a href="#press">Press Kit</a>
              <a href="#legal">Legal</a>
            </div>

            <div className="footer-links-column">
              <h4 className="footer-col-title">SUPPORT</h4>
              <a href="#documentation">Documentation</a>
              <a href="#help">Help Center</a>
              <a href="#guide">FMCSA Guide</a>
              <a href="#status">API Status</a>
            </div>

            <div className="footer-compliance-block">
              <h4 className="footer-col-title">COMPLIANCE</h4>
              <div className="compliance-authority-box">
                <span className="auth-lbl">ENGINEERING AUTHORITY ID</span>
                <span className="auth-val">ID: SPTR-2024-AI</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <span className="copyright-modern">© 2026 Spotterai Logistics. All rights reserved.</span>
            <div className="footer-bottom-links">
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Service</a>
              <a href="#cookies">Cookies</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Homepage;
