const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const targetUrl = 'https://example.com'; // Replace with your target URL
  await page.goto(targetUrl, { waitUntil: 'networkidle2' });

  // Optional screenshot
  await page.screenshot({ path: 'screenshot.png', fullPage: true });

  // Extract all image URLs from the DOM
  const imageUrls = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    return images
      .map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src'))
      .filter(Boolean);
  });

  console.log('Extracted Image URLs:', imageUrls);

  // Optional: Save to JSON
  fs.writeFileSync('images.json', JSON.stringify(imageUrls, null, 2));

  await browser.close();

  return imageUrls;
})();
