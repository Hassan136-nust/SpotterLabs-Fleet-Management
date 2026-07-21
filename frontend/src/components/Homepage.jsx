import React, { useState } from 'react';
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
  FiDroplet,
  FiMenu,
  FiX
} from 'react-icons/fi';
import CircularGallery from './CircularGallery';
import './Dashboard.css'; // Reuse homepage styles


const galleryItems = [
  {
    image: '/WhatsApp Image 2026-07-21 at 6.51.52 PM.jpeg',
    text: 'Route Optimization'
  },
  {
    image: '/ChatGPT Image Jul 21, 2026, 06_40_31 PM.png',
    text: 'Live Fleet Telematics'
  },
  {
    image: '/WhatsApp Image 2026-07-21 at 6.54.49 PM.jpeg',
    text: 'Automatic ELD Log Generation'
  },

  {
    image: '/ChatGPT Image Jul 21, 2026, 06_32_05 PM.png',
    text: 'Smart Fuel & Rest Stop Planning'
  }

];

const Homepage = ({ onTabChange }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
            {/* Mobile hamburger */}
            <button
              className="navbar-mobile-toggle"
              onClick={() => setMobileNavOpen(p => !p)}
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileNavOpen && (
          <div className="navbar-mobile-dropdown">
            <a href="#features"   onClick={() => setMobileNavOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMobileNavOpen(false)}>How It Works</a>
            <a href="#documentation" onClick={() => setMobileNavOpen(false)}>Documentation</a>
            <a href="#contact"    onClick={() => setMobileNavOpen(false)}>Contact</a>
            <button className="navbar-btn-orange mobile-full" onClick={() => { onTabChange('plan-trip'); setMobileNavOpen(false); }}>
              Get Started
            </button>
          </div>
        )}
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
            Streamlining the logistics chain through advanced telemetry and automated decision making. Drag or scroll to explore capabilities.
          </p>

          <div className="gallery-canvas-wrapper" style={{ position: 'relative', width: '100%', marginTop: '30px' }}>
            <CircularGallery
              items={galleryItems}
              bend={3}
              textColor="#ff6600"
              borderRadius={0.06}
              scrollSpeed={2}
              scrollEase={0.04}
              font="bold 24px Orbitron"
              fontUrl="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap"
            />
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
