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