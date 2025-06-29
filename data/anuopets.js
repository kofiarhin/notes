import React from "react";

const getColor = (rating) => {
  if (rating >= 7.5) return "#21d07a"; // green
  if (rating >= 5) return "#d2d531"; // yellow
  return "#db2360"; // red
};

const MovieScoreBadge = ({ rating = 0, label = "User Score", size = 60 }) => {
  const score = Math.round((rating / 10) * 100); // convert to percentage
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#444"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(rating)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={size * 0.28}
          fontWeight="bold"
        >
          {rating.toFixed(1)}
        </text>
      </svg>
      <span style={{ marginTop: 4, fontSize: "0.75rem", color: "#ccc" }}>{label}</span>
    </div>
  );
};

export default MovieScoreBadge;





//cose snippets 
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Cache Busting CSS</title>
  <script>
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/styles.css?v=${Date.now()}`; // bust cache with timestamp
    document.head.appendChild(link);
  </script>
</head>
<body>
  <h1>No more cached CSS</h1>
</body>
</html>

import { useEffect, useRef, useState } from 'react';

function LazyImage({ src, alt, ...rest }) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(imgRef.current);
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : ''}
      alt={alt}
      {...rest}
    />
  );
}

export default LazyImage;