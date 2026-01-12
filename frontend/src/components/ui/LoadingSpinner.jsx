import React from 'react';
import PropTypes from 'prop-types';

export default function LoadingSpinner({ size = 24, stroke = 3, color = 'var(--primary)' }) {
  const s = Number(size) || 24;
  const strokeW = Number(stroke) || 3;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 50 50"
      role="img"
      aria-label="Loading"
      className="animate-spin"
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth={strokeW}
      />
      <path
        d="M45 25a20 20 0 0 1-20 20"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  stroke: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  color: PropTypes.string,
};
