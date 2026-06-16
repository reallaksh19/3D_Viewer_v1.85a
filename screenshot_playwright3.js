const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1500); // let UI render
  
  // Try to load mock geometry and set to PipingIso theme
  await page.evaluate(() => {
    // click mock 1 if present
    const btnMock1 = document.querySelector('button[title*="Mock 1"]');
    if (btnMock1) {
        btnMock1.click();
    } else {
        const btnMock1Alternative = document.evaluate("//button[contains(., 'Mock 1')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if(btnMock1Alternative) btnMock1Alternative.click();
    }
  });

  await page.waitForTimeout(1500); // Wait for mock geometry to load

  await page.evaluate(() => {
    if (window.state && window.state.viewerSettings) {
        window.state.viewerSettings.themePreset = 'PipingIso';
        const themeSelect = document.querySelector('#viewer3d-theme-select');
        if (themeSelect) {
            themeSelect.value = 'PipingIso';
            themeSelect.dispatchEvent(new Event('change'));
        }
    }
  });

  await page.waitForTimeout(1500); // Wait for theme to apply

  // Take screenshot
  await page.screenshot({ path: 'piping_iso_theme3.png', fullPage: true });

  await browser.close();
  
  console.log("Screenshot 3 taken.");
})();
