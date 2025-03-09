import puppeteer from 'puppeteer';

(async () => {
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false }); // Set headless to false to see the browser

    // Open a new page
    const page = await browser.newPage();

    // Navigate to YouTube
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2', timeout: 5000000 });

    // Wait for some time to observe the page
    // await page.waitForTimeout(5000000);

    // Close the browser
    // await browser.close();
})();
