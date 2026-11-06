const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HOST = '127.0.0.1';
let server;
let browser;
let page;

function startServer() {
  return new Promise((resolve, reject) => {
    const serverInstance = http.createServer((req, res) => {
      let filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    serverInstance.listen(0, HOST, () => {
      const addr = serverInstance.address();
      server = serverInstance;
      resolve(addr.port);
    });

    serverInstance.on('error', reject);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

test('setup server and browser', async () => {
  const port = await startServer();
  browser = await chromium.launch();
  page = await browser.newPage();
  assert.ok(port > 0, 'Server should be running on a valid port');
});

test('page title identifies Final Fantasy Tactics', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);
  const title = await page.title();
  assert.ok(/Final Fantasy Tactics/i.test(title), `Title should identify Final Fantasy Tactics, got: ${title}`);
});

test('substantive original PlayStation content is visible', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);
  const h1Text = await page.locator('h1').textContent();
  assert.ok(/Story of Ivalice/i.test(h1Text), `h1 should mention Story of Ivalice, got: ${h1Text}`);

  const h2s = await page.locator('h2').allTextContents();
  const h2Str = h2s.join(' ');
  assert.ok(/Key Characters/i.test(h2Str), 'Should have Key Characters heading');
  assert.ok(/Tactical Battles/i.test(h2Str), 'Should have Tactical Battles heading');
  assert.ok(/Job System/i.test(h2Str), 'Should have Job System heading');
  assert.ok(/Original PlayStation/i.test(h2Str), 'Should have Original PlayStation heading');
});

test('navigation reaches the correct sections', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);

  // Test at desktop width
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.locator('nav a[href="#story"]').click();
  await page.waitForTimeout(300);
  const storyVisible = await page.locator('#story').isVisible();
  assert.ok(storyVisible, '#story section should be visible');
  const storyInViewport = await isSectionInViewport(page, '#story');
  assert.ok(storyInViewport, '#story section should be in viewport and not hidden by header');

  await page.locator('nav a[href="#characters"]').click();
  await page.waitForTimeout(300);
  const charsVisible = await page.locator('#characters').isVisible();
  assert.ok(charsVisible, '#characters section should be visible');
  const charsInViewport = await isSectionInViewport(page, '#characters');
  assert.ok(charsInViewport, '#characters section should be in viewport and not hidden by header');

  await page.locator('nav a[href="#battles"]').click();
  await page.waitForTimeout(300);
  const battlesVisible = await page.locator('#battles').isVisible();
  assert.ok(battlesVisible, '#battles section should be visible');
  const battlesInViewport = await isSectionInViewport(page, '#battles');
  assert.ok(battlesInViewport, '#battles section should be in viewport and not hidden by header');

  await page.locator('nav a[href="#job-system"]').click();
  await page.waitForTimeout(300);
  const jobsVisible = await page.locator('#job-system').isVisible();
  assert.ok(jobsVisible, '#job-system section should be visible');
  const jobsInViewport = await isSectionInViewport(page, '#job-system');
  assert.ok(jobsInViewport, '#job-system section should be in viewport and not hidden by header');

  await page.locator('nav a[href="#ps1-info"]').click();
  await page.waitForTimeout(300);
  const ps1Visible = await page.locator('#ps1-info').isVisible();
  assert.ok(ps1Visible, '#ps1-info section should be visible');
  const ps1InViewport = await isSectionInViewport(page, '#ps1-info');
  assert.ok(ps1InViewport, '#ps1-info section should be in viewport and not hidden by header');

  // Test at mobile width
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('nav a[href="#story"]').click();
  await page.waitForTimeout(300);
  const storyMobileInViewport = await isSectionInViewport(page, '#story');
  assert.ok(storyMobileInViewport, '#story section should be in viewport on mobile and not hidden by header');
});

async function isSectionInViewport(page, selector) {
  return await page.evaluate((sel) => {
    const section = document.querySelector(sel);
    if (!section) return false;
    const header = document.querySelector('header');
    const headerBottom = header.getBoundingClientRect().bottom;
    const rect = section.getBoundingClientRect();
    // The top of the section must be below the header bottom
    return rect.top > headerBottom && rect.bottom > 0 && rect.top < window.innerHeight;
  }, selector);
}

async function isHeadingBelowHeader(page, selector) {
  return await page.evaluate((sel) => {
    const heading = document.querySelector(sel);
    if (!heading) return false;
    const header = document.querySelector('header');
    const headerBottom = header.getBoundingClientRect().bottom;
    const rect = heading.getBoundingClientRect();
    // The heading must be below the header
    return rect.top > headerBottom && rect.top < window.innerHeight;
  }, selector);
}

test('keyboard navigation exposes visible focus', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);

  await page.keyboard.press('Tab');
  const logoFocused = await page.locator('a.logo').evaluate(el => el === document.activeElement);
  assert.ok(logoFocused, 'Logo link should be focused after Tab');

  const logoHasFocus = await page.locator('a.logo').evaluate(el => {
    const style = window.getComputedStyle(el);
    return style.outlineStyle !== 'none' || style.outlineWidth !== '0px';
  });
  assert.ok(logoHasFocus, 'Logo should have visible focus indicator');
});

test('desktop layout has no horizontal overflow', async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`http://${HOST}:${server.address().port}/`);

  const overflowX = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  assert.ok(overflowX, 'Desktop layout should not have horizontal overflow');
});

test('narrow mobile layout has no horizontal overflow', async () => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`http://${HOST}:${server.address().port}/`);

  const overflowX = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  assert.ok(overflowX, 'Mobile layout should not have horizontal overflow');
});

test('page produces no uncaught browser errors', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);

  const errors = [];
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  await page.waitForTimeout(500);

  assert.strictEqual(errors.length, 0, `Page should produce no uncaught errors, got: ${errors.join(', ')}`);
});

test('missing resource returns HTTP 404', async () => {
  const response = await page.goto(`http://${HOST}:${server.address().port}/nonexistent-resource.html`);
  assert.strictEqual(response.status(), 404, 'Missing resource should return 404');
});

test('interactive controls work through clicks', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);

  await page.locator('.character-card').first().click();
  const cardVisible = await page.locator('.character-card').first().isVisible();
  assert.ok(cardVisible, 'Character card should still be visible after click');
});

test('story section has correct narrative details', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);
  const storySection = await page.locator('#story').textContent();

  // Positive assertions
  assert.ok(/Balbanes/i.test(storySection), 'Story should mention Balbanes as Ramza\'s father');
  assert.ok(/third son/i.test(storySection), 'Story should identify Ramza as the third son');
  assert.ok(/Omdoria/i.test(storySection), 'Story should name King Omdoria');
  assert.ok(/Duke Larg/i.test(storySection), 'Story should mention Duke Larg');
  assert.ok(!/Larg Beoulve/i.test(storySection), 'Story should not call Larg Beoulve');
  assert.ok(/Goltanna/i.test(storySection), 'Story should mention Goltanna');

  // Negative assertions
  assert.ok(!/Duke Larg Beoulve.*son/i.test(storySection) && !/third son of Duke Larg/i.test(storySection), 'Story should not say Ramza is Larg\'s son');
  assert.ok(!/King Doned/i.test(storySection), 'Story should not mention King Doned');
});

test('characters section has correct biographies', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);
  const charactersSection = await page.locator('#characters').textContent();

  // Positive assertions
  assert.ok(/Olan Durai/i.test(charactersSection), 'Should feature Olan Durai as a character');
  assert.ok(/Astrologist/i.test(charactersSection), 'Olan should be described as an Astrologist');
  assert.ok(/southern order/i.test(charactersSection), 'Olan should be associated with the southern order');
  assert.ok(/Ramza/i.test(charactersSection), 'Olan should encounter Ramza');
  assert.ok(/Cleric/i.test(charactersSection), 'Alma should be described as a Cleric');
  assert.ok(/MBarrier/i.test(charactersSection), 'Alma should use MBarrier');

  // Negative assertions
  assert.ok(!/monk/i.test(charactersSection), 'Olan should not be described as a monk');
  assert.ok(!/Northern Sky/i.test(charactersSection), 'Olan should not be associated with the Order of the Northern Sky');
  assert.ok(!/throughout Ramza.*journey/i.test(charactersSection) && !/throughout his journey/i.test(charactersSection), 'Olan should not be described as accompanying Ramza throughout his journey');
  assert.ok(!/power of Machina/i.test(charactersSection), 'Alma should not have fabricated Machina power');
  assert.ok(!/Ortho Belnades/i.test(charactersSection), 'Ortho Belnades should not appear as a character');
});

test('job system section explains current job and supplementary abilities', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);
  const jobSection = await page.locator('#job-system').textContent();

  // Positive assertions
  assert.ok(/20 standard jobs/i.test(jobSection), 'Should mention 20 standard jobs');
  assert.ok(/one current job/i.test(jobSection) || /one primary job/i.test(jobSection), 'Should explain one current job');
  assert.ok(/learned abilities/i.test(jobSection) || /supplementary/i.test(jobSection), 'Should mention learned/supplementary abilities');
  assert.ok(/another job/i.test(jobSection) || /other job/i.test(jobSection), 'Should mention abilities from other jobs');

  // Negative assertions
  assert.ok(!/abilities.*exclusively.*current job/i.test(jobSection) && !/exclusively from their currently equipped job.*abilities/i.test(jobSection), 'Should not say abilities come exclusively from current job');
  assert.ok(!/Berserker/i.test(jobSection), 'Berserker should not be listed as a job');
});

test('battles section accurately describes encounter count', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);
  const battlesSection = await page.locator('#battles').textContent();
  const normalized = battlesSection.replace(/\s+/g, ' ').trim();

  // Positive assertions: exact corrected paragraph
  assert.ok(/The game features approximately 70 fixed encounters across the story and optional content\. Additional repeatable random battles provide opportunities to train your units\./i.test(normalized), 'Should contain the corrected battles paragraph');

  // Negative assertions: reject the previous contradictory paragraph
  assert.ok(!/over 100 battles/i.test(normalized), 'Should not claim over 100 battles');
  assert.ok(!/every battle contributes to the overarching narrative/i.test(normalized), 'Should not claim every battle contributes to the narrative');
});

test('ps1-info section describes pixel-art visuals', async () => {
  await page.goto(`http://${HOST}:${server.address().port}/`);
  const ps1Section = await page.locator('#ps1-info').textContent();

  // Positive assertions
  assert.ok(/pixel-art/i.test(ps1Section) || /pixel art/i.test(ps1Section), 'Should describe pixel-art visuals');
  assert.ok(/polygonal/i.test(ps1Section), 'Should mention polygonal environments');

  // Negative assertions
  assert.ok(!/cel-shaded/i.test(ps1Section), 'Should not describe original as cel-shaded');
});

test('cleanup browser and server', async () => {
  if (browser) {
    await browser.close();
    browser = null;
  }
  await stopServer();
});
